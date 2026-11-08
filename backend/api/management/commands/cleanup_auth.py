from datetime import timedelta

from django.contrib.sessions.models import Session
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Ceremony, RateLimitBucket


class Command(BaseCommand):
    help = "Remove expired passkey ceremonies, rate-limit windows, and browser sessions."

    def handle(self, *args, **options):
        now = timezone.now()
        ceremonies, _ = Ceremony.objects.filter(expires_at__lte=now).delete()
        buckets, _ = RateLimitBucket.objects.filter(window_start__lt=now - timedelta(minutes=2)).delete()
        sessions, _ = Session.objects.filter(expire_date__lte=now).delete()
        self.stdout.write(f"Removed {ceremonies} ceremonies, {buckets} rate-limit windows, and {sessions} sessions.")
