"""Custom permissions for household access control."""
from rest_framework import permissions


class IsHouseholdMember(permissions.BasePermission):
    """
    Permission to check if user is a member of the household.
    """
    message = "You must be a member of this household to perform this action."

    def has_object_permission(self, request, view, obj):
        # Check if user is a member of this household
        return obj.members.filter(user=request.user).exists()


class IsHouseholdOwner(permissions.BasePermission):
    """
    Permission to check if user is an owner of the household.
    """
    message = "You must be an owner of this household to perform this action."

    def has_object_permission(self, request, view, obj):
        # Check if user is an owner of this household
        return obj.members.filter(user=request.user, role='owner').exists()


class IsHouseholdOwnerOrReadOnly(permissions.BasePermission):
    """
    Permission to check if user is an owner for write operations,
    or just a member for read operations.
    """
    message = "You must be an owner of this household to modify it."

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed for any member
        if request.method in permissions.SAFE_METHODS:
            return obj.members.filter(user=request.user).exists()
        
        # Write permissions require owner role
        return obj.members.filter(user=request.user, role='owner').exists()
