"""Banking API routes."""
from rest_framework.routers import DefaultRouter

from .views import BankAccountViewSet, StatementImportViewSet

router = DefaultRouter()
router.register(r"accounts", BankAccountViewSet, basename="bank-account")
router.register(r"imports", StatementImportViewSet, basename="statement-import")

urlpatterns = router.urls
