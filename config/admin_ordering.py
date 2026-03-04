from django.contrib.admin import AdminSite


APP_ORDER = [
    "accounts",
    "households",
    "zones",
    "directory",
    "interactions",
    "documents",
    "tags",
    "equipment",
    "electricity",
    "projects",
    "notifications",
    "core",
]

MODEL_ORDER = {
    "accounts": ["User"],
    "households": ["Household", "HouseholdMember"],
    "zones": ["Zone"],
    "directory": ["Contact", "Structure", "Address", "Email", "Phone"],
    "interactions": [
        "Interaction",
        "InteractionContact",
        "InteractionStructure",
        "InteractionDocument",
    ],
    "documents": ["Document"],
    "tags": ["Tag", "InteractionTag"],
    "equipment": ["Equipment", "EquipmentInteraction"],
    "electricity": [
        "ElectricalBoard",
        "RCD",
        "Breaker",
        "Circuit",
        "UsagePoint",
        "ElectricalLink",
        "ChangeLog",
    ],
    "projects": ["Project", "ProjectGroup", "ProjectZone", "ProjectAIThread", "ProjectAIMessage"],
}


def _sort_key_by_order(value: str, ordered_values: list[str]) -> tuple[int, str]:
    try:
        return (ordered_values.index(value), value.lower())
    except ValueError:
        return (len(ordered_values), value.lower())


def _ordered_get_app_list(self: AdminSite, request, app_label=None):
    app_dict = self._build_app_dict(request, app_label)
    app_list = sorted(
        app_dict.values(),
        key=lambda app: _sort_key_by_order(app["app_label"], APP_ORDER),
    )

    for app in app_list:
        model_order = MODEL_ORDER.get(app["app_label"], [])
        app["models"].sort(
            key=lambda model: _sort_key_by_order(model.get("object_name", model["name"]), model_order)
        )

    return app_list


AdminSite.get_app_list = _ordered_get_app_list