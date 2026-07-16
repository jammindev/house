from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from households.modules import PINNABLE_MODULES

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    full_name = serializers.ReadOnlyField()
    # Instance-level capability gate for the agent's web search: True only when the
    # deployment enabled it (settings.AGENT_WEB_SEARCH_ENABLED, which also implies a
    # Sonnet 4.6+ model). The frontend hides the per-conversation toggle when this
    # is False so it never shows an inert control on a Haiku deployment.
    agent_web_search_available = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "locale",
            "avatar",
            "theme",
            "color_theme",
            "pinned_modules",
            "completed_tutorials",
            "agent_memory_enabled",
            "agent_web_search_available",
            "full_name",
            "password",
            "is_active",
            "is_staff",
            "date_joined",
        ]
        read_only_fields = [
            "id",
            "is_active",
            "is_staff",
            "date_joined",
            "full_name",
            "agent_web_search_available",
        ]

    def get_agent_web_search_available(self, obj) -> bool:
        return bool(getattr(settings, "AGENT_WEB_SEARCH_ENABLED", False))

    def validate_pinned_modules(self, value):
        if not isinstance(value, list) or not all(isinstance(k, str) for k in value):
            raise serializers.ValidationError(_("Expected a list of module keys."))
        unknown = [k for k in value if k not in PINNABLE_MODULES]
        if unknown:
            raise serializers.ValidationError(
                _("Module(s) not pinnable: %(keys)s") % {'keys': ', '.join(sorted(unknown))}
            )
        return list(dict.fromkeys(value))

    def validate_completed_tutorials(self, value):
        # Keys live in the frontend tutorial registry, which evolves with the
        # app — only the shape is enforced here so shipping a new guide never
        # requires a backend change.
        if not isinstance(value, list) or not all(isinstance(k, str) for k in value):
            raise serializers.ValidationError(_("Expected a list of tutorial keys."))
        if any(len(k) > 100 for k in value):
            raise serializers.ValidationError(_("Tutorial key too long."))
        deduped = list(dict.fromkeys(value))
        if len(deduped) > 500:
            raise serializers.ValidationError(_("Too many tutorial keys."))
        return deduped

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
