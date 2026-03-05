import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField

from core.models import HouseholdScopedModel
from core.managers import HouseholdScopedManager


class ProjectGroup(HouseholdScopedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    description = models.TextField(default="")
    tags = ArrayField(models.TextField(), default=list, blank=True)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "project_groups"


class Project(HouseholdScopedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        ON_HOLD = "on_hold", "On hold"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class Type(models.TextChoices):
        RENOVATION = "renovation", "Renovation"
        MAINTENANCE = "maintenance", "Maintenance"
        REPAIR = "repair", "Repair"
        PURCHASE = "purchase", "Purchase"
        RELOCATION = "relocation", "Relocation"
        VACATION = "vacation", "Vacation"
        LEISURE = "leisure", "Leisure"
        OTHER = "other", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.TextField()
    description = models.TextField(default="")
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.DRAFT)
    priority = models.IntegerField(default=3)
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    tags = ArrayField(models.TextField(), default=list, blank=True)
    planned_budget = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    actual_cost_cached = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cover_interaction = models.ForeignKey("interactions.Interaction", on_delete=models.SET_NULL, null=True, blank=True, related_name="cover_for_projects")
    project_group = models.ForeignKey(ProjectGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name="projects")
    type = models.CharField(max_length=32, choices=Type.choices, default=Type.OTHER)
    is_pinned = models.BooleanField(default=False)

    objects = HouseholdScopedManager()

    class Meta:
        db_table = "projects"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(priority__gte=1) & models.Q(priority__lte=5),
                name="projects_priority_between_1_5",
            ),
            models.CheckConstraint(
                condition=models.Q(planned_budget__gte=0),
                name="projects_planned_budget_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(actual_cost_cached__gte=0),
                name="projects_actual_cost_non_negative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(start_date__isnull=True)
                    | models.Q(due_date__isnull=True)
                    | models.Q(due_date__gte=models.F("start_date"))
                ),
                name="projects_dates_consistent",
            ),
        ]


class ProjectZone(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="project_zones")
    zone = models.ForeignKey("zones.Zone", on_delete=models.CASCADE, related_name="project_zones")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = "project_zones"
        unique_together = [["project", "zone"]]


class ProjectDocument(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="project_documents")
    document = models.ForeignKey("documents.Document", on_delete=models.CASCADE, related_name="project_documents")
    role = models.TextField(default="supporting")
    note = models.TextField(default="")
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = "project_documents"
        unique_together = [["project", "document"]]


class ProjectAIThread(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="ai_threads")
    household = models.ForeignKey("households.Household", on_delete=models.CASCADE, related_name="project_ai_threads")
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="project_ai_threads")
    title = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "project_ai_threads"


class ProjectAIMessage(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(ProjectAIThread, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_ai_messages"
