"""Fermer le vocabulaire de `Equipment.condition` — même défaut que la catégorie.

La colonne portait « good » (défaut du formulaire) et « Neuf » (saisi à la main),
et la fiche affichait la valeur brute : un foyer français lisait donc « État :
good ». Deux langues dans une colonne, dont une que personne n'a choisie.

Séparée de 0006 volontairement : une migration qui fait une chose se relit, et
se retire, sans avoir à démêler ce qu'elle faisait d'autre.
"""

from django.db import migrations, models

CONDITION_FALLBACK = "good"

CONDITION_ALIASES = {
    "new": "new", "neuf": "new", "neuve": "new", "nouveau": "new",
    "good": "good", "bon": "good", "bon etat": "good", "correct": "good", "ok": "good",
    "fair": "fair", "moyen": "fair", "usage": "fair", "use": "fair", "passable": "fair",
    "poor": "poor", "mauvais": "poor", "mauvais etat": "poor", "fatigue": "poor",
    "broken": "broken", "casse": "broken", "hs": "broken", "hors service": "broken",
    "en panne": "broken",
}


def _normalize_key(value):
    import unicodedata

    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.casefold().split())


def normalize_conditions(apps, schema_editor):
    Equipment = apps.get_model("equipment", "Equipment")
    for equipment in Equipment.objects.all().iterator():
        original = equipment.condition or ""
        key = _normalize_key(original)
        mapped = CONDITION_ALIASES.get(key, CONDITION_FALLBACK) if key else CONDITION_FALLBACK
        if mapped == equipment.condition:
            continue

        fields = ["condition"]
        if key and key not in CONDITION_ALIASES:
            tags = list(equipment.tags or [])
            label = " ".join(str(original).split())
            if label and label not in tags:
                tags.append(label)
                equipment.tags = tags
                fields.append("tags")

        equipment.condition = mapped
        equipment.save(update_fields=fields)


def noop(apps, schema_editor):
    """Le schéma redevient libre ; les valeurs rassemblées le restent."""


class Migration(migrations.Migration):

    dependencies = [
        ("equipment", "0006_equipment_category_vocabulary"),
    ]

    operations = [
        migrations.AlterField(
            model_name="equipment",
            name="condition",
            field=models.TextField(
                blank=True,
                choices=[
                    ("new", "New"),
                    ("good", "Good"),
                    ("fair", "Fair"),
                    ("poor", "Poor"),
                    ("broken", "Broken"),
                ],
                default="good",
            ),
        ),
        migrations.RunPython(normalize_conditions, noop),
    ]
