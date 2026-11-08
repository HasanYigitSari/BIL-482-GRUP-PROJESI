import logging
from datetime import timedelta

from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .errors import AuthError
from .serializers import AccountSerializer, CompleteSerializer, SignupSerializer


logger = logging.getLogger("api.security")


class AuthView(APIView):
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response

    def handle_exception(self, exc):
        if isinstance(exc, AuthError):
            logger.info("auth_request_rejected reason=%s", exc.detail["code"])
        return super().handle_exception(exc)


class PublicAuthView(AuthView):
    permission_classes = [AllowAny]


def require_signed_out(request):
    if request.user.is_authenticated:
        raise AuthError("already_signed_in", "You are already signed in. Open your account or sign out first.", 409)


def establish_session(request, user, status=200):
    login(request._request, user, backend="api.authentication.PasskeyBackend")
    request.session.set_expiry(timezone.now() + timedelta(hours=24))
    return Response({"user": AccountSerializer(user).data}, status=status)


class CsrfView(PublicAuthView):
    def get(self, request):
        return Response({"csrf_token": get_token(request._request)})


class MeView(AuthView):
    def get(self, request):
        return Response({"user": AccountSerializer(request.user).data})


class SignupBeginView(PublicAuthView):
    def post(self, request):
        services.rate_limit(request, "signup")
        require_signed_out(request)
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(services.begin_signup(request.session, serializer.validated_data["username"]))


class SignupCompleteView(PublicAuthView):
    def post(self, request):
        services.rate_limit(request, "signup")
        require_signed_out(request)
        serializer = CompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.complete_signup(request.session, **serializer.validated_data)
        return establish_session(request, user, status=201)


class SigninBeginView(PublicAuthView):
    def post(self, request):
        services.rate_limit(request, "signin")
        require_signed_out(request)
        return Response(services.begin_signin(request.session))


class SigninCompleteView(PublicAuthView):
    def post(self, request):
        services.rate_limit(request, "signin")
        require_signed_out(request)
        serializer = CompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.complete_signin(request.session, **serializer.validated_data)
        return establish_session(request, user)


class LogoutView(AuthView):
    def post(self, request):
        user_id = request.user.pk
        logout(request._request)
        logger.info("signed_out account_id=%s", user_id)
        return Response(status=204)
