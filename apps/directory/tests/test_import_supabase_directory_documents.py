import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from app_settings.tests.factories import HouseholdFactory
from directory.models import Address, Contact, Email, Phone, Structure
from documents.models import Document


class ImportSupabaseDirectoryDocumentsCommandTests(TestCase):
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

    @patch("directory.management.commands.import_supabase_directory_documents.Command._fetch_source_rows")
    def test_import_structures_contacts_documents(self, fetch_source_rows_mock):
        structure_id = uuid.uuid4()
        contact_id = uuid.uuid4()
        document_id = uuid.uuid4()
        now = timezone.now()

        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": structure_id,
                    "household_id": uuid.uuid4(),
                    "name": " ACME ",
                    "type": None,
                    "description": None,
                    "website": None,
                    "tags": ["pro", "pro", "  "],
                    "created_at": now,
                    "updated_at": now,
                    "created_by": str(uuid.uuid4()),
                    "updated_by": None,
                }
            ],
            [
                {
                    "id": contact_id,
                    "household_id": uuid.uuid4(),
                    "structure_id": structure_id,
                    "first_name": "John",
                    "last_name": "Doe",
                    "position": None,
                    "notes": None,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
            [
                {
                    "id": document_id,
                    "household_id": uuid.uuid4(),
                    "file_path": "/tmp/x.pdf",
                    "mime_type": "application/pdf",
                    "ocr_text": None,
                    "metadata": None,
                    "created_at": now,
                    "created_by": None,
                    "type": "unknown",
                    "name": "Doc",
                    "notes": None,
                }
            ],
            [
                {
                    "id": uuid.uuid4(),
                    "household_id": uuid.uuid4(),
                    "contact_id": contact_id,
                    "structure_id": None,
                    "address_1": "Street",
                    "address_2": "",
                    "zipcode": "1000",
                    "city": "Brussels",
                    "country": "BE",
                    "label": "home",
                    "is_primary": True,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
            [
                {
                    "id": uuid.uuid4(),
                    "household_id": uuid.uuid4(),
                    "contact_id": contact_id,
                    "structure_id": None,
                    "email": "john@example.com",
                    "label": "work",
                    "is_primary": True,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
            [
                {
                    "id": uuid.uuid4(),
                    "household_id": uuid.uuid4(),
                    "contact_id": contact_id,
                    "structure_id": None,
                    "phone": "+32123456",
                    "label": "mobile",
                    "is_primary": True,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
        ]

        call_command(
            "import_supabase_directory_documents",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        structure = Structure.objects.get(id=structure_id)
        self.assertEqual(str(structure.household_id), self.target_household_id)
        self.assertEqual(structure.name, "ACME")
        self.assertEqual(structure.tags, ["pro"])
        self.assertEqual(structure.created_by_id, 1)
        self.assertEqual(structure.updated_by_id, 1)

        contact = Contact.objects.get(id=contact_id)
        self.assertEqual(str(contact.household_id), self.target_household_id)
        self.assertEqual(contact.structure_id, structure_id)
        self.assertEqual(contact.created_by_id, 1)
        self.assertEqual(contact.updated_by_id, 1)

        doc = Document.objects.get(metadata__supabase_document_id=str(document_id))
        self.assertEqual(str(doc.household_id), self.target_household_id)
        self.assertEqual(doc.type, "document")
        self.assertIsInstance(doc.metadata, dict)
        self.assertEqual(doc.created_by_id, 1)
        self.assertEqual(doc.updated_by_id, 1)
        self.assertEqual(doc.metadata.get("supabase_document_id"), str(document_id))
        self.assertEqual(Address.objects.filter(household_id=self.target_household_id).count(), 1)
        self.assertEqual(Email.objects.filter(household_id=self.target_household_id).count(), 1)
        self.assertEqual(Phone.objects.filter(household_id=self.target_household_id).count(), 1)

    @patch("directory.management.commands.import_supabase_directory_documents.Command._fetch_source_rows")
    def test_idempotent_update(self, fetch_source_rows_mock):
        structure_id = uuid.uuid4()
        now = timezone.now()

        Structure.objects.create(
            id=structure_id,
            household_id=self.target_household_id,
            name="Initial",
            type="",
            description="",
            website="",
            tags=[],
            created_by_id=1,
            updated_by_id=1,
        )

        fetch_source_rows_mock.side_effect = [
            [
                {
                    "id": structure_id,
                    "household_id": uuid.uuid4(),
                    "name": "Updated",
                    "type": "supplier",
                    "description": "desc",
                    "website": "https://example.com",
                    "tags": ["a"],
                    "created_at": now,
                    "updated_at": now,
                    "created_by": None,
                    "updated_by": None,
                }
            ],
            [],
            [],
            [],
            [],
            [],
        ]

        call_command(
            "import_supabase_directory_documents",
            "--supabase-dsn",
            "postgresql://example",
            "--target-household-id",
            self.target_household_id,
            "--fallback-user-id",
            "1",
        )

        structure = Structure.objects.get(id=structure_id)
        self.assertEqual(structure.name, "Updated")
        self.assertEqual(structure.type, "supplier")
        self.assertEqual(structure.description, "desc")
        self.assertEqual(structure.website, "https://example.com")
        self.assertEqual(structure.tags, ["a"])
