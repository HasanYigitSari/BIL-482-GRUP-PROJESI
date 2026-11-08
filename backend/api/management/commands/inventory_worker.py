from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError
from psycopg import Error as PsycopgError

from api.inventory.worker import run_worker


class Command(BaseCommand):
    help = "Fulfill pending orders and replenish digital inventory using the local mock provider."
    requires_migrations_checks = True

    def handle(self, *args, **options):
        try:
            run_worker()
        except (DatabaseError, PsycopgError):
            raise CommandError("Inventory worker lost database access; no automatic reconnect was attempted.") from None
        except RuntimeError as exc:
            raise CommandError(str(exc)) from None
