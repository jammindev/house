from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import Household, HouseholdMember

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "locale",
            "avatar_url",
            "full_name",
            "password",
            "is_active",
            "is_staff",
            "date_joined",
        ]
        read_only_fields = ["id", "is_staff", "date_joined", "full_name"]

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


class HouseholdMemberSerializer(serializers.ModelSerializer):
    """Serializer for household member with user details."""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_display_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = HouseholdMember
        fields = ['id', 'household', 'user', 'user_email', 'user_display_name', 'role', 'joined_at']
        read_only_fields = ['id', 'joined_at', 'user_email', 'user_display_name']


class HouseholdSerializer(serializers.ModelSerializer):
    """Serializer for household with optional member details."""
    members = HouseholdMemberSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Household
        fields = [
            'id',
            'name',
            'created_at',
            'address',
            'city',
            'country',
            'context_notes',
            'ai_prompt_context',
            'inbound_email_alias',
            'default_household',
            'members',
            'member_count',
            'user_role',
        ]
        read_only_fields = ['id', 'created_at', 'members', 'member_count', 'user_role']

    def get_member_count(self, obj):
        """Return count of household members."""
        return obj.members.count()

    def get_user_role(self, obj):
        """Return the current user's role in this household."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.members.filter(user=request.user).first()
            return membership.role if membership else None
        return None


class HouseholdListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing households without members."""
    member_count = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Household
        fields = [
            'id',
            'name',
            'created_at',
            'city',
            'country',
            'member_count',
            'user_role',
        ]
        read_only_fields = ['id', 'created_at', 'member_count', 'user_role']

    def get_member_count(self, obj):
        return obj.members.count()

    def get_user_role(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.members.filter(user=request.user).first()
            return membership.role if membership else None
        return None
