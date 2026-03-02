"""
Households serializers.
"""
from rest_framework import serializers
from .models import Household, HouseholdMember, HouseholdInvitation


class HouseholdMemberSerializer(serializers.ModelSerializer):
    """Serializer for household members."""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_display_name = serializers.CharField(source='user.display_name', read_only=True)

    class Meta:
        model = HouseholdMember
        fields = ['household', 'user', 'user_email', 'user_display_name', 'role']
        read_only_fields = ['household', 'user']


class HouseholdSerializer(serializers.ModelSerializer):
    """Serializer for households."""
    members_count = serializers.SerializerMethodField()
    current_user_role = serializers.SerializerMethodField()
    members = HouseholdMemberSerializer(source='householdmember_set', many=True, read_only=True)

    class Meta:
        model = Household
        fields = [
            'id', 'name', 'created_at', 'address', 'city', 'postal_code', 'country', 'timezone',
            'context_notes', 'ai_prompt_context', 'inbound_email_alias',
            'members_count', 'current_user_role', 'members', 'archived_at'
        ]
        read_only_fields = ['id', 'created_at', 'inbound_email_alias', 'archived_at']

    def get_members_count(self, obj):
        return obj.householdmember_set.count()

    def get_current_user_role(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or user.is_anonymous:
            return None

        membership = obj.householdmember_set.filter(user=user).first()
        return membership.role if membership else None


class HouseholdDetailSerializer(HouseholdSerializer):
    """Detailed serializer with members list."""
    class Meta(HouseholdSerializer.Meta):
        fields = HouseholdSerializer.Meta.fields


class HouseholdInvitationSerializer(serializers.ModelSerializer):
    """Serializer for pending household invitations (user-facing)."""
    household_name = serializers.CharField(source='household.name', read_only=True)
    invited_by_name = serializers.SerializerMethodField()

    class Meta:
        model = HouseholdInvitation
        fields = ['id', 'household', 'household_name', 'invited_by_name', 'role', 'status', 'created_at']
        read_only_fields = fields

    def get_invited_by_name(self, obj):
        if obj.invited_by:
            return obj.invited_by.display_name or obj.invited_by.email
        return None
