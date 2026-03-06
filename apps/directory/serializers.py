from rest_framework import serializers

from .models import Contact, Address, Email, Phone, Structure


class StructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Structure
        fields = [
            "id",
            "household",
            "name",
            "type",
            "description",
            "website",
            "tags",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = [
            "id",
            "household",
            "structure",
            "first_name",
            "last_name",
            "position",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]


# ── Nested serializers (for list/retrieve) ─────────────────────────────────

class ContactStructureSerializer(serializers.ModelSerializer):
    """Minimal structure embed used inside ContactNestedSerializer."""
    class Meta:
        model = Structure
        fields = ["id", "name", "type"]


class EmailNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Email
        fields = ["id", "email", "label", "is_primary"]


class PhoneNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Phone
        fields = ["id", "phone", "label", "is_primary"]


class AddressNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "address_1", "address_2", "zipcode", "city", "country", "label", "is_primary"]


class ContactNestedSerializer(serializers.ModelSerializer):
    structure = ContactStructureSerializer(read_only=True)
    emails = EmailNestedSerializer(many=True, read_only=True)
    phones = PhoneNestedSerializer(many=True, read_only=True)
    addresses = AddressNestedSerializer(many=True, read_only=True)

    class Meta:
        model = Contact
        fields = [
            "id",
            "household",
            "structure",
            "first_name",
            "last_name",
            "position",
            "notes",
            "emails",
            "phones",
            "addresses",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StructureNestedSerializer(serializers.ModelSerializer):
    emails = EmailNestedSerializer(many=True, read_only=True)
    phones = PhoneNestedSerializer(many=True, read_only=True)
    addresses = AddressNestedSerializer(many=True, read_only=True)

    class Meta:
        model = Structure
        fields = [
            "id",
            "household",
            "name",
            "type",
            "description",
            "website",
            "tags",
            "emails",
            "phones",
            "addresses",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            "id",
            "household",
            "contact",
            "structure",
            "address_1",
            "address_2",
            "zipcode",
            "city",
            "country",
            "label",
            "is_primary",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]


class EmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Email
        fields = [
            "id",
            "household",
            "contact",
            "structure",
            "email",
            "label",
            "is_primary",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]


class PhoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Phone
        fields = [
            "id",
            "household",
            "contact",
            "structure",
            "phone",
            "label",
            "is_primary",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]
