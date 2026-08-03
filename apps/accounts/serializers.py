from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from accounts.models import DeviceToken

from households.modules import PINNABLE_MODULES

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    # What a user may change about themselves through `/users/me/`. Declared
    # here rather than in the view so it sits beside the `validate_*` methods
    # that police the very same fields — one place to add a preference to, and
    # one place a reviewer checks that `is_staff` is not in.
    SELF_EDITABLE_FIELDS = frozenset({
        "display_name", "locale", "theme", "color_theme", "email",
        "agent_memory_enabled", "pinned_modules", "completed_tutorials",
        "digest_disabled_sections", "recap_disabled_chapters",
        "muted_notification_types",
    })

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
            "digest_disabled_sections",
            "recap_disabled_chapters",
            "muted_notification_types",
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

    def validate_muted_notification_types(self, value):
        # Refused rather than ignored: silently dropping an unmutable type would
        # leave the user's screen showing a checkbox they think they ticked, and
        # believing they muted an invitation is worse than being told they can't.
        if not isinstance(value, list) or not all(isinstance(k, str) for k in value):
            raise serializers.ValidationError(_("Expected a list of notification types."))
        from notifications.models import MUTABLE_TYPES

        unknown = [k for k in value if k not in MUTABLE_TYPES]
        if unknown:
            raise serializers.ValidationError(
                _("Notification type(s) cannot be muted: %(keys)s")
                % {'keys': ', '.join(sorted(unknown))}
            )
        return list(dict.fromkeys(value))

    def validate_digest_disabled_sections(self, value):
        # Section keys live in agent.digest.collectors — validate against them
        # so a typo can't silently disable nothing. Lazy import avoids pulling
        # the agent app at serializer import time.
        if not isinstance(value, list) or not all(isinstance(k, str) for k in value):
            raise serializers.ValidationError(_("Expected a list of section keys."))
        from agent.digest.collectors import SECTION_KEYS

        unknown = [k for k in value if k not in SECTION_KEYS]
        if unknown:
            raise serializers.ValidationError(
                _("Unknown digest section(s): %(keys)s") % {'keys': ', '.join(sorted(unknown))}
            )
        return list(dict.fromkeys(value))

    def validate_recap_disabled_chapters(self, value):
        # Chapter keys live in recap.chapters — validate against them so a typo
        # can't silently mute nothing. Lazy import, same reason as above.
        if not isinstance(value, list) or not all(isinstance(k, str) for k in value):
            raise serializers.ValidationError(_("Expected a list of chapter keys."))
        from recap.chapters import CHAPTER_KEYS

        unknown = [k for k in value if k not in CHAPTER_KEYS]
        if unknown:
            raise serializers.ValidationError(
                _("Unknown recap chapter(s): %(keys)s") % {'keys': ', '.join(sorted(unknown))}
            )
        return list(dict.fromkeys(value))

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


class DeviceTokenSerializer(serializers.ModelSerializer):
    """Un jeton d'appareil, **sans son secret** — il n'existe qu'à l'émission."""

    is_revoked = serializers.BooleanField(read_only=True)

    class Meta:
        model = DeviceToken
        fields = ["id", "name", "created_at", "last_used_at", "revoked_at", "is_revoked"]
        read_only_fields = ["id", "created_at", "last_used_at", "revoked_at", "is_revoked"]


class DeviceTokenIssuedSerializer(DeviceTokenSerializer):
    """La réponse de création — la **seule** occasion de lire le secret.

    Il n'est pas stocké en clair : ne pas le copier ici revient à devoir en émettre
    un autre. Le dire à l'écran fait partie du mécanisme.
    """

    token = serializers.CharField(read_only=True)

    class Meta(DeviceTokenSerializer.Meta):
        fields = DeviceTokenSerializer.Meta.fields + ["token"]
