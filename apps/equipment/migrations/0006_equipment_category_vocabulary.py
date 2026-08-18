"""Fermer le vocabulaire de `Equipment.category`.

Le champ était un texte libre pré-rempli « general ». Sur un parc de 21 objets,
la base portait 13 orthographes — `voiture`, `Machine`, `machine`, `outil`,
`tool`, `garden`, `jardin`, `hvac`, `heating`… — affichées brutes, donc en
anglais dans une interface française, et impossibles à filtrer.

**Ce qui n'entre pas dans le vocabulaire n'est pas jeté** : la valeur d'origine
part dans `tags`. Une migration qui perd une saisie du foyer pour faire propre
échange une donnée contre une colonne bien rangée — le mauvais côté du marché,
et sur une instance tierce qu'on ne voit pas, on ne saurait même pas ce qui a
disparu.
"""

from django.db import migrations, models

# Copie figée du normaliseur au jour de la migration. Importer
# `equipment.services` ici lierait le passé au présent : le jour où le
# vocabulaire bougera, cette migration rejouée sur une base neuve produirait un
# autre résultat que celui qu'elle a produit en prod.
CATEGORY_FALLBACK = "other"

CATEGORY_ALIASES = {
    "heating": "heating", "chauffage": "heating", "hvac": "heating", "vmc": "heating",
    "ventilation": "heating", "climatisation": "heating",
    "plomberie": "plumbing", "plumbing": "plumbing", "sanitaire": "plumbing",
    "appliance": "appliance", "appliances": "appliance", "electromenager": "appliance",
    "menager": "appliance",
    "tool": "tool", "tools": "tool", "outil": "tool", "outils": "tool",
    "outillage": "tool", "machine": "tool", "bricolage": "tool",
    "garden": "garden", "jardin": "garden", "jardinage": "garden", "exterieur": "garden",
    "mobility": "mobility", "voiture": "mobility", "vehicule": "mobility",
    "velo": "mobility", "bike": "mobility", "car": "mobility",
    "multimedia": "multimedia", "informatique": "multimedia", "computer": "multimedia",
    "electronics": "multimedia", "electronique": "multimedia",
    "furniture": "furniture", "meuble": "furniture", "meubles": "furniture",
    "mobilier": "furniture",
    "security": "security", "securite": "security", "alarme": "security",
    "general": CATEGORY_FALLBACK, "divers": CATEGORY_FALLBACK,
    "autre": CATEGORY_FALLBACK, "other": CATEGORY_FALLBACK,
}


def _normalize_key(value):
    import unicodedata

    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.casefold().split())


def normalize_categories(apps, schema_editor):
    Equipment = apps.get_model("equipment", "Equipment")
    for equipment in Equipment.objects.all().iterator():
        original = equipment.category or ""
        key = _normalize_key(original)
        mapped = CATEGORY_ALIASES.get(key, CATEGORY_FALLBACK) if key else CATEGORY_FALLBACK
        if mapped == equipment.category:
            continue

        fields = ["category"]
        # Une valeur qu'on ne sait pas traduire est conservée telle quelle en tag.
        # `general` est le défaut historique du formulaire, pas une saisie : le
        # garder ferait entrer un tag « general » sur presque tout le parc.
        if key and key not in CATEGORY_ALIASES:
            tags = list(equipment.tags or [])
            label = " ".join(str(original).split())
            if label and label not in tags:
                tags.append(label)
                equipment.tags = tags
                fields.append("tags")

        equipment.category = mapped
        equipment.save(update_fields=fields)


def noop(apps, schema_editor):
    """Retour en arrière : le schéma redevient libre, les valeurs restent.

    On ne restaure pas les orthographes d'avant — elles sont dans les tags pour
    celles qui n'avaient pas d'équivalent, et réécrire « tool » en « Machine »
    supposerait de savoir laquelle des deux le foyer préférait.
    """


class Migration(migrations.Migration):

    dependencies = [
        ("equipment", "0005_delete_equipmentdocument"),
    ]

    operations = [
        migrations.AlterField(
            model_name="equipment",
            name="category",
            field=models.TextField(
                choices=[
                    ("heating", "Heating & ventilation"),
                    ("plumbing", "Plumbing"),
                    ("appliance", "Appliance"),
                    ("tool", "Tool"),
                    ("garden", "Garden"),
                    ("mobility", "Mobility"),
                    ("multimedia", "Multimedia & computing"),
                    ("furniture", "Furniture"),
                    ("security", "Security"),
                    ("other", "Other"),
                ],
                default="other",
            ),
        ),
        migrations.RunPython(normalize_categories, noop),
    ]
