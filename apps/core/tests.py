from types import SimpleNamespace

import pytest
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from accounts.models import User
from core.managers import HouseholdScopedManager
from core.models import HouseholdScopedModel
from core.permissions import (
	CanViewPrivateContent,
	IsHouseholdMember,
	IsHouseholdOwner,
	resolve_request_household,
)
from households.models import Household, HouseholdMember
from zones.models import Zone


def _create_user(email: str) -> User:
	return User.objects.create_user(email=email, password="testpass123")


def _create_household(name: str) -> Household:
	return Household.objects.create(name=name)


def _add_membership(user: User, household: Household, role: str = HouseholdMember.Role.MEMBER):
	return HouseholdMember.objects.create(user=user, household=household, role=role)


def _make_request(method: str, path: str, user: User | None = None, data: dict | None = None, **extra):
	factory = APIRequestFactory()
	raw_request = getattr(factory, method.lower())(path, data=data, format="json", **extra)
	if user is not None:
		force_authenticate(raw_request, user=user)
	return APIView().initialize_request(raw_request)


@pytest.mark.django_db
class TestResolveRequestHousehold:
	def test_returns_none_for_unauthenticated_user(self):
		request = _make_request("get", "/api/test/")

		assert resolve_request_household(request) is None

	def test_prefers_explicit_header_household(self):
		user = _create_user("header@example.com")
		household = _create_household("Header Household")
		_add_membership(user, household)

		request = _make_request(
			"get",
			"/api/test/?household_id=ignored",
			user=user,
			HTTP_X_HOUSEHOLD_ID=str(household.id),
		)

		assert resolve_request_household(request) == household

	def test_query_param_is_used_when_no_header_exists(self):
		user = _create_user("query@example.com")
		household = _create_household("Query Household")
		_add_membership(user, household)

		request = _make_request("get", f"/api/test/?household_id={household.id}", user=user)

		assert resolve_request_household(request) == household

	def test_body_household_id_is_used_for_post_requests(self):
		user = _create_user("body@example.com")
		household = _create_household("Body Household")
		_add_membership(user, household)

		request = _make_request("post", "/api/test/", user=user, data={"household_id": str(household.id)})

		assert resolve_request_household(request) == household

	def test_body_household_alias_is_supported(self):
		user = _create_user("body-alias@example.com")
		household = _create_household("Body Alias Household")
		_add_membership(user, household)

		request = _make_request("post", "/api/test/", user=user, data={"household": str(household.id)})

		assert resolve_request_household(request) == household

	def test_active_household_is_used_when_no_explicit_context_exists(self):
		user = _create_user("active@example.com")
		household = _create_household("Active Household")
		_add_membership(user, household)
		user.active_household = household
		user.save(update_fields=["active_household"])

		request = _make_request("get", "/api/test/", user=user)

		assert resolve_request_household(request) == household

	def test_single_membership_auto_selects_household(self):
		user = _create_user("single@example.com")
		household = _create_household("Single Household")
		_add_membership(user, household)

		request = _make_request("get", "/api/test/", user=user)

		assert resolve_request_household(request) == household

	def test_multiple_memberships_without_active_household_returns_none(self):
		user = _create_user("multi@example.com")
		_add_membership(user, _create_household("Household A"))
		_add_membership(user, _create_household("Household B"))
		user.active_household = None
		user.save(update_fields=["active_household"])

		request = _make_request("get", "/api/test/", user=user)

		assert resolve_request_household(request) is None

	def test_explicit_non_member_household_returns_none(self):
		user = _create_user("outsider@example.com")
		household = _create_household("Forbidden Household")

		request = _make_request(
			"get",
			"/api/test/",
			user=user,
			HTTP_X_HOUSEHOLD_ID=str(household.id),
		)

		assert resolve_request_household(request, required=True) is None


@pytest.mark.django_db
class TestHouseholdPermissions:
	def test_is_household_member_requires_authentication(self):
		permission = IsHouseholdMember()
		request = _make_request("get", "/api/test/")

		assert permission.has_permission(request, view=None) is False

	def test_is_household_member_allows_authenticated_request_without_explicit_household(self):
		user = _create_user("member-open@example.com")
		permission = IsHouseholdMember()
		request = _make_request("get", "/api/test/", user=user)

		assert permission.has_permission(request, view=None) is True

	def test_is_household_member_validates_explicit_household_membership(self):
		user = _create_user("member@example.com")
		household = _create_household("Member Household")
		_add_membership(user, household)
		permission = IsHouseholdMember()
		request = _make_request("get", "/api/test/", user=user, HTTP_X_HOUSEHOLD_ID=str(household.id))

		assert permission.has_permission(request, view=None) is True

	def test_is_household_member_rejects_non_member_household(self):
		user = _create_user("member-reject@example.com")
		household = _create_household("Non Member Household")
		permission = IsHouseholdMember()
		request = _make_request("get", "/api/test/", user=user, HTTP_X_HOUSEHOLD_ID=str(household.id))

		assert permission.has_permission(request, view=None) is False

	def test_is_household_member_checks_object_household_id(self):
		user = _create_user("object-member@example.com")
		household = _create_household("Object Household")
		_add_membership(user, household)
		permission = IsHouseholdMember()
		request = _make_request("get", "/api/test/", user=user)
		obj = SimpleNamespace(household_id=household.id)

		assert permission.has_object_permission(request, view=None, obj=obj) is True

	def test_is_household_member_supports_household_objects(self):
		user = _create_user("object-household@example.com")
		household = _create_household("Direct Household")
		_add_membership(user, household)
		permission = IsHouseholdMember()
		request = _make_request("get", "/api/test/", user=user)

		assert permission.has_object_permission(request, view=None, obj=household) is True

	def test_is_household_owner_checks_role(self):
		owner = _create_user("owner@example.com")
		member = _create_user("member-owner-check@example.com")
		household = _create_household("Owner Household")
		_add_membership(owner, household, role=HouseholdMember.Role.OWNER)
		_add_membership(member, household, role=HouseholdMember.Role.MEMBER)
		permission = IsHouseholdOwner()
		owner_request = _make_request("get", "/api/test/", user=owner, HTTP_X_HOUSEHOLD_ID=str(household.id))
		member_request = _make_request("get", "/api/test/", user=member, HTTP_X_HOUSEHOLD_ID=str(household.id))

		assert permission.has_permission(owner_request, view=None) is True
		assert permission.has_permission(member_request, view=None) is False

	def test_is_household_owner_checks_object_permission(self):
		owner = _create_user("owner-object@example.com")
		household = _create_household("Owner Object Household")
		_add_membership(owner, household, role=HouseholdMember.Role.OWNER)
		permission = IsHouseholdOwner()
		request = _make_request("get", "/api/test/", user=owner)
		obj = SimpleNamespace(household_id=household.id)

		assert permission.has_object_permission(request, view=None, obj=obj) is True


class TestCanViewPrivateContent:
	def test_public_content_is_visible(self):
		permission = CanViewPrivateContent()
		request = SimpleNamespace(user=SimpleNamespace(id=1))
		obj = SimpleNamespace(is_private=False, created_by_id=2)

		assert permission.has_object_permission(request, view=None, obj=obj) is True

	def test_private_content_is_visible_to_creator_only(self):
		permission = CanViewPrivateContent()
		creator_request = SimpleNamespace(user=SimpleNamespace(id=1))
		other_request = SimpleNamespace(user=SimpleNamespace(id=2))
		obj = SimpleNamespace(is_private=True, created_by_id=1)

		assert permission.has_object_permission(creator_request, view=None, obj=obj) is True
		assert permission.has_object_permission(other_request, view=None, obj=obj) is False

	def test_objects_without_privacy_flag_are_visible(self):
		permission = CanViewPrivateContent()
		request = SimpleNamespace(user=SimpleNamespace(id=1))
		obj = SimpleNamespace(created_by_id=2)

		assert permission.has_object_permission(request, view=None, obj=obj) is True


@pytest.mark.django_db
class TestHouseholdScopedInfrastructure:
	def test_household_scoped_model_requires_household_before_save(self):
		zone = Zone(name="No Household")

		with pytest.raises(ValueError, match="Zone requires household"):
			zone.save()

	def test_household_scoped_manager_filters_single_household(self):
		user = _create_user("manager-household@example.com")
		household_a = _create_household("Household Manager A")
		household_b = _create_household("Household Manager B")
		zone_a = Zone.objects.create(household=household_a, name="Kitchen", created_by=user)
		Zone.objects.create(household=household_b, name="Garage", created_by=user)

		result = list(Zone.objects.for_household(household_a.id))

		# Filtre OK : zone Kitchen + racine 'Maison' auto-créée pour household_a uniquement.
		assert zone_a in result
		assert all(z.household_id == household_a.id for z in result)

	def test_household_scoped_manager_filters_user_memberships(self):
		user = _create_user("manager-user@example.com")
		other_user = _create_user("manager-other@example.com")
		household_a = _create_household("Household User A")
		household_b = _create_household("Household User B")
		_add_membership(user, household_a)
		_add_membership(other_user, household_b)
		zone_a = Zone.objects.create(household=household_a, name="Office", created_by=user)
		Zone.objects.create(household=household_b, name="Workshop", created_by=other_user)

		result = list(Zone.objects.for_user_households(user))

		# Filtré sur household_a uniquement (zone Office + racine 'Maison' auto-créée).
		assert zone_a in result
		assert all(z.household_id == household_a.id for z in result)

	def test_household_scoped_manager_uses_custom_queryset(self):
		assert isinstance(Zone.objects, HouseholdScopedManager)
		assert isinstance(Zone.objects.get_queryset(), type(Zone.objects.get_queryset()))

	def test_timestamped_model_populates_audit_fields(self):
		user = _create_user("audit@example.com")
		household = _create_household("Audit Household")
		zone = Zone.objects.create(household=household, name="Audit Zone", created_by=user, updated_by=user)

		assert zone.created_at is not None
		assert zone.updated_at is not None
		assert zone.created_by == user
		assert zone.updated_by == user
