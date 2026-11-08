import secrets
import uuid
from datetime import timedelta

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


username_validator = RegexValidator(
    r"\A[a-z0-9_]{3,30}\Z", "Use 3–30 letters, numbers, or underscores."
)


def random_user_handle():
    return secrets.token_bytes(32)


def ceremony_expiry():
    return timezone.now() + timedelta(minutes=5)


class UserManager(BaseUserManager):
    def create_user(self, username, **extra_fields):
        user = self.model(username=username.strip().lower(), **extra_fields)
        user.set_unusable_password()
        user.full_clean()
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):
    username = models.CharField(max_length=30, unique=True, validators=[username_validator])
    webauthn_user_handle = models.BinaryField(max_length=32, unique=True, default=random_user_handle)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "username"
    objects = UserManager()

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(username=Lower("username")), name="user_lowercase_username")
        ]

    def __str__(self):
        return self.username


class Passkey(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="passkeys")
    credential_id = models.BinaryField(unique=True)
    public_key = models.BinaryField()
    sign_count = models.PositiveBigIntegerField(default=0)
    device_type = models.CharField(max_length=20)
    backed_up = models.BooleanField(default=False)
    transports = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)
    last_used_at = models.DateTimeField(null=True, blank=True)


class Ceremony(models.Model):
    class Operation(models.TextChoices):
        SIGNUP = "signup"
        SIGNIN = "signin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_digest = models.CharField(max_length=64)
    operation = models.CharField(max_length=10, choices=Operation.choices)
    challenge = models.BinaryField()
    username = models.CharField(max_length=30, blank=True)
    user_handle = models.BinaryField(null=True, blank=True)
    expires_at = models.DateTimeField(default=ceremony_expiry, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session_digest"], name="one_ceremony_per_session")
        ]


class RateLimitBucket(models.Model):
    key = models.CharField(max_length=64)
    window_start = models.DateTimeField(db_index=True)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["key", "window_start"], name="unique_rate_limit_window")
        ]


class Product(models.Model):
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    target_stock = models.PositiveIntegerField(default=3)
    provider_key = models.CharField(max_length=50, default="mock")
    provider_product_ref = models.CharField(max_length=120, default="demo-link")


class AcquisitionJob(models.Model):
    class State(models.TextChoices):
        QUEUED = "queued"
        RUNNING = "running"
        RETRY = "retry"
        BLOCKED = "blocked"
        SUCCEEDED = "succeeded"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="acquisitions")
    # Snapshot the provider mapping: retries must not silently switch suppliers.
    provider_key = models.CharField(max_length=50)
    provider_product_ref = models.CharField(max_length=120)
    state = models.CharField(max_length=12, choices=State.choices, default=State.QUEUED)
    attempts = models.PositiveIntegerField(default=0)
    retry_at = models.DateTimeField(null=True, blank=True)
    error_code = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["product"],
                condition=models.Q(state__in=["queued", "running", "retry", "blocked"]),
                name="one_unfinished_acquisition",
            ),
            models.CheckConstraint(
                condition=models.Q(state__in=["queued", "running", "retry", "blocked", "succeeded"]),
                name="valid_acquisition_state",
            ),
        ]


class InventoryItem(models.Model):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="items")
    acquisition = models.OneToOneField(AcquisitionJob, on_delete=models.PROTECT, related_name="item")
    provider_key = models.CharField(max_length=50)
    provider_reference = models.CharField(max_length=200)
    url = models.URLField(max_length=2000)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["provider_key", "provider_reference"], name="unique_provider_item")
        ]


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        FULFILLED = "fulfilled"

    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="orders")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="orders")
    request_id = models.UUIDField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    item = models.OneToOneField(InventoryItem, on_delete=models.PROTECT, related_name="order", null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    fulfilled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "request_id"], name="unique_user_order_request"),
            models.CheckConstraint(
                condition=(
                    models.Q(status="pending", item__isnull=True, fulfilled_at__isnull=True)
                    | models.Q(status="fulfilled", item__isnull=False, fulfilled_at__isnull=False)
                ),
                name="consistent_order_fulfillment",
            ),
        ]
        indexes = [models.Index(fields=["product", "status", "created_at", "id"], name="pending_order_fifo")]


class MockProviderControl(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    paused = models.BooleanField(default=False)
    fail_next = models.BooleanField(default=False)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name="singleton_mock_control")]
