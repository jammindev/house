import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory
from insurance.models import InsuranceContract


class ImportSupabaseInsuranceContractsCommandTests(TestCase):
    def setUp(self):
        self.target_household_id = "ff28b251-8abc-400a-8bdc-8303b2086d70"
        if not HouseholdFactory._meta.model.objects.filter(id=self.target_household_id).exists():
            HouseholdFactory(id=self.target_household_id, name="Target household")

        user_model = get_user_model()
        user_model.objects.get_or_create(
            id=1,
            defaults={
                "email": "fallback@example.com",
                "is_active": True,
            },
        )

    @patch("insurance.management.commands.import_supabase_insurance_contracts.Command._fetch_source_rows")
    def test_import_insurance_contracts(self, fetch_source_rows_mock):
        contract_id = uuid.uuid4()
        now = timezone.now()

        fetch_source_rows_mock.return_value = [
            {
                "id": contract_id,
                "household_id": uuid.uuid4(),
                "name": "Home policy",
                "provider": "Insurer",
                "contract_number": "C-001",
                "type": "home",
                "insured_item": "Main house",
                "start_date": None,
                "end_date": None,
                "renewal_date": None,
                "status": "active",
                "payment_frequency": "monthly",
                "monthly_cost": "50.00",
                "yearly_cost": "600.00",
                "coverage_summary": "Fire + water",
                "notes": "Imported",
                "created_at": now,
                "updated_at": now,
                "created_by": None,
                "updated_by": None,
            }
        ]

        call_command(
            "import_supabase_insurance_contracts",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        contract = InsuranceContract.objects.get(id=contract_id)
        self.assertEqual(contract.household_id, uuid.UUID(self.target_household_id))
        self.assertEqual(contract.name, "Home policy")
        self.assertEqual(contract.type, InsuranceContract.InsuranceType.HOME)
        self.assertEqual(contract.payment_frequency, InsuranceContract.PaymentFrequency.MONTHLY)
        self.assertEqual(contract.created_by_id, 1)

    @patch("insurance.management.commands.import_supabase_insurance_contracts.Command._fetch_source_rows")
    def test_idempotent_update(self, fetch_source_rows_mock):
        contract_id = uuid.uuid4()

        InsuranceContract.objects.create(
            id=contract_id,
            household_id=self.target_household_id,
            name="Old name",
            provider="",
            contract_number="",
            type=InsuranceContract.InsuranceType.OTHER,
            insured_item="",
            status=InsuranceContract.InsuranceStatus.ACTIVE,
            payment_frequency=InsuranceContract.PaymentFrequency.MONTHLY,
            monthly_cost=0,
            yearly_cost=0,
            coverage_summary="",
            notes="",
            created_by_id=1,
            updated_by_id=1,
        )

        fetch_source_rows_mock.return_value = [
            {
                "id": contract_id,
                "household_id": self.target_household_id,
                "name": "Updated name",
                "provider": "Updated provider",
                "contract_number": "C-100",
                "type": "liability",
                "insured_item": "Item",
                "start_date": None,
                "end_date": None,
                "renewal_date": None,
                "status": "suspended",
                "payment_frequency": "yearly",
                "monthly_cost": "0",
                "yearly_cost": "120.00",
                "coverage_summary": "Summary",
                "notes": "Updated",
                "created_at": None,
                "updated_at": None,
                "created_by": None,
                "updated_by": None,
            }
        ]

        call_command(
            "import_supabase_insurance_contracts",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        self.assertEqual(InsuranceContract.objects.filter(id=contract_id).count(), 1)
        contract = InsuranceContract.objects.get(id=contract_id)
        self.assertEqual(contract.name, "Updated name")
        self.assertEqual(contract.provider, "Updated provider")
        self.assertEqual(contract.type, InsuranceContract.InsuranceType.LIABILITY)
        self.assertEqual(contract.status, InsuranceContract.InsuranceStatus.SUSPENDED)
        self.assertEqual(contract.payment_frequency, InsuranceContract.PaymentFrequency.YEARLY)
