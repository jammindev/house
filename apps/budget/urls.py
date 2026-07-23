"""Budget API routes."""
from rest_framework.routers import DefaultRouter

from .views import BudgetViewSet, RecurringExpenseViewSet

router = DefaultRouter()
router.register(r"budgets", BudgetViewSet, basename="budget")
router.register(r"recurring", RecurringExpenseViewSet, basename="recurring")

urlpatterns = router.urls
