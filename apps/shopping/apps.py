from django.apps import AppConfig


class ShoppingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "shopping"

    def ready(self):
        from agent.searchables import SearchableSpec, register
        from agent.writables import WritableSpec, register as register_writable

        from .models import ShoppingListItem

        register(SearchableSpec(
            entity_type='shopping_item',
            module='shopping',
            model=ShoppingListItem,
            search_fields=('label', 'note'),
            label_attr='label',
            url_template='/app/shopping-list?item={id}',
        ))

        # Add an item to the shopping list. Reversible: the undo hard-deletes it.
        register_writable(WritableSpec(
            entity_type='shopping_item',
            module='shopping',
            create=_create_shopping_item_from_agent,
            update=_update_shopping_item_from_agent,
            updatable_fields=('label', 'quantity', 'unit', 'note', 'checked'),
            resolve=_resolve_shopping_item_for_agent,
            delete=_delete_shopping_item_from_agent,
            label_attr='label',
            url_template='/app/shopping-list?item={id}',
        ))


def _create_shopping_item_from_agent(household, user, fields, *, anchor=None):
    """Map the agent's raw ``fields`` to ``shopping.services.create_list_item``.

    When the user names something the household already stocks (or the
    conversation is anchored on a ``stock_item``), the created list item is
    linked to that ``StockItem`` and deduped — exactly like the "Add to list"
    button. Otherwise it is a free-text item.
    """
    from .services import add_stock_item_to_list, create_list_item, resolve_stock_item_hint

    stock_item = None
    if anchor and anchor[0] == 'stock_item':
        stock_item = resolve_stock_item_hint(household, anchor[1])
    if stock_item is None:
        hint = fields.get('stock_item') or fields.get('label')
        stock_item = resolve_stock_item_hint(household, hint)

    if stock_item is not None:
        quantity = fields.get('quantity')
        item, _created = add_stock_item_to_list(
            household, user, stock_item, quantity=quantity, note=fields.get('note') or ''
        )
        return item

    return create_list_item(
        household,
        user,
        label=(fields.get('label') or '').strip(),
        quantity=fields.get('quantity'),
        unit=fields.get('unit') or '',
        note=fields.get('note') or '',
    )


def _update_shopping_item_from_agent(household, user, instance, fields):
    from .services import update_list_item

    return update_list_item(household, user, instance, fields=fields)


def _resolve_shopping_item_for_agent(household, raw_id):
    from .services import resolve_list_item

    return resolve_list_item(household, raw_id)


def _delete_shopping_item_from_agent(household, user, object_id):
    from .services import delete_list_item, resolve_list_item

    item = resolve_list_item(household, object_id)
    if item is None:
        raise LookupError(f"no shopping list item {object_id} in this household")
    delete_list_item(item)
