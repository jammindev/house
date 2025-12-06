# ContactStructureSelector

Composant générique pour la sélection de contacts et structures avec auto-remplissage automatique.

## Fonctionnalités

- **Sélection multiple** : Permet de sélectionner plusieurs contacts et structures
- **Auto-remplissage intelligent** : Quand un contact est sélectionné, si il est lié à une structure, cette structure est automatiquement ajoutée à la sélection
- **Évite les doublons** : Ne sélectionne pas deux fois la même structure
- **Personnalisable** : Labels, helpers, titre et description configurables
- **Optionnel** : L'auto-remplissage peut être désactivé si nécessaire

## Props

```typescript
interface ContactStructureSelectorProps {
  // État requis
  householdId: string;
  selectedContactIds: string[];
  onContactsChange: (contactIds: string[]) => void;
  selectedStructureIds: string[];
  onStructuresChange: (structureIds: string[]) => void;

  // Personnalisation (optionnel)
  contactsLabel?: string;
  contactsHelper?: string;
  structuresLabel?: string;
  structuresHelper?: string;
  title?: string;
  description?: string;
  
  // Comportement (optionnel)
  autoFillStructure?: boolean; // Par défaut: true
}
```

## Exemples d'utilisation

### Utilisation basique

```tsx
import ContactStructureSelector from "@interactions/components/ContactStructureSelector";

function MonFormulaire() {
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [structureIds, setStructureIds] = useState<string[]>([]);

  return (
    <ContactStructureSelector
      householdId={householdId}
      selectedContactIds={contactIds}
      onContactsChange={setContactIds}
      selectedStructureIds={structureIds}
      onStructuresChange={setStructureIds}
    />
  );
}
```

### Utilisation avec personnalisation

```tsx
<ContactStructureSelector
  householdId={householdId}
  selectedContactIds={contactIds}
  onContactsChange={setContactIds}
  selectedStructureIds={structureIds}
  onStructuresChange={setStructureIds}
  title="Personnes et Entreprises"
  description="Sélectionnez les contacts et structures pertinents"
  contactsLabel="Contacts impliqués"
  contactsHelper="Choisissez les personnes concernées"
  structuresLabel="Entreprises impliquées"
  structuresHelper="Choisissez les entreprises concernées"
/>
```

### Désactiver l'auto-remplissage

```tsx
<ContactStructureSelector
  // ... autres props
  autoFillStructure={false}
/>
```

## Logique d'auto-remplissage

Quand `autoFillStructure` est `true` (par défaut), le composant :

1. **Détecte** quand de nouveaux contacts sont sélectionnés
2. **Recherche** si ces contacts sont liés à des structures (`contact.structure_id`)
3. **Ajoute automatiquement** les structures trouvées à la sélection
4. **Évite les doublons** en ne sélectionnant que les nouvelles structures

### Exemple de comportement

```
Initial: contacts=[], structures=[]

User sélectionne "John Doe" (lié à "Entreprise A")
→ contacts=["john-id"], structures=["entreprise-a-id"] // Auto-ajouté

User sélectionne "Jane Smith" (liée à "Entreprise B") 
→ contacts=["john-id", "jane-id"], structures=["entreprise-a-id", "entreprise-b-id"]

User sélectionne "Bob Wilson" (lié à "Entreprise A" - déjà sélectionnée)
→ contacts=["john-id", "jane-id", "bob-id"], structures=["entreprise-a-id", "entreprise-b-id"]
// Pas de doublon pour "Entreprise A"
```

## Utilisation dans les formulaires existants

Le composant a été intégré dans `QuoteForm` et peut facilement être ajouté à d'autres formulaires :

- `ExpenseForm`
- `CallForm` 
- `VisitForm`
- Tout nouveau formulaire nécessitant contacts + structures

## Tests

Des tests unitaires sont disponibles dans `__tests__/ContactStructureSelector.test.tsx` pour vérifier la logique d'auto-remplissage.

## Traductions

Le composant utilise les clés de traduction suivantes :

- `interactionscontacts.label` - Label par défaut pour les contacts
- `interactionsstructures.label` - Label par défaut pour les structures  
- `forms.quote.contactsHelper` - Helper par défaut pour les contacts
- `forms.quote.structuresHelper` - Helper par défaut pour les structures
- `forms.contactStructure.autoFillNote` - Note explicative de l'auto-remplissage