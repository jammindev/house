"""Banking API routes."""
from rest_framework.routers import DefaultRouter

from .views import BankAccountViewSet, BankTransactionViewSet, StatementImportViewSet

router = DefaultRouter()
router.register(r"accounts", BankAccountViewSet, basename="bank-account")
router.register(r"imports", StatementImportViewSet, basename="statement-import")
router.register(r"transactions", BankTransactionViewSet, basename="bank-transaction")

urlpatterns = router.urls
