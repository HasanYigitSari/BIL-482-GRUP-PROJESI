import json
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from rest_framework.exceptions import Throttled
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import options_to_json, parse_authentication_credential_json, parse_registration_credential_json
from webauthn.helpers.exceptions import WebAuthnException
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from .errors import AuthError
from .models import Ceremony, Passkey, RateLimitBucket, User, random_user_handle


logger = logging.getLogger("api.security")


def rate_limit(request, operation):
    """Thirty requests per operation/IP/minute, shared across backend processes."""
    now = timezone.now()
    window = now.replace(second=0, microsecond=0)
    # The only supported proxy is local Vite. Do not trust client forwarding headers.
    address = request.META.get("REMOTE_ADDR", "unknown")
    key = salted_hmac("auth-rate-limit", f"{operation}:{address}", algorithm="sha256").hexdigest()
    bucket, _ = RateLimitBucket.objects.get_or_create(key=key, window_start=window)
    updated = RateLimitBucket.objects.filter(pk=bucket.pk, count__lt=30).update(count=F("count") + 1)
    if not updated:
        raise Throttled(wait=max(1, int((window + timedelta(minutes=1) - now).total_seconds())))


def session_digest(session):
    if not session.session_key:
        session.create()
    return salted_hmac("webauthn-session", session.session_key, algorithm="sha256").hexdigest()


def lock_session(session):
    if not Session.objects.select_for_update().filter(
        session_key=session.session_key, expire_date__gt=timezone.now()
    ).exists():
        raise AuthError("ceremony_expired", "This request expired. Please start again.")


def create_ceremony(session, operation, **fields):
    digest = session_digest(session)
    with transaction.atomic():
        # Serialize begin requests in the same browser and keep one pending operation.
        lock_session(session)
        Ceremony.objects.filter(session_digest=digest).delete()
        return Ceremony.objects.create(
            session_digest=digest, operation=operation, challenge=secrets.token_bytes(32), **fields
        )


def begin_signup(session, username):
    if User.objects.filter(username=username).exists():
        raise AuthError("username_taken", "That username is already taken.", 409)
    ceremony = create_ceremony(
        session, Ceremony.Operation.SIGNUP, username=username, user_handle=random_user_handle()
    )
    options = generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_name=username,
        user_id=bytes(ceremony.user_handle),
        challenge=bytes(ceremony.challenge),
        timeout=300000,
        attestation=AttestationConveyancePreference.NONE,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            require_resident_key=True,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    return {"ceremony_id": str(ceremony.pk), "options": json.loads(options_to_json(options))}


def begin_signin(session):
    ceremony = create_ceremony(session, Ceremony.Operation.SIGNIN)
    options = generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        challenge=bytes(ceremony.challenge),
        timeout=300000,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    return {"ceremony_id": str(ceremony.pk), "options": json.loads(options_to_json(options))}


def locked_ceremony(session, ceremony_id, operation):
    if not session.session_key:
        raise AuthError("ceremony_expired", "This request expired. Please start again.")
    digest = session_digest(session)
    # Use the same lock order as begin requests, before acquiring the ceremony lock.
    lock_session(session)
    ceremony = Ceremony.objects.select_for_update().filter(
        pk=ceremony_id, session_digest=digest, operation=operation
    ).first()
    if ceremony is None or ceremony.expires_at <= timezone.now():
        raise AuthError("ceremony_expired", "This request expired or was already used. Please start again.")
    return ceremony


def complete_signup(session, ceremony_id, credential):
    try:
        with transaction.atomic():
            ceremony = locked_ceremony(session, ceremony_id, Ceremony.Operation.SIGNUP)
            try:
                parsed = parse_registration_credential_json(credential)
                verified = verify_registration_response(
                    credential=parsed,
                    expected_challenge=bytes(ceremony.challenge),
                    expected_rp_id=settings.WEBAUTHN_RP_ID,
                    expected_origin=settings.WEBAUTHN_ORIGIN,
                    require_user_verification=True,
                )
            except (WebAuthnException, ValueError, TypeError, KeyError) as exc:
                raise AuthError("invalid_passkey", "The passkey could not be verified. Please try again.") from exc
            if len(verified.credential_id) > 1023:
                raise AuthError("invalid_passkey", "This credential is not supported.")
            if User.objects.filter(username=ceremony.username).exists():
                raise AuthError("username_taken", "That username is already taken.", 409)
            user = User.objects.create_user(
                username=ceremony.username, webauthn_user_handle=bytes(ceremony.user_handle)
            )
            Passkey.objects.create(
                user=user,
                credential_id=verified.credential_id,
                public_key=verified.credential_public_key,
                sign_count=verified.sign_count,
                device_type=verified.credential_device_type.value,
                backed_up=verified.credential_backed_up,
                transports=[transport.value for transport in (parsed.response.transports or [])],
            )
            ceremony.delete()
    except (IntegrityError, ValidationError) as exc:
        raise AuthError("signup_conflict", "That username or passkey is already in use. Please start again.", 409) from exc
    logger.info("account_created account_id=%s", user.pk)
    return user


def complete_signin(session, ceremony_id, credential):
    with transaction.atomic():
        ceremony = locked_ceremony(session, ceremony_id, Ceremony.Operation.SIGNIN)
        try:
            parsed = parse_authentication_credential_json(credential)
        except (WebAuthnException, ValueError, TypeError, KeyError) as exc:
            raise AuthError("invalid_passkey", "The passkey could not be verified. Please try again.") from exc
        passkey = Passkey.objects.select_for_update().filter(credential_id=parsed.raw_id).first()
        if passkey is None or not passkey.user.is_active:
            raise AuthError("invalid_passkey", "The passkey could not be verified. Please try again.")
        # Username-free signin requires the authenticator's user handle to match its owner.
        if parsed.response.user_handle is None or not constant_time_compare(
            parsed.response.user_handle, bytes(passkey.user.webauthn_user_handle)
        ):
            raise AuthError("invalid_passkey", "The passkey could not be verified. Please try again.")
        try:
            verified = verify_authentication_response(
                credential=parsed,
                expected_challenge=bytes(ceremony.challenge),
                expected_rp_id=settings.WEBAUTHN_RP_ID,
                expected_origin=settings.WEBAUTHN_ORIGIN,
                credential_public_key=bytes(passkey.public_key),
                credential_current_sign_count=passkey.sign_count,
                require_user_verification=True,
            )
        except (WebAuthnException, ValueError, TypeError, KeyError) as exc:
            raise AuthError("invalid_passkey", "The passkey could not be verified. Please try again.") from exc
        if verified.credential_device_type.value != passkey.device_type:
            raise AuthError("invalid_passkey", "The passkey could not be verified. Please try again.")
        passkey.sign_count = verified.new_sign_count
        passkey.backed_up = verified.credential_backed_up
        passkey.last_used_at = timezone.now()
        passkey.save(update_fields=["sign_count", "backed_up", "last_used_at"])
        ceremony.delete()
    logger.info("signin_verified account_id=%s", passkey.user_id)
    return passkey.user
