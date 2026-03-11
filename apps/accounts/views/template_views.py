"""Template-based views for accounts app."""
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Count, Q
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import formats, timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.translation import gettext as _
from django.views.generic import RedirectView, View

from core.permissions import resolve_request_household
from core.views import ReactPageView
from documents.models import Document
from interactions.models import Interaction
from projects.models import Project


class HomeView(View):
    """Landing page publique."""

    def get(self, request):
        if request.user.is_authenticated:
            return redirect('app_dashboard')
        return render(request, 'home.html')


class LoginView(View):
    """Login view using Django template."""

    def get(self, request):
        if request.user.is_authenticated:
            return redirect('app_dashboard')
        form = AuthenticationForm()
        return render(request, 'login.html', {'form': form, 'next': request.GET.get('next', '')})

    def post(self, request):
        if request.user.is_authenticated:
            return redirect('app_dashboard')
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                auth_login(request, user)
                messages.success(request, f"Bienvenue, {user.email}!")
                next_url = request.POST.get('next') or request.GET.get('next')
                if next_url and url_has_allowed_host_and_scheme(
                    url=next_url,
                    allowed_hosts={request.get_host()},
                    require_https=request.is_secure()
                ):
                    return redirect(next_url)
                return redirect('app_dashboard')
        else:
            messages.error(request, "Email ou mot de passe incorrect.")
        return render(request, 'login.html', {'form': form, 'next': request.POST.get('next', '')})


class DashboardView(LoginRequiredMixin, RedirectView):
    """Legacy redirect — dashboard maintenant sous /app/dashboard/."""
    pattern_name = 'app_dashboard'


TASK_OPEN_STATUSES = ['backlog', 'pending', 'in_progress']


def _resolve_selected_household(request):
    selected_household = resolve_request_household(request, required=False)
    if selected_household:
        return selected_household

    membership = (
        request.user.householdmember_set
        .select_related('household')
        .order_by('household__name')
        .first()
    )
    return membership.household if membership else None


def _visible_interactions_queryset(request, household):
    return (
        Interaction.objects.for_user_households(request.user)
        .filter(household=household)
        .filter(Q(is_private=False) | Q(created_by=request.user))
        .select_related('project', 'created_by')
        .prefetch_related('zones')
        .annotate(document_count=Count('documents', distinct=True))
    )


def _visible_documents_queryset(request, household):
    return (
        Document.objects.filter(household=household, household__householdmember__user=request.user)
        .filter(household=household)
        .filter(
            Q(interaction__isnull=True)
            | Q(interaction__is_private=False)
            | Q(interaction__created_by=request.user)
        )
        .select_related('interaction')
        .distinct()
    )


def _format_datetime(value):
    if not value:
        return ''
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return formats.date_format(value, 'SHORT_DATETIME_FORMAT', use_l10n=True)


def _format_date(value):
    if not value:
        return ''
    return formats.date_format(value, 'SHORT_DATE_FORMAT', use_l10n=True)


def _trim_text(value, limit=140):
    text = (value or '').strip()
    if len(text) <= limit:
        return text
    return f'{text[: limit - 1].rstrip()}…'


def _status_tone(status):
    return {
        'done': 'emerald',
        'in_progress': 'sky',
        'pending': 'amber',
        'backlog': 'slate',
        'archived': 'slate',
        'active': 'sky',
        'completed': 'emerald',
        'on_hold': 'amber',
        'cancelled': 'rose',
        'draft': 'slate',
    }.get(status or '', 'slate')


def _type_tone(item_type):
    return {
        'todo': 'amber',
        'expense': 'rose',
        'maintenance': 'sky',
        'repair': 'rose',
        'inspection': 'sky',
        'warranty': 'emerald',
        'document': 'slate',
        'invoice': 'amber',
        'manual': 'sky',
        'photo': 'emerald',
    }.get(item_type or '', 'slate')


def _format_decimal(value: Decimal):
    normalized = value.quantize(Decimal('0.01'))
    return formats.number_format(normalized, 2)


def _serialize_interaction_item(interaction, list_url, badge_mode='type'):
    badge_label = interaction.get_type_display()
    badge_tone = _type_tone(interaction.type)
    if badge_mode == 'status' and interaction.status:
        badge_label = interaction.get_status_display()
        badge_tone = _status_tone(interaction.status)

    meta = [
        {'label': _('When'), 'labelKey': 'dashboard.meta.when', 'value': _format_datetime(interaction.occurred_at)},
    ]
    if interaction.project:
        meta.append({'label': _('Project'), 'labelKey': 'dashboard.meta.project', 'value': interaction.project.title})
    zone_names = [zone.name for zone in interaction.zones.all()[:2]]
    if zone_names:
        meta.append({'label': _('Zones'), 'labelKey': 'dashboard.meta.zones', 'value': ', '.join(zone_names)})
    if interaction.document_count:
        meta.append({'label': _('Documents'), 'labelKey': 'dashboard.meta.documents', 'value': str(interaction.document_count)})

    return {
        'id': str(interaction.id),
        'title': interaction.subject,
        'url': list_url,
        'description': _trim_text(interaction.content),
        'badge': {
            'label': badge_label,
            'tone': badge_tone,
        },
        'meta': meta,
    }


def _serialize_project_item(project):
    meta = [
        {'label': _('Type'), 'labelKey': 'dashboard.meta.type', 'value': project.get_type_display()},
        {'label': _('Open tasks'), 'labelKey': 'dashboard.meta.openTasks', 'value': str(project.open_tasks_count)},
    ]
    if project.due_date:
        meta.append({'label': _('Due date'), 'labelKey': 'dashboard.meta.dueDate', 'value': _format_date(project.due_date)})
    if project.actual_cost_cached:
        meta.append({'label': _('Actual cost'), 'labelKey': 'dashboard.meta.actualCost', 'value': _format_decimal(project.actual_cost_cached)})

    return {
        'id': str(project.id),
        'title': project.title,
        'url': reverse('app_projects_detail', kwargs={'project_id': project.id}),
        'description': _trim_text(project.description),
        'badge': {
            'label': project.get_status_display(),
            'tone': _status_tone(project.status),
        },
        'meta': meta,
    }


def _serialize_document_item(document, list_url):
    meta = [
        {'label': _('Added'), 'labelKey': 'dashboard.meta.added', 'value': _format_datetime(document.created_at)},
    ]
    if document.interaction:
        meta.append({'label': _('Interaction'), 'labelKey': 'dashboard.meta.interaction', 'value': document.interaction.subject})

    return {
        'id': str(document.id),
        'title': document.name,
        'url': list_url,
        'description': _trim_text(document.notes or document.ocr_text),
        'badge': {
            'label': document.get_type_display(),
            'tone': _type_tone(document.type),
        },
        'meta': meta,
    }


class AppDashboardView(ReactPageView):
    """Dashboard principal de l'application."""

    react_root_id = 'dashboard-root'
    props_script_id = 'dashboard-props'
    page_vite_asset = 'src/pages/dashboard/index.tsx'
    template_name = 'app/dashboard.html'

    def get_props(self):
        selected_household = _resolve_selected_household(self.request)
        interactions_url = reverse('app_interactions')
        projects_url = reverse('app_projects')
        tasks_url = reverse('app_tasks')
        documents_url = reverse('app_documents')
        settings_url = reverse('app_settings')

        if not selected_household:
            return {
                'header': {
                    'eyebrow': _('Household dashboard'),
                    'eyebrowKey': 'dashboard.header.eyebrow',
                    'title': _('Dashboard'),
                    'titleKey': 'dashboard.header.title',
                    'subtitle': _('Select or create a household to start organizing your home operations.'),
                    'subtitleKey': 'dashboard.empty.subtitle',
                },
                'summary': [],
                'quickActions': [
                    {
                        'label': _('Open settings'),
                        'labelKey': 'dashboard.actions.openSettings',
                        'href': settings_url,
                        'icon': 'settings',
                    },
                ],
                'sections': [],
                'emptyState': {
                    'title': _('No household available'),
                    'titleKey': 'dashboard.empty.title',
                    'description': _('Create a household from settings to unlock the dashboard.'),
                    'descriptionKey': 'dashboard.empty.description',
                    'href': settings_url,
                    'hrefLabel': _('Go to settings'),
                    'hrefLabelKey': 'dashboard.empty.cta',
                },
            }

        visible_interactions = _visible_interactions_queryset(self.request, selected_household)
        visible_documents = _visible_documents_queryset(self.request, selected_household)

        upcoming_interactions = list(
            visible_interactions
            .exclude(type='todo')
            .filter(occurred_at__gte=timezone.now())
            .order_by('occurred_at')[:5]
        )
        tasks = list(
            visible_interactions
            .filter(type='todo', status__in=TASK_OPEN_STATUSES)
            .order_by('occurred_at')[:5]
        )
        recent_activity = list(visible_interactions.order_by('-occurred_at')[:6])
        recent_documents = list(visible_documents.order_by('-created_at')[:5])
        pinned_projects = list(
            Project.objects.for_user_households(self.request.user)
            .filter(
                household=selected_household,
                pinned_by_members__household_member__user=self.request.user,
                pinned_by_members__household_member__household=selected_household,
            )
            .select_related('project_group')
            .annotate(
                open_tasks_count=Count(
                    'interactions',
                    filter=Q(
                        interactions__type='todo',
                        interactions__status__in=TASK_OPEN_STATUSES,
                    ),
                    distinct=True,
                )
            )
            .order_by('due_date', 'title')[:4]
        )

        interaction_count = visible_interactions.count()
        open_task_count = visible_interactions.filter(type='todo', status__in=TASK_OPEN_STATUSES).count()
        active_project_count = Project.objects.for_user_households(self.request.user).filter(
            household=selected_household,
            status__in=['draft', 'active', 'on_hold'],
        ).count()
        document_count = visible_documents.count()

        return {
            'header': {
                'eyebrow': _('Household dashboard'),
                'eyebrowKey': 'dashboard.header.eyebrow',
                'title': selected_household.name,
                'subtitle': _('Track what is next, what is blocked, and what changed recently.'),
                'subtitleKey': 'dashboard.header.subtitle',
            },
            'summary': [
                {
                    'id': 'projects',
                    'label': _('Active projects'),
                    'labelKey': 'dashboard.summary.projects.label',
                    'value': active_project_count,
                    'helper': _('Pinned: %(count)s') % {'count': len(pinned_projects)},
                    'helperKey': 'dashboard.summary.projects.helper',
                    'helperParams': {'count': len(pinned_projects)},
                    'href': projects_url,
                    'icon': 'projects',
                    'tone': 'sky',
                },
                {
                    'id': 'tasks',
                    'label': _('Open tasks'),
                    'labelKey': 'dashboard.summary.tasks.label',
                    'value': open_task_count,
                    'helper': _('Todos with backlog, pending, or in progress status'),
                    'helperKey': 'dashboard.summary.tasks.helper',
                    'href': tasks_url,
                    'icon': 'tasks',
                    'tone': 'amber',
                },
                {
                    'id': 'documents',
                    'label': _('Visible documents'),
                    'labelKey': 'dashboard.summary.documents.label',
                    'value': document_count,
                    'helper': _('Recent files linked to this household'),
                    'helperKey': 'dashboard.summary.documents.helper',
                    'href': documents_url,
                    'icon': 'documents',
                    'tone': 'emerald',
                },
                {
                    'id': 'activity',
                    'label': _('Recent interactions'),
                    'labelKey': 'dashboard.summary.activity.label',
                    'value': interaction_count,
                    'helper': _('All visible interactions in this household'),
                    'helperKey': 'dashboard.summary.activity.helper',
                    'href': interactions_url,
                    'icon': 'activity',
                    'tone': 'slate',
                },
            ],
            'quickActions': [
                {
                    'label': _('Add'),
                    'labelKey': 'dashboard.actions.add',
                    'href': f"{reverse('app_interaction_new')}?return_to=dashboard",
                    'icon': 'plus',
                    'actionType': 'typePicker',
                },
                {
                    'label': _('New project'),
                    'labelKey': 'dashboard.actions.newProject',
                    'href': reverse('app_projects_new'),
                    'icon': 'projects',
                },
                {
                    'label': _('Open tasks'),
                    'labelKey': 'dashboard.actions.openTasks',
                    'href': tasks_url,
                    'icon': 'tasks',
                },
                {
                    'label': _('Open documents'),
                    'labelKey': 'dashboard.actions.openDocuments',
                    'href': documents_url,
                    'icon': 'documents',
                },
            ],
            'sections': [
                {
                    'id': 'upcoming',
                    'title': _('Upcoming interactions'),
                    'titleKey': 'dashboard.sections.upcoming.title',
                    'description': _('The next dated interactions planned for this household.'),
                    'descriptionKey': 'dashboard.sections.upcoming.description',
                    'href': interactions_url,
                    'hrefLabel': _('See all interactions'),
                    'hrefLabelKey': 'dashboard.sections.upcoming.cta',
                    'icon': 'calendar',
                    'emptyMessage': _('No upcoming interactions yet.'),
                    'emptyMessageKey': 'dashboard.sections.upcoming.empty',
                    'items': [_serialize_interaction_item(item, interactions_url) for item in upcoming_interactions],
                },
                {
                    'id': 'pinned-projects',
                    'title': _('Pinned projects'),
                    'titleKey': 'dashboard.sections.pinned.title',
                    'description': _('Projects you marked as important stay visible here.'),
                    'descriptionKey': 'dashboard.sections.pinned.description',
                    'href': projects_url,
                    'hrefLabel': _('See all projects'),
                    'hrefLabelKey': 'dashboard.sections.pinned.cta',
                    'icon': 'projects',
                    'emptyMessage': _('No pinned projects yet.'),
                    'emptyMessageKey': 'dashboard.sections.pinned.empty',
                    'items': [_serialize_project_item(item) for item in pinned_projects],
                },
                {
                    'id': 'tasks',
                    'title': _('Task focus'),
                    'titleKey': 'dashboard.sections.tasks.title',
                    'description': _('Open todos sorted by their scheduled date.'),
                    'descriptionKey': 'dashboard.sections.tasks.description',
                    'href': tasks_url,
                    'hrefLabel': _('Open task board'),
                    'hrefLabelKey': 'dashboard.sections.tasks.cta',
                    'icon': 'tasks',
                    'emptyMessage': _('No open tasks right now.'),
                    'emptyMessageKey': 'dashboard.sections.tasks.empty',
                    'items': [_serialize_interaction_item(item, tasks_url, badge_mode='status') for item in tasks],
                },
                {
                    'id': 'activity',
                    'title': _('Recent activity'),
                    'titleKey': 'dashboard.sections.activity.title',
                    'description': _('Latest visible interactions across the household.'),
                    'descriptionKey': 'dashboard.sections.activity.description',
                    'href': interactions_url,
                    'hrefLabel': _('Open activity stream'),
                    'hrefLabelKey': 'dashboard.sections.activity.cta',
                    'icon': 'activity',
                    'emptyMessage': _('No recent activity to display.'),
                    'emptyMessageKey': 'dashboard.sections.activity.empty',
                    'items': [_serialize_interaction_item(item, interactions_url) for item in recent_activity],
                },
                {
                    'id': 'documents',
                    'title': _('Recent documents'),
                    'titleKey': 'dashboard.sections.documents.title',
                    'description': _('Latest files visible from this household context.'),
                    'descriptionKey': 'dashboard.sections.documents.description',
                    'href': documents_url,
                    'hrefLabel': _('Open document library'),
                    'hrefLabelKey': 'dashboard.sections.documents.cta',
                    'icon': 'documents',
                    'emptyMessage': _('No documents uploaded yet.'),
                    'emptyMessageKey': 'dashboard.sections.documents.empty',
                    'items': [_serialize_document_item(item, documents_url) for item in recent_documents],
                },
            ],
            'emptyState': None,
        }


class LogoutView(View):
    """Logout view."""

    def get(self, request):
        auth_logout(request)
        messages.info(request, "Vous avez été déconnecté.")
        return redirect('login')
