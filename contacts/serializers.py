from rest_framework import serializers

from .models import Contact, Address, Email, Phone


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
