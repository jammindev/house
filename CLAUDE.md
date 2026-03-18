# Règles du projet house

## Traductions (i18next)

Ne jamais utiliser de `defaultValue` dans les appels `t()` :

```ts
// ❌ Interdit
t('tasks.title', 'Tasks')

// ✅ Correct
t('tasks.title')
```

**Pourquoi :** les `defaultValue` masquent les traductions manquantes. Sans eux, une clé absente du fichier JSON affiche la clé brute, ce qui permet de repérer immédiatement ce qui n'est pas traduit.
