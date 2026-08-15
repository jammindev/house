from django.apps import AppConfig


class OrchardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'orchard'

    def ready(self):
        """Declare the orchard to the agent — **zero change inside `apps/agent/`**.

        Search, listing and writes are all registries the agent reads; adding a
        module is a declaration, never a patch to the agent's logic.
        """
        from agent.listables import ListableSpec, ListFilter, register as register_listable
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable

        from .models import Harvest, Tree, TreeEvent

        register(SearchableSpec(
            entity_type='tree',
            module='orchard',
            model=Tree,
            search_fields=('name', 'species', 'notes'),
            label_attr='name',
            url_template='/app/orchard/{id}',
            related=_tree_related,
        ))

        # Journal entries are citable on their own — « quand a-t-on taillé le gros
        # pommier ? » must find *the entry*, not just the subject.
        #
        # `/events/{id}` and not `/{id}`: `/app/orchard/{id}` is the **subject's**
        # page, which loads a `Tree` by that id — pointing an entry there sent an
        # entry uuid to a lookup that finds no tree, and rendered a blank screen.
        # The route resolves the entry and forwards to its subject
        # (`TreeEntryRedirect`), the shape `tracker-entries/:id` already uses. Not
        # a `?event=` on the list: a parameter that pilots nothing gets copied
        # into a bookmark while promising the opposite.
        register(SearchableSpec(
            entity_type='tree_event',
            module='orchard',
            model=TreeEvent,
            search_fields=('title', 'notes'),
            label_attr='title',
            url_template='/app/orchard/events/{id}',
        ))

        # A harvest is a number **and** a note. The number is answered by
        # `get_harvest_stats` and `list_entities`; the note (« beaucoup de vers
        # cette année ») was findable nowhere until this spec existed. Only local
        # text fields: `_search_one` annotates one headline per field and Django
        # forbids `__` in an annotation alias, so a related lookup would crash.
        # A harvest with no note simply never matches — there is no text to find.
        register(SearchableSpec(
            entity_type='harvest',
            module='orchard',
            model=Harvest,
            search_fields=('notes',),
            label_attr=lambda h: f"{h.tree.name} — {h.quantity} {h.unit}",
            url_template='/app/orchard/harvests/{id}',
        ))

        register_listable(ListableSpec(
            entity_type='tree',
            module='orchard',
            model=Tree,
            filters=(
                ListFilter('kind', 'comma-separated kinds', _filter_kind),
                ListFilter('status', 'comma-separated statuses', _filter_status),
                ListFilter('zone', 'zone name (partial match)', _filter_zone),
            ),
            order_by=('name',),
            describe=_describe_tree,
        ))

        register_listable(ListableSpec(
            entity_type='harvest',
            module='orchard',
            model=Harvest,
            filters=(
                ListFilter('season', 'calendar year, e.g. 2026', _filter_season),
                ListFilter('tree', 'subject name (partial match)', _filter_harvest_tree),
            ),
            order_by=('-harvested_on',),
            describe=_describe_harvest,
        ))

        register_writable(WritableSpec(
            entity_type='tree',
            module='orchard',
            create=_create_tree_from_agent,
            update=_update_tree_from_agent,
            updatable_fields=(
                'name', 'kind', 'species', 'rootstock', 'planted_on', 'status', 'notes',
            ),
            resolve=_resolve_tree_for_agent,
            delete=_delete_tree_from_agent,
            label_attr='name',
            url_template='/app/orchard/{id}',
        ))

        register_writable(WritableSpec(
            entity_type='tree_event',
            module='orchard',
            create=_create_event_from_agent,
            resolve=_resolve_event_for_agent,
            delete=_delete_event_from_agent,
            label_attr='title',
            url_template='/app/orchard/events/{id}',
        ))

        register_writable(WritableSpec(
            entity_type='harvest',
            module='orchard',
            create=_create_harvest_from_agent,
            resolve=_resolve_harvest_for_agent,
            delete=_delete_harvest_from_agent,
            label_attr=lambda h: f"{h.tree.name} — {h.quantity} {h.unit}",
            url_template='/app/orchard/harvests/{id}',
        ))

        # Aggregates are not listable rows: « combien de kilos de pommes cette
        # année ? » is one number, not a page of records. Same call as
        # `chickens.agent.build_get_chicken_stats_tool`.
        from agent.tools import register as register_tool

        from .agent import build_get_harvest_stats_tool

        register_tool(build_get_harvest_stats_tool())


def _tree_related(tree):
    """A subject's recent journal and harvests — injected in the anchored context."""
    return [
        *tree.events.order_by('-occurred_on', '-created_at')[:8],
        *tree.harvests.order_by('-harvested_on')[:8],
    ]


# --- writables: thin adapters onto orchard.services ---------------------------


def _zone_for_agent(household, fields, anchor):
    """Resolve the zone **by name**, with the anchor as a default and never more.

    A household says « au fond du jardin », never a UUID — and what is named
    explicitly beats the anchor, because the global assistant has no anchor at
    all (that is the only path since the « Assistant » tabs left the detail
    views). Resolution goes through `zones.services.resolve_zone` exclusively:
    one place decides what « le jardin » means, and it is the one that scopes to
    the household.
    """
    from zones.services import resolve_zone

    named = fields.get('zone')
    if named:
        zone = resolve_zone(household, named)
        if zone is None:
            raise ValueError(f"no zone matching {named!r} in this household")
        return zone.id
    if anchor and anchor[0] == 'zone':
        return anchor[1]
    return None


def _create_tree_from_agent(household, user, fields, *, anchor=None):
    from .services import create_tree

    zone_id = _zone_for_agent(household, fields, anchor)
    if zone_id is None:
        # The zone is a required FK: writing nothing beats writing a subject in
        # a place nobody chose.
        raise ValueError("a tree needs a 'zone' (the name of the zone it grows in)")

    return create_tree(
        household, user,
        name=(fields.get('name') or '').strip(),
        zone_id=zone_id,
        kind=fields.get('kind'),
        species=(fields.get('species') or '').strip(),
        rootstock=(fields.get('rootstock') or '').strip(),
        planted_on=fields.get('planted_on'),
        status=fields.get('status'),
        notes=fields.get('notes') or '',
    )


def _update_tree_from_agent(household, user, instance, fields):
    from .services import update_tree

    return update_tree(household, user, instance, fields=fields)


def _resolve_tree_for_agent(household, raw_id):
    from .models import Tree

    return Tree.objects.filter(household_id=household.id, pk=raw_id).first()


def _delete_tree_from_agent(household, user, object_id):
    from .services import delete_tree

    tree = _resolve_tree_for_agent(household, object_id)
    if tree is None:
        raise LookupError(f"no subject {object_id} in this orchard")
    delete_tree(household, user, tree)


def _subject_from_fields(household, fields, anchor):
    """« sur le prunier » — by name, ambiguity refused rather than guessed."""
    from .services import resolve_tree

    raw = fields.get('tree') or fields.get('subject')
    if raw:
        return resolve_tree(household, raw)
    if anchor and anchor[0] == 'tree':
        return resolve_tree(household, anchor[1])
    raise ValueError("this needs a 'tree' (the name of the subject)")


def _create_event_from_agent(household, user, fields, *, anchor=None):
    from .services import create_event

    tree = _subject_from_fields(household, fields, anchor)
    title = (fields.get('title') or '').strip()
    if not title:
        raise ValueError("tree_event needs a 'title'")
    return create_event(
        household, user,
        tree=tree,
        type=fields.get('type') or 'observation',
        title=title,
        occurred_on=fields.get('occurred_on'),
        notes=fields.get('notes') or '',
    )


def _resolve_event_for_agent(household, raw_id):
    from .models import TreeEvent

    return TreeEvent.objects.filter(household_id=household.id, pk=raw_id).first()


def _delete_event_from_agent(household, user, object_id):
    from .services import delete_event

    event = _resolve_event_for_agent(household, object_id)
    if event is None:
        raise LookupError(f"no journal entry {object_id} in this orchard")
    delete_event(household, user, event)


def _create_harvest_from_agent(household, user, fields, *, anchor=None):
    from .services import create_harvest

    tree = _subject_from_fields(household, fields, anchor)
    quantity = fields.get('quantity')
    if quantity in (None, ''):
        raise ValueError("harvest needs a 'quantity'")
    return create_harvest(
        household, user,
        tree=tree,
        quantity=quantity,
        unit=fields.get('unit'),
        harvested_on=fields.get('harvested_on'),
        notes=fields.get('notes') or '',
    )


def _resolve_harvest_for_agent(household, raw_id):
    from .models import Harvest

    return Harvest.objects.filter(household_id=household.id, pk=raw_id).first()


def _delete_harvest_from_agent(household, user, object_id):
    from .services import delete_harvest

    harvest = _resolve_harvest_for_agent(household, object_id)
    if harvest is None:
        raise LookupError(f"no harvest {object_id} in this orchard")
    delete_harvest(household, user, harvest)


# --- list_entities filters -----------------------------------------------------


def _filter_kind(qs, value):
    kinds = [v.strip() for v in value.split(',') if v.strip()]
    known = {'fruit_tree', 'berry_bush', 'vine', 'ornamental'}
    unknown = [v for v in kinds if v not in known]
    if not kinds or unknown:
        raise ValueError(f"unknown kind: {', '.join(unknown) or '(empty)'}")
    return qs.filter(kind__in=kinds)


def _filter_status(qs, value):
    statuses = [v.strip() for v in value.split(',') if v.strip()]
    known = {'alive', 'ailing', 'dead', 'removed'}
    unknown = [v for v in statuses if v not in known]
    if not statuses or unknown:
        raise ValueError(f"unknown status: {', '.join(unknown) or '(empty)'}")
    return qs.filter(status__in=statuses)


def _filter_zone(qs, value):
    return qs.filter(zone__name__icontains=value.strip())


def _filter_season(qs, value):
    try:
        year = int(value.strip())
    except (TypeError, ValueError):
        raise ValueError(f"season must be a year, got {value!r}")
    return qs.filter(harvested_on__year=year)


def _filter_harvest_tree(qs, value):
    return qs.filter(tree__name__icontains=value.strip())


def _describe_tree(tree) -> str:
    parts = [tree.get_kind_display(), tree.status]
    if tree.species:
        parts.append(tree.species)
    if tree.zone_id:
        parts.append(f"in {tree.zone.name}")
    if tree.planted_on:
        parts.append(f"planted {tree.planted_on.isoformat()}")
    return ' | '.join(str(p) for p in parts)


def _describe_harvest(harvest) -> str:
    return (
        f"{harvest.quantity} {harvest.unit} from {harvest.tree.name} "
        f"on {harvest.harvested_on.isoformat()}"
    )
