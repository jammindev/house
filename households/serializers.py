"""
Households serializers.
"""
from rest_framework import serializers
from .models import Household, HouseholdMember


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

    class Meta:
        model = Household
        fields = [
            'id', 'name', 'created_at', 'address', 'city', 'country',
            'context_notes', 'ai_prompt_context', 'inbound_email_alias',
            'default_household', 'members_count'
        ]
        read_only_fields = ['id', 'created_at', 'inbound_email_alias']

    def get_members_count(self, obj):
        return obj.householdmember_set.count()


class HouseholdDetailSerializer(HouseholdSerializer):
    """Detailed serializer with members list."""
    members = HouseholdMemberSerializer(source='householdmember_set', many=True, read_only=True)

    class Meta(HouseholdSerializer.Meta):
        fields = HouseholdSerializer.Meta.fields + ['members']
