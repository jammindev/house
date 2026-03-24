# RFC — Import / Export vCard (contacts)

> Statut : Brouillon
> Auteur : Benjamin Vandamme
> Date : 2026-03-24
> Scope : `apps/directory/` (backend) + `ui/src/features/directory/` (frontend)

---

## 1. Contexte et décision

### Pourquoi pas une sync CardDAV bi-directionnelle avec iCloud ?

La sync continue iCloud ↔ house a été évaluée et écartée pour les raisons suivantes :

- **House est multi-membre** : chaque foyer a plusieurs utilisateurs. Si chaque membre connecte son iCloud, les mêmes contacts seraient importés en doublon, les suppressions d'un membre affecteraient l'iCloud d'un autre, et deux syncs en parallèle créeraient des conflits impossibles à résoudre proprement.
- **Deux catalogues différents** : les contacts iCloud d'un membre contiennent ses amis, famille, collègues — pas uniquement les contacts du foyer. Un sync complet polluerait house avec des centaines de contacts personnels non pertinents.
- **House est déjà le point de vérité partagé** : c'est précisément la valeur ajoutée du directory — un carnet d'adresses commun au foyer, indépendant des carnets personnels de chaque membre.

### Ce qu'on fait à la place

Import et export de fichiers **vCard (.vcf)** — le standard universel des contacts, supporté nativement par :
- iPhone (Contacts.app)
- Android (Google Contacts)
- iCloud.com
- Gmail / Google Contacts
- macOS, Windows, Outlook

Chaque membre peut **piocher** un contact depuis house pour l'ajouter à son téléphone, ou **importer** des contacts existants dans house, sans que ça affecte les autres membres du foyer.

---

## 2. Priorités et cas d'usage réels

### Sens house → téléphone (priorité haute)

**Le cas d'usage principal.** Un membre du foyer veut avoir le plombier / le médecin dans ses contacts téléphone. Il clique "Exporter en vCard" dans house → le navigateur télécharge le `.vcf` → iOS/Android propose immédiatement "Ajouter aux contacts". **2 clics, aucune friction**, fonctionne identiquement sur iPhone et Android.

### Sens téléphone → house (priorité secondaire)

**Surtout utile pour l'onboarding initial** — "je veux ramener mes contacts pro existants dans house sans tout retaper". Ce cas se fait naturellement sur **desktop** (iCloud.com ou Google Contacts → exporter → uploader dans house). Sur mobile, le parcours est plus long (exporter depuis Contacts.app → enregistrer dans Fichiers → importer dans house) et restera peu utilisé au quotidien. Au quotidien, un membre créera directement le contact dans house.

### Ce qu'on ne fait pas

Sync bi-directionnelle automatique (CardDAV iCloud, Google Contacts API) — écarté car house est multi-membre par foyer. Voir §1 pour le raisonnement complet.

---

## 3. Fonctionnalités

### 3.1 Export

| Action | Priorité | Description |
|---|---|---|
| **Export d'un contact** | Haute | Télécharger un seul contact en `.vcf` depuis sa card |
| **Export de tous les contacts** | Moyenne | Télécharger tous les contacts du foyer en un seul `.vcf` multi-entrées |
| **Export filtré** | Basse (futur) | Export par structure ou tag |

### 3.2 Import

| Action | Priorité | Description |
|---|---|---|
| **Import d'un fichier .vcf** | Moyenne | Accepte les fichiers mono ou multi-contacts |
| **Prévisualisation avant import** | Moyenne | Afficher la liste des contacts détectés avant de confirmer |
| **Gestion des doublons de contact** | Moyenne | Détecter les doublons (même nom + email) et proposer : ignorer / écraser / importer quand même |
| **Résolution du champ ORG** | Moyenne | Chercher une Structure par nom et proposer liaison/création, jamais automatique (voir §4.5) |

---

## 4. Mapping de données

### 4.1 vCard → Contact house

| Champ vCard | Champ house | Notes |
|---|---|---|
| `N` | `last_name` + `first_name` | Format `N:Dupont;Jean;;;` |
| `FN` | Fallback si `N` absent | Nom complet à parser |
| `EMAIL;TYPE=work` | `emails[].email` + `label="work"` | Multi-valué, `PREF` → `is_primary` |
| `TEL;TYPE=cell` | `phones[].phone` + `label="mobile"` | Multi-valué, `PREF` → `is_primary` |
| `ADR;TYPE=home` | `addresses[]` | 7 composants (voir §3.1) |
| `NOTE` | `notes` | Texte libre |
| `TITLE` | `position` | Titre professionnel |
| `ORG` | `contact.structure` (conditionnel) | Voir §4.5 — résolution par nom, jamais automatique |
| `PHOTO` | Ignoré | Pas de photo sur Contact v1 |
| `CATEGORIES` | Ignoré | Pas de tags sur Contact |

### 4.2 Contact house → vCard

| Champ house | Champ vCard généré |
|---|---|
| `first_name` + `last_name` | `N` + `FN` |
| `emails[]` | `EMAIL;TYPE=<label>` (primary → `;PREF=1`) |
| `phones[]` | `TEL;TYPE=<label>` (primary → `;PREF=1`) |
| `addresses[]` | `ADR;TYPE=<label>` |
| `notes` | `NOTE` |
| `position` | `TITLE` |
| `structure.name` | `ORG` |

### 4.3 Champs ADR vCard (ordre fixe)

```
ADR: PO Box ; Extended ; Street   ; City  ; Region ; Postal  ; Country
  →  —       ; address_2; address_1; city  ; —      ; zipcode ; country
```

### 4.5 Gestion du champ `ORG` à l'import

Le champ `ORG` d'un vCard peut correspondre à une `Structure` existante dans house (plombier, pharmacie, assureur...). La règle est : **jamais de création ou de liaison automatique — toujours une confirmation explicite de l'utilisateur dans la prévisualisation**.

#### Les 3 cas

| Situation | Comportement par défaut | Options proposées |
|---|---|---|
| Match exact (insensible à la casse) | Lier (coché par défaut) | Lier / Ignorer |
| Plusieurs structures matchent | Choix obligatoire | Liste des structures + Ignorer |
| Aucun match | Ignorer (coché par défaut) | Créer la structure / Ignorer |

Le défaut "Ignorer" sur aucun match évite de polluer la liste des structures avec des `ORG` non pertinents (employeurs d'amis, "Apple Inc.", etc.) sans que l'utilisateur y prête attention.

#### Rendu dans la prévisualisation

**Match exact :**
```
✓ Jean Martin
  ORG "Plomberie Martin" — structure trouvée  [ Lier ▾ ]
                                               > Lier ✓
                                               > Ignorer
```

**Plusieurs matchs :**
```
✓ Jean Martin
  ORG "Martin" — 2 structures trouvées  [ Choisir... ]
                                          > Plomberie Martin
                                          > Cabinet Martin
                                          > Ignorer
```

**Aucun match :**
```
✓ Jean Martin
  ORG "Plomberie Martin" — aucune structure trouvée  [ Ignorer ▾ ]
                                                      > Ignorer ✓
                                                      > Créer "Plomberie Martin"
```

> La case globale "appliquer à tous" ne s'applique **pas** aux liaisons de structure — chaque décision est individuelle.

### 4.6 Labels de téléphone

| vCard TYPE | Label house |
|---|---|
| `CELL`, `MOBILE` | `mobile` |
| `WORK` | `work` |
| `HOME` | `home` |
| `MAIN` | `main` |
| Autre / absent | `other` |

---

## 5. Backend

### 5.1 Dépendances

```txt
# requirements/base.txt
vobject==0.9.6.1    # parsing et génération de vCard
```

### 5.2 Structure

```
apps/directory/
  vcard/
    __init__.py
    exporter.py     # Contact(s) → .vcf
    importer.py     # .vcf → liste de Contact(s) à créer
```

### 5.3 `exporter.py`

```python
def contact_to_vcard(contact: Contact) -> vobject.vCard:
    """Convertit un Contact en objet vCard vobject."""
    ...

def contacts_to_vcf_bytes(contacts: list[Contact]) -> bytes:
    """Sérialise une liste de Contact en fichier .vcf (multi-entrées)."""
    ...
```

### 5.4 `importer.py`

```python
@dataclass
class ImportedContact:
    data: dict          # dict prêt pour ContactSerializer
    raw_vcard: str      # vCard brut original
    duplicate_of: Contact | None  # Contact house probable doublon

def parse_vcf(file_content: bytes) -> list[ImportedContact]:
    """Parse un fichier .vcf et retourne les contacts détectés."""
    ...

def detect_duplicate(data: dict, household) -> Contact | None:
    """
    Cherche un contact existant dans le household avec le même
    (last_name + first_name) ou le même email principal.
    Retourne le doublon trouvé ou None.
    """
    ...
```

### 5.5 Endpoints API

```
# Export
GET  /contacts/export/          → .vcf de tous les contacts du foyer
GET  /contacts/{id}/export/     → .vcf d'un seul contact

# Import
POST /contacts/import/preview/  → parse le .vcf, retourne la liste sans créer
POST /contacts/import/          → crée les contacts (avec options doublons)
```

#### `GET /contacts/export/`

```http
Content-Type: text/vcard; charset=utf-8
Content-Disposition: attachment; filename="contacts-foyer.vcf"
```

#### `POST /contacts/import/preview/`

Request : `multipart/form-data` avec champ `file` (.vcf)

Response :
```json
{
  "total": 5,
  "contacts": [
    {
      "first_name": "Jean",
      "last_name": "Dupont",
      "emails": [{"email": "jean@example.com", "label": "work"}],
      "duplicate_of": null
    },
    {
      "first_name": "Marie",
      "last_name": "Martin",
      "emails": [],
      "duplicate_of": { "id": "uuid-existant", "first_name": "Marie", "last_name": "Martin" }
    }
  ]
}
```

#### `POST /contacts/import/`

Request :
```json
{
  "contacts": [...],        // liste issue du preview
  "on_duplicate": "skip"    // "skip" | "overwrite" | "import_anyway"
}
```

Response :
```json
{
  "created": 4,
  "skipped": 1,
  "overwritten": 0
}
```

---

## 6. Frontend

### 6.1 Export

Dans `DirectoryPage` — bouton dans le header ou menu contextuel :

```
[ Exporter tous les contacts (.vcf) ]
```

Dans `ContactCard` — action dans le dropdown CardActions :

```
[ Exporter en vCard ]
```

Implémentation : déclenche un `GET` vers l'endpoint d'export → le navigateur propose le téléchargement du fichier `.vcf`.

### 6.2 Import

Bouton **"Importer des contacts"** dans le header de `DirectoryPage`.

Flow en 2 étapes dans un dialog :

**Étape 1 — Upload**
```
Importer des contacts
┌──────────────────────────────────┐
│  Glisser un fichier .vcf ici     │
│  ou [ Choisir un fichier ]       │
└──────────────────────────────────┘
Compatible iPhone, Android, iCloud, Gmail
```

**Étape 2 — Prévisualisation**
```
5 contacts détectés

  ✓ Jean Dupont        jean@example.com
      ORG "Plomberie Martin" — structure trouvée    [ Lier ▾ ]

  ✓ Paul Lefebvre      paul@gmail.com
      ORG "Google" — aucune structure trouvée       [ Ignorer ▾ ]

  ✓ Pharmacie du Centre   —

  ⚠ Marie Martin       Déjà présente               [ Ignorer ▾ ]
      ORG "Cabinet Martin" — 2 structures trouvées  [ Choisir... ]

  ✓ Électricien Moreau moreau@elec.fr

  En cas de doublon de contact : [ Ignorer ▾ ]   (appliqué à tous)

  [ Annuler ]   [ Importer 4 contacts ]
```

---

## 7. Cas limites

| Cas | Comportement |
|---|---|
| Fichier .vcf avec encoding non-UTF8 | Tenter latin-1 en fallback, sinon erreur claire |
| vCard v2.1 (très ancien format Android) | Supporté via vobject |
| Contact sans nom | Utiliser l'email ou le téléphone comme label dans la prévisualisation |
| Contact sans aucun champ utile | Ignorer silencieusement |
| Fichier > 5 MB | Refuser avec message d'erreur (limite arbitraire, ~5 000 contacts) |
| Caractères spéciaux / accents | vobject gère le charset automatiquement |

---

## 8. Plan d'implémentation

### Phase 1 — Export (priorité haute)

- [ ] Ajouter `vobject` aux requirements
- [ ] Implémenter `exporter.py` (Contact → vCard + Structure → vCard)
- [ ] Endpoint `GET /contacts/export/` (tous les contacts du foyer)
- [ ] Endpoint `GET /contacts/{id}/export/` (un seul contact)
- [ ] Endpoint `GET /contacts/structures/{id}/export/` (une structure)
- [ ] Action "Exporter en vCard" dans `ContactCard` dropdown
- [ ] Action "Exporter en vCard" dans `StructureCard` dropdown
- [ ] Tests pytest pour `exporter.py`

### Phase 2 — Import avec prévisualisation (priorité moyenne)

- [ ] Implémenter `importer.py` (parse + détection doublons)
- [ ] Endpoint `POST /contacts/import/preview/`
- [ ] Endpoint `POST /contacts/import/`
- [ ] Dialog import en 2 étapes dans `DirectoryPage`
- [ ] Traductions (en/fr/de/es)
- [ ] Tests pytest pour `importer.py`
- [ ] Tests E2E Playwright pour le flow d'import

---

## 9. Références

- RFC 6350 — vCard 4.0 : https://www.rfc-editor.org/rfc/rfc6350
- vCard 2.1 (Android legacy) : https://www.imc.org/pdi/vcard-21.txt
- Librairie `vobject` : https://eventable.github.io/vobject/
- Export depuis iCloud.com : Contacts → sélectionner → Fichier → Exporter la vCard
- Export depuis Android : Contacts → Menu → Importer/Exporter → Exporter vers stockage
