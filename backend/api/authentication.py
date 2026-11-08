from django.contrib.auth.backends import BaseBackend
from rest_framework.authentication import SessionAuthentication

from .models import User


class PasskeyBackend(BaseBackend):
    """Load session users; intentionally provide no password authentication path."""

    def get_user(self, user_id):
        return User.objects.filter(pk=user_id, is_active=True).first()


class BrowserSessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        # DRF normally skips CSRF for anonymous users. Signup/signin must not.
        self.enforce_csrf(request)
        return super().authenticate(request)

    def authenticate_header(self, request):
        return "Session"
