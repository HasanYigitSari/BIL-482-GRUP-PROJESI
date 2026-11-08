"""One local worker, with durable jobs and a session-owned PostgreSQL lock."""
import json
import logging
import os
import signal
import threading
import time

from django.conf import settings
from django.db import IntegrityError, connection

from . import providers, services


logger = logging.getLogger("api.inventory")
LOCK_KEY = 1347767382
READY_FILE = settings.BASE_DIR.parent / ".local/run/inventory.ready.json"


class WorkerLockLost(RuntimeError):
    pass


def confirm_lock(raw):
    # Never reconnect transparently: a replacement session does not own our lock.
    if connection.connection is not raw or raw.closed:
        raise WorkerLockLost("Inventory worker lost its database session.")
    with raw.cursor() as cursor:
        cursor.execute(
            "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' "
            "AND pid = pg_backend_pid() AND classid = 0 AND objid::bigint = %s AND objsubid = 1 AND granted)",
            [LOCK_KEY],
        )
        if not cursor.fetchone()[0]:
            raise WorkerLockLost("Inventory worker lost its advisory lock.")


def heartbeat():
    READY_FILE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = READY_FILE.with_suffix(f".{os.getpid()}.tmp")
    temporary.write_text(json.dumps({"pid": os.getpid(), "heartbeat": time.time()}))
    temporary.replace(READY_FILE)


def run_worker():
    stopping = threading.Event()
    previous = {}
    acquired = False
    raw = None
    try:
        for sig in (signal.SIGTERM, signal.SIGINT):
            previous[sig] = signal.signal(sig, lambda *_: stopping.set())
        connection.ensure_connection()
        raw = connection.connection
        with raw.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(%s)", [LOCK_KEY])
            acquired = cursor.fetchone()[0]
        if not acquired:
            raise RuntimeError("Another inventory worker is already running.")
        # Verify migrations and seed data before announcing readiness.
        from api.models import MockProviderControl, Product
        MockProviderControl.objects.get(pk=1)
        if not Product.objects.exists():
            raise RuntimeError("No inventory products are configured.")
        heartbeat()
        logger.info("inventory_worker_started")
        while not stopping.is_set():
            confirm_lock(raw)
            heartbeat()
            claimed = services.claim_next()
            if claimed is not None:
                job, fail = claimed
                logger.info("acquisition_started job_id=%s attempt=%s", job.pk, job.attempts)
                try:
                    confirm_lock(raw)
                    result = providers.acquire(job.provider_key, job.provider_product_ref, job.pk, fail=fail)
                except providers.TemporaryProviderError:
                    confirm_lock(raw)
                    services.fail_acquisition(job.pk, "temporary_provider_failure", temporary=True)
                except providers.PermanentProviderError:
                    confirm_lock(raw)
                    services.fail_acquisition(job.pk, "invalid_provider_result")
                except WorkerLockLost:
                    # Lock/session errors must terminate the worker, not become supplier failures.
                    raise
                except Exception:
                    confirm_lock(raw)
                    services.fail_acquisition(job.pk, "unexpected_provider_failure")
                else:
                    confirm_lock(raw)
                    try:
                        services.complete_acquisition(job.pk, result)
                    except IntegrityError:
                        services.fail_acquisition(job.pk, "duplicate_provider_item")
            heartbeat()
            stopping.wait(1)
    finally:
        if acquired:
            try:
                data = json.loads(READY_FILE.read_text())
                if isinstance(data, dict) and data.get("pid") == os.getpid():
                    READY_FILE.unlink(missing_ok=True)
            except (OSError, ValueError):
                pass
        # Closing releases the session lock, including after a failed transaction.
        connection.close()
        for sig, handler in previous.items():
            signal.signal(sig, handler)
        logger.info("inventory_worker_stopped")
