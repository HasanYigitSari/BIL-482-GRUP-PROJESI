from django.conf import settings
from django.http import Http404
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models import AcquisitionJob, MockProviderControl, Order, Product
from . import services
from .serializers import AcquisitionSerializer, DemoActionSerializer, OrderSerializer, PlaceOrderSerializer, ProductSerializer


class InventoryView(APIView):
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response


class ProductsView(InventoryView):
    def get(self, request):
        return Response({"products": ProductSerializer(Product.objects.order_by("id"), many=True).data})


class OrderPagination(PageNumberPagination):
    page_size = 20


class OrdersView(InventoryView):
    def get(self, request):
        orders = Order.objects.filter(user=request.user).select_related("product", "item").order_by("-created_at", "-id")
        paginator = OrderPagination()
        page = paginator.paginate_queryset(orders, request)
        return paginator.get_paginated_response(OrderSerializer(page, many=True).data)

    def post(self, request):
        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order, created = services.place_order(request.user, **serializer.validated_data)
        return Response({"order": OrderSerializer(order).data}, status=201 if created else 200)


class DemoInventoryView(InventoryView):
    def initial(self, request, *args, **kwargs):
        # Hide the entire endpoint outside explicit local development, even anonymously.
        if not settings.LOCAL_DEVELOPMENT:
            raise Http404
        super().initial(request, *args, **kwargs)

    def snapshot(self):
        control = MockProviderControl.objects.get(pk=1)
        products = []
        for product in Product.objects.order_by("id"):
            job = AcquisitionJob.objects.filter(product=product).exclude(state=AcquisitionJob.State.SUCCEEDED).first()
            products.append({
                "id": product.pk, "name": product.name, "target_stock": product.target_stock,
                "available_count": services.available_items(product).count(),
                "pending_count": Order.objects.filter(product=product, status=Order.Status.PENDING).count(),
                "fulfilled_count": Order.objects.filter(product=product, status=Order.Status.FULFILLED).count(),
                "acquisition": AcquisitionSerializer(job).data if job else None,
            })
        return {"paused": control.paused, "fail_next": control.fail_next, "products": products}

    def get(self, request):
        return Response(self.snapshot())

    def post(self, request):
        serializer = DemoActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.update_demo(**serializer.validated_data)
        return Response(self.snapshot())
