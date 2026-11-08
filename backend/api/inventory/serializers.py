from rest_framework import serializers

from api.models import AcquisitionJob, Order, Product
from .services import ERROR_MESSAGES, available_items


class ProductSerializer(serializers.ModelSerializer):
    available_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "code", "name", "available_count"]

    def get_available_count(self, product):
        return available_items(product).count()


class PlaceOrderSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    request_id = serializers.UUIDField()


class OrderSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ["id", "product_id", "product_name", "status", "url", "created_at", "fulfilled_at"]

    def get_url(self, order):
        return order.item.url if order.status == Order.Status.FULFILLED and order.item_id else None


class AcquisitionSerializer(serializers.ModelSerializer):
    message = serializers.SerializerMethodField()

    class Meta:
        model = AcquisitionJob
        fields = ["state", "attempts", "retry_at", "error_code", "message", "updated_at"]

    def get_message(self, job):
        return ERROR_MESSAGES.get(job.error_code, "")


class DemoActionSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    action = serializers.ChoiceField(choices=["pause", "resume", "fail_next", "set_target", "retry"])
    target_stock = serializers.IntegerField(min_value=0, max_value=2147483647, required=False)

    def validate(self, attrs):
        if attrs["action"] == "set_target" and "target_stock" not in attrs:
            raise serializers.ValidationError("A target stock value is required.")
        if attrs["action"] != "set_target" and "target_stock" in attrs:
            raise serializers.ValidationError("Target stock is only accepted by set_target.")
        return attrs
