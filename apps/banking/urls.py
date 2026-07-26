"""Banking API routes."""
from rest_framework.routers import DefaultRouter

from .views import (
    BankAccountViewSet,
    BankTransactionViewSet,
    ComplianceViewSet,
    ComplianceWaiverViewSet,
    StatementImportViewSet,
)

router = DefaultRouter()
router.register(r"accounts", BankAccountViewSet, basename="bank-account")
router.register(r"imports", StatementImportViewSet, basename="statement-import")
router.register(r"transactions", BankTransactionViewSet, basename="bank-transaction")
# ``compliance`` is addressed by detector kind, not by pk — hence the slug lookup.
router.register(
    r"compliance", ComplianceViewSet, basename="banking-compliance"
)
router.register(r"waivers", ComplianceWaiverViewSet, basename="compliance-waiver")

urlpatterns = router.urls
