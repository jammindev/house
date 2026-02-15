// nextjs/src/features/interactions/examples/formConfigurationExamples.ts

/**
 * EXEMPLES DE CONFIGURATIONS POUR LE FORM FACTORY
 * 
 * Ce fichier montre comment configurer chaque type de formulaire
 * avec les champs visibles, requis, et les valeurs par défaut.
 */

import type { InteractionFormConfig } from "@interactions/types/formConfig";

// ===================================
// EXEMPLE 1: FORMULAIRE DE NOTE
// ===================================
// Formulaire simple avec uniquement les champs essentiels
export const noteFormExample: InteractionFormConfig = {
    // Champs de base
    subject: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        placeholder: "Sujet de la note...",
        label: "Sujet"
    },

    content: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        placeholder: "Décrivez votre note...",
        label: "Description"
    },

    type: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: "note"     // 🔧 Valeur automatique
    },

    status: {
        visible: false,          // ❌ Caché (pas de workflow pour les notes)
        required: false,
        defaultValue: null       // 🔧 Pas de statut
    },

    occurredAt: {
        visible: true,           // ✅ Affiché
        required: false,
        defaultValue: new Date().toISOString().split('T')[0], // 🔧 Aujourd'hui
        label: "Date"
    },

    // Relations
    zones: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        label: "Zones concernées"
    },

    projects: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Projet (optionnel)"
    },

    tags: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Tags",
        placeholder: "ex: réparation, idée, observation..."
    },

    contacts: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: []         // 🔧 Aucun contact
    },

    structures: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: []         // 🔧 Aucune structure
    },

    // Pas de métadonnées spécifiques
    metadata: {},

    // Configuration du layout
    layout: {
        showHeader: true,
        showFooter: true,
        groupFields: true,       // Grouper par sections
        responsiveColumns: true
    },

    actions: {
        showCancel: true,
        showReset: false,
        showSaveAsDraft: true,
        submitLabel: "Enregistrer la note"
    }
};


// ===================================
// EXEMPLE 2: FORMULAIRE DE TÂCHE  
// ===================================
// Avec statut, priorité et date d'échéance
export const taskFormExample: InteractionFormConfig = {
    // Champs de base
    subject: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        placeholder: "Que devez-vous faire ?",
        label: "Tâche à effectuer"
    },

    content: {
        visible: true,           // ✅ Affiché
        required: false,         // Optionnel pour les tâches simples
        placeholder: "Détails supplémentaires...",
        label: "Description (optionnelle)"
    },

    type: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: "todo"     // 🔧 Type automatique
    },

    status: {
        visible: true,           // ✅ Affiché (workflow important)
        required: false,
        defaultValue: "backlog", // 🔧 Démarre en "À faire"
        label: "Statut",
        options: [
            { value: "backlog", label: "📋 À faire" },
            { value: "pending", label: "⏳ En attente" },
            { value: "in_progress", label: "🔄 En cours" },
            { value: "done", label: "✅ Terminé" },
            { value: "archived", label: "📦 Archivé" }
        ]
    },

    occurredAt: {
        visible: false,          // ❌ Caché (pas pertinent pour planification)
        required: false,
        defaultValue: new Date().toISOString().split('T')[0]
    },

    // Relations
    zones: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        label: "Où ?"
    },

    projects: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Projet associé"
    },

    tags: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Tags",
        placeholder: "ex: urgent, électricité, nettoyage..."
    },

    contacts: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: []
    },

    structures: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: []
    },

    // Métadonnées spécifiques aux tâches
    metadata: {
        dueDate: {
            visible: true,         // ✅ Affiché
            required: false,
            label: "Date limite",
            placeholder: "Pour quand ?"
        },

        priority: {
            visible: true,         // ✅ Affiché
            required: false,
            defaultValue: 3,       // 🔧 Priorité normale
            label: "Priorité",
            options: [
                { value: 1, label: "🔥 Très urgent" },
                { value: 2, label: "🚨 Urgent" },
                { value: 3, label: "📝 Normal" },
                { value: 4, label: "🐌 Faible" }
            ]
        },

        estimatedDuration: {
            visible: true,         // ✅ Affiché
            required: false,
            label: "Durée estimée",
            placeholder: "ex: 2h, 1 journée, 1 semaine..."
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
        showReset: false,
        showSaveAsDraft: false,  // Pas besoin de brouillon pour les tâches
        submitLabel: "Créer la tâche"
    }
};


// ===================================
// EXEMPLE 3: FORMULAIRE DE DEVIS
// ===================================
// Avec montant, contact artisan et informations détaillées
export const quoteFormExample: InteractionFormConfig = {
    // Champs de base
    subject: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        placeholder: "Travaux demandés...",
        label: "Objet du devis"
    },

    content: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire (détails importants)
        placeholder: "Description détaillée des travaux, matériaux, délais...",
        label: "Description complète"
    },

    type: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: "expense"  // 🔧 Type automatique
    },

    status: {
        visible: false,          // ❌ Caché (pas de workflow pour devis)
        required: false,
        defaultValue: null
    },

    occurredAt: {
        visible: true,           // ✅ Affiché
        required: false,
        defaultValue: new Date().toISOString().split('T')[0], // 🔧 Date du devis
        label: "Date du devis"
    },

    // Relations
    zones: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        label: "Zones concernées"
    },

    projects: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Projet de rénovation"
    },

    tags: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Catégories",
        placeholder: "ex: électricité, plomberie, peinture, menuiserie..."
    },

    contacts: {
        visible: true,           // ✅ Affiché (important pour suivi)
        required: false,
        label: "Artisan / Entreprise"
    },

    structures: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: []
    },

    // Métadonnées spécifiques aux devis
    metadata: {
        amount: {
            visible: true,         // ✅ Affiché
            required: true,        // ✅ Obligatoire
            label: "Montant (€)",
            placeholder: "0.00",
            validation: {
                min: 0,
                pattern: "^[0-9]+(\.[0-9]{1,2})?$"
            }
        },

        location: {
            visible: true,         // ✅ Affiché
            required: false,
            label: "Lieu précis",
            placeholder: "ex: salle de bain étage, cuisine..."
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
        showReset: false,
        showSaveAsDraft: true,   // Utile pour devis en cours
        submitLabel: "Enregistrer le devis"
    }
};


// ===================================
// EXEMPLE 4: FORMULAIRE D'ACHAT/DÉPENSE
// ===================================  
// Pour enregistrer un achat effectué
export const expenseFormExample: InteractionFormConfig = {
    // Champs de base
    subject: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        placeholder: "Qu'avez-vous acheté ?",
        label: "Achat effectué"
    },

    content: {
        visible: true,           // ✅ Affiché
        required: false,
        placeholder: "Détails, marque, référence...",
        label: "Détails de l'achat"
    },

    type: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: "expense"  // 🔧 Type automatique
    },

    status: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: null
    },

    occurredAt: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire (date d'achat importante)
        defaultValue: new Date().toISOString().split('T')[0],
        label: "Date d'achat"
    },

    // Relations
    zones: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        label: "Pour quelles zones ?"
    },

    projects: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Projet associé"
    },

    tags: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Catégories",
        placeholder: "ex: matériaux, outils, décoration..."
    },

    contacts: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Magasin / Vendeur"
    },

    structures: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: []
    },

    // Métadonnées spécifiques aux achats
    metadata: {
        amount: {
            visible: true,         // ✅ Affiché
            required: true,        // ✅ Obligatoire
            label: "Prix payé (€)",
            placeholder: "0.00",
            validation: {
                min: 0
            }
        },

        location: {
            visible: true,         // ✅ Affiché
            required: false,
            label: "Où acheté ?",
            placeholder: "ex: Leroy Merlin, Amazon, marché local..."
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
        showReset: false,
        showSaveAsDraft: false,  // Achat déjà effectué
        submitLabel: "Enregistrer l'achat"
    }
};


// ===================================
// EXEMPLE 5: FORMULAIRE DE MAINTENANCE
// ===================================
// Pour enregistrer une intervention de maintenance
export const maintenanceFormExample: InteractionFormConfig = {
    // Champs de base
    subject: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        placeholder: "Type d'intervention...",
        label: "Intervention effectuée"
    },

    content: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire (détails importants)
        placeholder: "Problème rencontré, solution appliquée, pièces changées...",
        label: "Description complète"
    },

    type: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: "maintenance" // 🔧 Type automatique
    },

    status: {
        visible: true,           // ✅ Affiché
        required: false,
        defaultValue: "done",    // 🔧 Généralement déjà terminé
        label: "Statut",
        options: [
            { value: "planned", label: "📅 Planifié" },
            { value: "in_progress", label: "🔧 En cours" },
            { value: "done", label: "✅ Terminé" },
            { value: "failed", label: "❌ Échec" }
        ]
    },

    occurredAt: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        defaultValue: new Date().toISOString().split('T')[0],
        label: "Date d'intervention"
    },

    // Relations
    zones: {
        visible: true,           // ✅ Affiché
        required: true,          // ✅ Obligatoire
        label: "Zones concernées"
    },

    projects: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Projet associé"
    },

    tags: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Type d'intervention",
        placeholder: "ex: plomberie, électricité, chauffage..."
    },

    contacts: {
        visible: true,           // ✅ Affiché
        required: false,
        label: "Intervenant"
    },

    structures: {
        visible: false,          // ❌ Caché
        required: false,
        defaultValue: []
    },

    // Métadonnées spécifiques à la maintenance
    metadata: {
        amount: {
            visible: true,         // ✅ Affiché
            required: false,
            label: "Coût (€)",
            placeholder: "Coût total de l'intervention"
        },

        priority: {
            visible: true,         // ✅ Affiché
            required: false,
            defaultValue: 3,       // 🔧 Normal par défaut
            label: "Type d'intervention",
            options: [
                { value: 1, label: "🚨 Urgence" },
                { value: 2, label: "⚠️ Important" },
                { value: 3, label: "📝 Normal" },
                { value: 4, label: "🔄 Préventif" }
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
        showReset: false,
        showSaveAsDraft: true,
        submitLabel: "Enregistrer l'intervention"
    }
};


// ===================================
// RÉSUMÉ DES EXEMPLES
// ===================================

export const allFormExamples = {
    note: noteFormExample,
    task: taskFormExample,
    quote: quoteFormExample,
    expense: expenseFormExample,
    maintenance: maintenanceFormExample
} as const;

/**
 * COMMENT UTILISER CES EXEMPLES :
 * 
 * 1. Copier la configuration qui vous intéresse
 * 2. Modifier les champs selon vos besoins :
 *    - visible: true/false pour afficher/masquer
 *    - required: true/false pour rendre obligatoire
 *    - defaultValue: valeur automatique si caché
 *    - placeholder: texte d'aide
 *    - label: libellé affiché
 * 
 * 3. Pour les champs à choix multiples :
 *    - Définir options: [{ value: "id", label: "Texte" }]
 * 
 * 4. Pour les métadonnées :
 *    - Ajouter dans metadata: { monChamp: { visible: true, ... } }
 * 
 * 5. Personnaliser layout et actions selon l'UX voulue
 * 
 * EXEMPLE D'USAGE :
 * 
 * ```tsx
 * import { noteFormExample } from './formConfigurationExamples';
 * 
 * <InteractionFormFactory
 *   formType="note"
 *   config={noteFormExample}
 *   onSubmit={handleSubmit}
 *   zones={zones}
 *   householdId={householdId}
 * />
 * ```
 */