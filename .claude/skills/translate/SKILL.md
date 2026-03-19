---
name: translate
description: Ajouter ou mettre à jour des clés de traduction i18next dans les 4 fichiers de langue (en, fr, de, es). Utiliser quand l'utilisateur ajoute une fonctionnalité avec du texte UI ou signale des clés manquantes.
allowed-tools: Read, Edit, Grep, Glob
---

## Règles de traduction dans ce projet

### Fichiers à modifier (toujours les 4)
- `ui/src/locales/en/translation.json`
- `ui/src/locales/fr/translation.json`
- `ui/src/locales/de/translation.json`
- `ui/src/locales/es/translation.json`

### Namespaces disponibles
`common`, `auth`, `tasks`, `projects`, `zones`, `equipment`, `documents`, `photos`, `directory`, `contacts`, `structures`, `stock`, `electricity`, `interactions`, `dashboard`, `settings`, `tagSelector`, `documentSelector`

### Règles absolues

1. **Jamais de `defaultValue`** dans les appels `t()` — une clé manquante doit afficher la clé brute
2. **Toujours modifier les 4 fichiers** en même temps
3. **Choisir le bon namespace** selon la fonctionnalité
4. **Clés descriptives** en camelCase : `fieldSubject`, `placeholder`, `errorNotFound`
5. **Interpolation** avec `{{variable}}` : `"completedBy": "Done by {{name}}"`
6. **Pluralisation** : utiliser `count`, `count_one`, `count_other`

### Procédure

Quand $ARGUMENTS contient des clés à ajouter :

1. Lire le contexte autour dans le code pour comprendre le namespace approprié
2. Lire chacun des 4 fichiers JSON pour trouver l'emplacement exact (maintenir l'ordre alphabétique ou logique du namespace)
3. Ajouter les clés dans les 4 fichiers avec les traductions appropriées :
   - `en` : anglais (référence)
   - `fr` : français
   - `de` : allemand
   - `es` : espagnol
4. Vérifier que la structure JSON reste valide

### Format de réponse

Confirme les clés ajoutées sous forme de tableau :

| Clé | EN | FR | DE | ES |
|-----|----|----|----|----|
| `namespace.key` | ... | ... | ... | ... |
