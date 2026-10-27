from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.authors.views import AuthorViewSet
from apps.awards.views import AwardViewSet
from apps.books.views import BookViewSet
from apps.loans.views import LoanViewSet, ReservationViewSet, UserBookViewSet
from apps.reviews.views import ReviewCommentViewSet, ReviewViewSet
from apps.sagas.views import SagaViewSet
from apps.users.views import GoogleLogin, UserViewSet

router = DefaultRouter()
router.register("books", BookViewSet, basename="book")
router.register("authors", AuthorViewSet, basename="author")
router.register("sagas", SagaViewSet, basename="saga")
router.register("awards", AwardViewSet, basename="award")
router.register("reviews", ReviewViewSet, basename="review")
router.register("review-comments", ReviewCommentViewSet, basename="review-comment")
router.register("user-books", UserBookViewSet, basename="user-book")
router.register("loans", LoanViewSet, basename="loan")
router.register("reservations", ReservationViewSet, basename="reservation")
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/google/", GoogleLogin.as_view(), name="google_login"),
    path("api/auth/registration/", include("dj_rest_auth.registration.urls")),
    path("api/auth/", include("dj_rest_auth.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/", include(router.urls)),
]
