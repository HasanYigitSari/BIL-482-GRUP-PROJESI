from django.urls import path

from .views import DemoInventoryView, OrdersView, ProductsView


urlpatterns = [
    path("products/", ProductsView.as_view()),
    path("orders/", OrdersView.as_view()),
    path("demo/inventory/", DemoInventoryView.as_view()),
]
