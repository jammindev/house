from decimal import Decimal

from django.apps import AppConfig


class StockConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "stock"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable

        from .models import StockItem

        register(SearchableSpec(
            entity_type='stock_item',
            module='stock',
            model=StockItem,
            search_fields=('name', 'description', 'notes', 'supplier'),
            label_attr='name',
            url_template='/app/stock/{id}',
            related=_stock_item_related,
        ))

        # Create + edit the item itself.
        register_writable(WritableSpec(
            entity_type='stock_item',
            module='stock',
            create=_create_stock_item_from_agent,
            update=_update_stock_item_from_agent,
            updatable_fields=('name', 'description', 'notes', 'unit', 'min_quantity', 'max_quantity', 'supplier'),
            resolve=_resolve_stock_item_for_agent,
            delete=_delete_stock_item_from_agent,
            label_attr='name',
            url_template='/app/stock/{id}',
        ))

        # Record an inventory count (absolute remaining level) on an existing item.
        # A level correction — no undo (mirrors meter_reading / tracker_entry): the
        # user simply records another count.
        register_writable(WritableSpec(
            entity_type='stock_reading',
            module='stock',
            create=_create_reading_from_agent,
            label_attr='name',
            url_template='/app/stock/{id}',
        ))

        # Record a purchase (inbound movement + expense) on an existing item.
        # Reversible: the undo deletes the expense + readings and restores quantity.
        register_writable(WritableSpec(
            entity_type='stock_purchase',
            module='stock',
            create=_create_purchase_from_agent,
            delete=_delete_purchase_from_agent,
            label_attr=lambda i: getattr(i, 'subject', '') or '',
            url_template='/app/interactions/{id}',
        ))


def _stock_item_related(item):
    """Recent level readings injected into the anchored assistant's context.

    Mirrors how a project injects its expenses: the model reasons over the raw
    descent points to answer "how fast am I consuming / when will I run out".
    """
    from .services import recent_level_readings

    return recent_level_readings(item)


# --- item create / update / delete -------------------------------------------

def _create_stock_item_from_agent(household, user, fields, *, anchor=None):
    from .services import create_stock_item, resolve_category

    category = resolve_category(household, fields.get('category'))
    zone = anchor[1] if anchor and anchor[0] == 'zone' else fields.get('zone')
    return create_stock_item(
        household,
        user,
        category=category,
        name=(fields.get('name') or '').strip(),
        unit=fields.get('unit'),
        quantity=fields.get('quantity'),
        min_quantity=fields.get('min_quantity'),
        notes=fields.get('notes'),
        zone=zone,
    )


def _update_stock_item_from_agent(household, user, instance, fields):
    from .services import update_stock_item

    return update_stock_item(household, user, instance, fields)


def _resolve_stock_item_for_agent(household, raw_id):
    from .services import resolve_stock_item

    return resolve_stock_item(household, raw_id)


def _delete_stock_item_from_agent(household, user, object_id):
    from .services import resolve_stock_item

    item = resolve_stock_item(household, object_id)
    if item is None:
        raise LookupError(f"no stock item {object_id} in this household")
    item.delete()


# --- inventory reading + purchase (actions on an existing item) ---------------

def _resolve_item_from_fields(household, fields, anchor):
    """Resolve the target stock item for a reading/purchase action.

    Order: conversation anchor on a stock_item → explicit ``stock_item`` field
    (id or case-insensitive name) → the household's single item. Raises
    ``ValueError`` (the recoverable-error contract) when missing or ambiguous.
    """
    from .models import StockItem
    from .services import _looks_like_uuid, resolve_stock_item

    if anchor and anchor[0] == 'stock_item':
        item = resolve_stock_item(household, anchor[1])
        if item is not None:
            return item

    raw = (fields.get('stock_item') or '').strip()
    qs = StockItem.objects.filter(household_id=household.id)
    if raw:
        if _looks_like_uuid(raw):
            item = qs.filter(pk=raw).first()
            if item is not None:
                return item
        matches = list(qs.filter(name__iexact=raw)[:2])
        if len(matches) > 1:
            raise ValueError(f"several stock items match {raw!r}; be more specific")
        if matches:
            return matches[0]
        raise ValueError(f"no stock item named {raw!r}")

    only = list(qs[:2])
    if len(only) == 1:
        return only[0]
    raise ValueError("which stock item? name it")


def _create_reading_from_agent(household, user, fields, *, anchor=None):
    from .services import record_inventory

    item = _resolve_item_from_fields(household, fields, anchor)
    quantity = fields.get('quantity')
    if quantity in (None, ''):
        raise ValueError("a remaining quantity is required")
    return record_inventory(item=item, user=user, quantity=Decimal(str(quantity)))


def _create_purchase_from_agent(household, user, fields, *, anchor=None):
    from .services import purchase_stock_item

    item = _resolve_item_from_fields(household, fields, anchor)
    delta = fields.get('delta')
    if delta in (None, ''):
        raise ValueError("a purchased quantity (delta) is required")

    def _dec(key):
        value = fields.get(key)
        return Decimal(str(value)) if value not in (None, '') else None

    _, interaction = purchase_stock_item(
        item=item,
        user=user,
        delta=Decimal(str(delta)),
        amount=_dec('amount'),
        supplier=(fields.get('supplier') or ''),
        brand=(fields.get('brand') or ''),
        remaining_before=_dec('remaining_before'),
        occurred_at=fields.get('occurred_at'),
        notes=(fields.get('notes') or ''),
    )
    return interaction


def _delete_purchase_from_agent(household, user, object_id):
    from .services import undo_purchase

    undo_purchase(household=household, user=user, interaction_id=object_id)
