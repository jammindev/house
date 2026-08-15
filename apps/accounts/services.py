"""Le premier compte d'une instance — une seule définition, deux appelants.

Créer le premier compte n'est pas « créer un utilisateur » : c'est créer un
compte **et** un foyer **et** l'appartenance qui les relie, avec le foyer actif
positionné. Un compte sans foyer se connecte et arrive sur une application vide
de tout — `create_admin` le dit depuis toujours : « un demi-succès qui ressemble
exactement à un échec ».

Deux chemins mènent ici, et c'est précisément pourquoi ce fichier existe :

- **l'assistant de premier démarrage** (`accounts.views.setup`), le chemin normal,
  où la personne choisit ses identifiants dans le navigateur ;
- **`create_admin`**, pour l'installation non surveillée, où
  `MAISONNEE_ADMIN_PASSWORD` est fourni d'avance et où personne ne regarde l'écran.

Les deux doivent produire **exactement** la même chose. Écrite deux fois, cette
séquence aurait divergé au premier champ ajouté sur `Household` — et la
divergence ne se serait vue que chez celui qui a installé par l'autre chemin.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction

from households.models import Household, HouseholdMember

DEFAULT_EMAIL = "admin@maisonnee.local"
DEFAULT_HOUSEHOLD = "Ma maisonnée"


@transaction.atomic
def create_first_account(
    *, email: str, password: str, household_name: str = "", first_name: str = ""
):
    """Crée le compte fondateur, son foyer, et le lien entre les deux.

    Ne vérifie **pas** qu'aucun compte n'existe : cette garde appartient à
    l'appelant, parce que les deux appelants la prennent différemment — la vue
    sous un verrou consultatif (deux requêtes peuvent arriver ensemble), la
    commande en simple lecture (elle est seule dans son conteneur).
    """
    User = get_user_model()

    email = (email or DEFAULT_EMAIL).strip().lower()
    household_name = (household_name or DEFAULT_HOUSEHOLD).strip() or DEFAULT_HOUSEHOLD

    # ⚠️ Le nom affiché est **le tout premier mot que l'app adresse à quelqu'un**
    # (« Bonjour … » sur le tableau de bord). Dérivé de l'adresse, il donne
    # « benjamin.vandamme » — un fragment d'e-mail, avec son point, en guise
    # d'accueil. Le repli reste, parce qu'il faut bien afficher quelque chose,
    # mais l'assistant de premier démarrage demande maintenant un prénom.
    first_name = (first_name or "").strip()
    user = User.objects.create_superuser(
        email=email,
        password=password,
        first_name=first_name,
        display_name=first_name or email.split("@")[0],
    )
    household = Household.objects.create(name=household_name)
    HouseholdMember.objects.create(
        household=household, user=user, role=HouseholdMember.Role.OWNER
    )
    user.active_household = household
    user.save(update_fields=["active_household"])
    return user
