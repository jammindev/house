# Architecture de Formulaire Factory

## Vue d'ensemble

L'architecture de formulaire factory permet de créer des formulaires configurables pour tous types d'interactions (notes, tâches, devis, achats, maintenance). Chaque champ peut être :

- **Affiché ou masqué** (`visible: true/false`)
- **Obligatoire ou optionnel** (`required: true/false`) 
- **Pré-rempli avec une valeur par défaut** (`defaultValue`)

## 📁 Structure des fichiers

```
src/features/interactions/
├── types/
│   └── formConfig.ts          # Types TypeScript
├── configs/
│   └── formConfigurations.ts  # Configurations prédéfinies
├── components/
│   └── SimpleFormFactory.tsx  # Composant factory
└── examples/
    └── formConfigurationExamples.ts  # Exemples détaillés
```

## 🔧 Comment utiliser

### 1. Importer la configuration

```tsx
import { SimpleFormFactory } from "@interactions/components/SimpleFormFactory";
import { noteFormConfig } from "@interactions/configs/formConfigurations";
```

### 2. Utiliser le composant

```tsx
<SimpleFormFactory
  formType="note"           // Type de formulaire
  onSubmit={handleSubmit}   // Fonction appelée à la soumission
  zones={zones}             // Liste des zones disponibles
  projects={projects}       // Liste des projets (optionnel)
/>
```

### 3. Personnaliser une configuration

```tsx
import { noteFormConfig } from "@interactions/configs/formConfigurations";

const customConfig = {
  ...noteFormConfig,
  content: {
    ...noteFormConfig.content,
    visible: false,           // Masquer le champ contenu
    defaultValue: "Note automatique"  // Valeur par défaut
  }
};
```

## 📝 Configurations disponibles

| Type | Fichier | Description |
|------|---------|-------------|
| `note` | `noteFormConfig` | Note simple avec sujet, contenu, zones |
| `task` | `taskFormConfig` | Tâche avec statut, priorité, échéance |
| `quote` | `quoteFormConfig` | Devis avec montant, contact artisan |
| `expense` | `expenseFormConfig` | Achat avec prix, lieu d'achat |
| `maintenance` | `maintenanceFormConfig` | Intervention avec coût, type |

## 🎛️ Personnalisation des champs

### Structure d'un champ

```tsx
interface InteractionFormField {
  visible: boolean;         // Afficher le champ
  required: boolean;        // Champ obligatoire
  defaultValue?: any;       // Valeur par défaut si masqué
  placeholder?: string;     // Texte d'aide
  label?: string;          // Libellé affiché
  options?: Array<{        // Pour les listes déroulantes
    value: any;
    label: string;
  }>;
  validation?: {           // Règles de validation
    min?: number;
    max?: number;
    pattern?: string;
  };
}
```

### Exemple : Formulaire de note personnalisé

```tsx
const customNoteConfig: InteractionFormConfig = {
  subject: {
    visible: true,
    required: true,
    placeholder: "Titre de votre observation...",
    label: "Titre"
  },
  
  content: {
    visible: false,          // ❌ Caché
    required: false,
    defaultValue: "Observation rapide"  // 🔧 Valeur automatique
  },
  
  type: {
    visible: false,          // ❌ Toujours caché
    defaultValue: "note"     // 🔧 Type forcé
  },
  
  zones: {
    visible: true,           // ✅ Obligatoire
    required: true,
    label: "Où ?"
  },
  
  tags: {
    visible: true,           // ✅ Optionnel
    required: false,
    placeholder: "ex: problème, idée, amélioration..."
  },
  
  // ... autres champs
};
```

## 🏗️ Ajouter un nouveau type de formulaire

### 1. Créer la configuration

```tsx
// Dans formConfigurations.ts
export const inspectionFormConfig: InteractionFormConfig = {
  subject: {
    visible: true,
    required: true,
    placeholder: "Élément inspecté...",
    label: "Objet de l'inspection"
  },
  
  content: {
    visible: true,
    required: true,
    placeholder: "État observé, problèmes détectés...",
    label: "Résultats"
  },
  
  type: {
    visible: false,
    defaultValue: "inspection"
  },
  
  status: {
    visible: true,
    defaultValue: "done",
    options: [
      { value: "done", label: "✅ Conforme" },
      { value: "issue", label: "⚠️ Problème détecté" },
      { value: "critical", label: "🚨 Critique" }
    ]
  },
  
  // ... configurer tous les champs
  
  metadata: {
    severity: {
      visible: true,
      label: "Gravité",
      options: [
        { value: "low", label: "Faible" },
        { value: "medium", label: "Moyen" },
        { value: "high", label: "Élevé" }
      ]
    }
  },
  
  layout: {
    showHeader: true,
    showFooter: true,
    groupFields: true,
    responsiveColumns: true
  },
  
  actions: {
    showCancel: true,
    submitLabel: "Enregistrer l'inspection"
  }
};
```

### 2. Ajouter au map de configurations

```tsx
export const formConfigurations = {
  note: noteFormConfig,
  task: taskFormConfig,
  quote: quoteFormConfig,
  expense: expenseFormConfig,
  maintenance: maintenanceFormConfig,
  inspection: inspectionFormConfig  // ✅ Nouveau type
} as const;
```

### 3. Utiliser le nouveau formulaire

```tsx
<SimpleFormFactory
  formType="inspection"
  onSubmit={handleInspectionSubmit}
  zones={zones}
/>
```

## 🎨 Personnalisation de l'interface

### Layout et sections

```tsx
layout: {
  showHeader: true,        // Afficher le titre
  showFooter: true,        // Afficher les boutons
  groupFields: true,       // Grouper par sections
  responsiveColumns: true  // Colonnes adaptatives
}
```

### Actions personnalisées

```tsx
actions: {
  showCancel: true,           // Bouton annuler
  showReset: false,           // Bouton réinitialiser
  showSaveAsDraft: true,      // Bouton brouillon
  submitLabel: "Enregistrer"  // Texte du bouton principal
}
```

## 🔄 Workflow complet

### 1. L'utilisateur sélectionne un type
```tsx
const [selectedType, setSelectedType] = useState<FormType>("note");
```

### 2. Le factory charge la configuration
```tsx
const config = formConfigurations[selectedType];
```

### 3. Le formulaire s'affiche selon la config
- Champs visibles : rendus avec leurs propriétés
- Champs masqués : valeurs par défaut appliquées automatiquement

### 4. À la soumission
```tsx
const handleSubmit = (formData) => {
  // formData contient :
  // - Valeurs saisies pour les champs visibles
  // - Valeurs par défaut pour les champs masqués
  
  console.log(formData);
  // {
  //   subject: "Fuite robinet",
  //   content: "", 
  //   type: "maintenance",     // ← Valeur par défaut
  //   status: null,            // ← Valeur par défaut
  //   zoneIds: ["kitchen"],
  //   metadata: {
  //     amount: 45.50
  //   }
  // }
};
```

## 💡 Bonnes pratiques

### ✅ À faire

- **Masquer les champs techniques** (type, timestamps) avec des valeurs par défaut
- **Grouper logiquement** les champs par sections
- **Valider côté client** avec les règles de validation
- **Pré-remplir** les champs quand c'est possible (date du jour, zones du projet)

### ❌ À éviter

- Formulaires trop longs (masquer les champs non essentiels)
- Champs obligatoires sans valeur par défaut
- Labels peu explicites
- Mélanger les concepts (ne pas mettre le montant dans une note simple)

## 🚀 Extensions possibles

### Champs conditionnels
```tsx
// Afficher un champ seulement si un autre a une certaine valeur
priority: {
  visible: formData.type === "urgent",
  // ...
}
```

### Validation dynamique
```tsx
amount: {
  validation: {
    custom: (value) => {
      if (formType === "quote" && value < 50) {
        return "Les devis doivent être d'au moins 50€";
      }
      return true;
    }
  }
}
```

### Templates de pré-remplissage
```tsx
const templatePresets = {
  "plomberie-urgence": {
    subject: "Intervention plomberie urgente",
    tags: ["plomberie", "urgence"],
    metadata: { priority: 1 }
  }
};
```

Cette architecture permet de créer rapidement des formulaires adaptés à chaque usage tout en gardant un code maintenable et extensible ! 🎉