"""Banking API routes."""
from rest_framework.routers import DefaultRouter

from .views import BankAccountViewSet

router = DefaultRouter()
router.register(r"accounts", BankAccountViewSet, basename="bank-account")

urlpatterns = router.urls
