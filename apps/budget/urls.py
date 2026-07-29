"""Budget API routes."""
from rest_framework.routers import DefaultRouter

from .views import (
    BudgetCategoryViewSet,
    BudgetReportViewSet,
    BudgetViewSet,
    RecurringExpenseViewSet,
)

router = DefaultRouter()
router.register(r"budgets", BudgetViewSet, basename="budget")
router.register(r"categories", BudgetCategoryViewSet, basename="budget-category")
router.register(r"recurring", RecurringExpenseViewSet, basename="recurring")
router.register(r"reports", BudgetReportViewSet, basename="budget-report")

urlpatterns = router.urls
