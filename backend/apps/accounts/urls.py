from django.urls import path

from . import views

urlpatterns = [
    path("register", views.RegisterView.as_view(), name="auth-register"),
    path("login", views.LoginView.as_view(), name="auth-login"),
    path("me", views.MeView.as_view(), name="auth-me"),
    path("profile", views.ProfileView.as_view(), name="auth-profile"),
    path("topics", views.TopicCatalogView.as_view(), name="auth-topics"),
    path("logout", views.LogoutView.as_view(), name="auth-logout"),
    path("google", views.GoogleOAuthView.as_view(), name="auth-google"),
    path("avatar-upload-url", views.AvatarUploadURLView.as_view(), name="auth-avatar-upload-url"),
]
