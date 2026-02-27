from rest_framework import serializers

from .models import IncomingEmail, IncomingEmailAttachment


class IncomingEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomingEmail
        fields = [
            "id",
            "household",
            "message_id",
            "from_email",
            "from_name",
            "to_email",
            "subject",
            "body_text",
            "body_html",
            "processing_status",
            "processing_error",
            "interaction",
            "metadata",
            "received_at",
            "processed_at",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by"]


class IncomingEmailAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncomingEmailAttachment
        fields = [
            "id",
            "incoming_email",
            "filename",
            "content_type",
            "size_bytes",
            "content_base64",
            "document",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
