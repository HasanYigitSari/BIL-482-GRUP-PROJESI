from django.urls import path

from .views import CsrfView, LogoutView, MeView, SigninBeginView, SigninCompleteView, SignupBeginView, SignupCompleteView


urlpatterns = [
    path("csrf/", CsrfView.as_view()),
    path("me/", MeView.as_view()),
    path("signup/begin/", SignupBeginView.as_view()),
    path("signup/complete/", SignupCompleteView.as_view()),
    path("signin/begin/", SigninBeginView.as_view()),
    path("signin/complete/", SigninCompleteView.as_view()),
    path("logout/", LogoutView.as_view()),
]
