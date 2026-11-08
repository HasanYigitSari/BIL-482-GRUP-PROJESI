import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound

from api.models import AcquisitionJob, InventoryItem, MockProviderControl, Order, Product, User


logger = logging.getLogger("api.inventory")
ERROR_MESSAGES = {
    "temporary_provider_failure": "The mock provider failed. This acquisition will retry automatically.",
    "invalid_provider_result": "The provider or its item response is invalid. Review the configuration before retrying.",
    "duplicate_provider_item": "The provider returned an item already recorded for another acquisition.",
    "unexpected_provider_failure": "An unexpected provider error blocked this acquisition. Review the provider before retrying.",
}


class InventoryError(APIException):
    def __init__(self, code, message, status=409):
        self.status_code = status
        super().__init__({"code": code, "message": message})


def available_items(product):
    return InventoryItem.objects.filter(product=product, order__isnull=True).order_by("created_at", "id")


def fulfill_waiting(product):
    """Caller holds the product row lock. All item assignment uses this function."""
    while True:
        order = Order.objects.filter(product=product, status=Order.Status.PENDING).order_by("created_at", "id").first()
        if order is None:
            return
        item = available_items(product).first()
        if item is None:
            return
        order.item = item
        order.status = Order.Status.FULFILLED
        order.fulfilled_at = timezone.now()
        order.save(update_fields=["item", "status", "fulfilled_at"])
        logger.info("order_fulfilled order_id=%s item_id=%s", order.pk, item.pk)


def needs_supply(product):
    return (
        Order.objects.filter(product=product, status=Order.Status.PENDING).exists()
        or available_items(product).count() < product.target_stock
    )


def ensure_acquisition(product):
    """Caller holds the product row lock; a job is the durable replenishment intent."""
    job = AcquisitionJob.objects.filter(product=product).exclude(state=AcquisitionJob.State.SUCCEEDED).first()
    if job is None and needs_supply(product):
        job = AcquisitionJob.objects.create(
            product=product, provider_key=product.provider_key, provider_product_ref=product.provider_product_ref,
        )
    return job


@transaction.atomic
def place_order(user, product_id, request_id):
    # Serialize the user's request IDs even if two requests name different products.
    User.objects.select_for_update().get(pk=user.pk)
    existing = Order.objects.select_related("product", "item").filter(user=user, request_id=request_id).first()
    if existing is not None:
        if existing.product_id != product_id:
            raise InventoryError("request_conflict", "This request identifier already belongs to another product.")
        return existing, False
    try:
        product = Product.objects.select_for_update().get(pk=product_id)
    except Product.DoesNotExist as exc:
        raise NotFound("Product not found.") from exc
    order = Order.objects.create(user=user, product=product, request_id=request_id)
    fulfill_waiting(product)
    ensure_acquisition(product)
    order = Order.objects.select_related("product", "item").get(pk=order.pk)
    logger.info("order_created order_id=%s account_id=%s status=%s", order.pk, user.pk, order.status)
    return order, True


def claim_next():
    """Only the advisory-lock-owning worker may claim jobs. No provider call here."""
    for product_id in Product.objects.order_by("id").values_list("id", flat=True):
        with transaction.atomic():
            product = Product.objects.select_for_update().get(pk=product_id)
            fulfill_waiting(product)
            job = ensure_acquisition(product)
            if job is None or job.state == AcquisitionJob.State.BLOCKED:
                continue
            if job.state == AcquisitionJob.State.QUEUED and not needs_supply(product):
                continue  # A target reduction can leave an unattempted job dormant.
            if job.retry_at and job.retry_at > timezone.now():
                continue
            fail = False
            if job.provider_key == "mock":
                control = MockProviderControl.objects.select_for_update().get(pk=1)
                if control.paused:
                    continue
                fail = control.fail_next
                if fail:
                    control.fail_next = False
                    control.save(update_fields=["fail_next"])
            job.state = AcquisitionJob.State.RUNNING
            job.attempts += 1
            job.retry_at = None
            job.error_code = ""
            job.save(update_fields=["state", "attempts", "retry_at", "error_code", "updated_at"])
            return job, fail
    return None


@transaction.atomic
def complete_acquisition(job_id, result):
    product_id = AcquisitionJob.objects.values_list("product_id", flat=True).get(pk=job_id)
    product = Product.objects.select_for_update().get(pk=product_id)
    job = AcquisitionJob.objects.get(pk=job_id)
    if job.state == AcquisitionJob.State.SUCCEEDED:
        return
    if job.state != AcquisitionJob.State.RUNNING:
        raise RuntimeError("Acquisition was not running.")
    # Item storage, assignment, completion and the next intent commit together.
    InventoryItem.objects.create(
        product=product, acquisition=job, provider_key=job.provider_key,
        provider_reference=result.reference, url=result.url,
    )
    job.state = AcquisitionJob.State.SUCCEEDED
    job.error_code = ""
    job.retry_at = None
    job.save(update_fields=["state", "error_code", "retry_at", "updated_at"])
    fulfill_waiting(product)
    ensure_acquisition(product)
    logger.info("acquisition_completed job_id=%s", job.pk)


@transaction.atomic
def fail_acquisition(job_id, code, *, temporary=False):
    product_id = AcquisitionJob.objects.values_list("product_id", flat=True).get(pk=job_id)
    Product.objects.select_for_update().get(pk=product_id)
    job = AcquisitionJob.objects.get(pk=job_id)
    if job.state != AcquisitionJob.State.RUNNING:
        return
    job.state = AcquisitionJob.State.RETRY if temporary else AcquisitionJob.State.BLOCKED
    delay = min(60, 5 * (2 ** min(max(0, job.attempts - 1), 4)))
    job.retry_at = timezone.now() + timedelta(seconds=delay) if temporary else None
    job.error_code = code
    job.save(update_fields=["state", "retry_at", "error_code", "updated_at"])
    logger.warning("acquisition_failed job_id=%s reason=%s state=%s", job.pk, code, job.state)


@transaction.atomic
def update_demo(product_id, action, target_stock=None):
    try:
        product = Product.objects.select_for_update().get(pk=product_id)
    except Product.DoesNotExist as exc:
        raise NotFound("Product not found.") from exc
    if action == "set_target":
        product.target_stock = target_stock
        product.save(update_fields=["target_stock"])
    elif action == "retry":
        job = AcquisitionJob.objects.filter(product=product, state=AcquisitionJob.State.BLOCKED).first()
        if job is None:
            raise InventoryError("nothing_blocked", "There is no blocked acquisition to retry.")
        job.state = AcquisitionJob.State.RETRY
        job.retry_at = timezone.now()
        job.error_code = ""
        job.save(update_fields=["state", "retry_at", "error_code", "updated_at"])
    else:
        control = MockProviderControl.objects.select_for_update().get(pk=1)
        if action in ("pause", "resume"):
            control.paused = action == "pause"
        elif action == "fail_next":
            control.fail_next = True
        control.save(update_fields=["paused", "fail_next"])
    fulfill_waiting(product)
    ensure_acquisition(product)
    logger.info("demo_control_changed product_id=%s action=%s", product.pk, action)
