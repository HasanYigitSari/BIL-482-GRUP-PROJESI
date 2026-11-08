from django.urls import include, path

urlpatterns = [
    path("api/v1/auth/", include("api.urls")),
    path("api/v1/", include("api.inventory.urls")),
]
