// nextjs/src/features/interactions/configs/formConfigurations.ts

import type { InteractionFormConfig } from "@interactions/types/formConfig";

/**
 * Configuration pour les notes
 * Formulaire simple : sujet, contenu, zones, tags
 */
export const noteFormConfig: InteractionFormConfig = {
    // === CHAMPS DE BASE ===
    subject: {
        visible: true,
        required: true,
        placeholder: "Sujet de la note...",
        label: "Sujet"
    },

    content: {
        visible: true,
        required: true,
        placeholder: "Décrivez votre note...",
        label: "Description"
    },

    type: {
        visible: false,
        required: false,
        defaultValue: "note"
    },

    status: {
        visible: false,
        required: false,
        defaultValue: null // Pas de statut pour les notes
    },

    occurredAt: {
        visible: true,
        required: false,
        defaultValue: new Date().toISOString(),
        label: "Date de la note"
    },

    // === RELATIONS ===
    zones: {
        visible: true,
        required: true,
        label: "Zones concernées"
    },

    projects: {
        visible: true,
        required: false,
        label: "Projet associé"
    },

    tags: {
        visible: true,
        required: false,
        placeholder: "Ajouter des tags...",
        label: "Tags"
    },

    contacts: {
        visible: false,
        required: false,
        defaultValue: []
    },

    structures: {
        visible: false,
        required: false,
        defaultValue: []
    },

    // === MÉTADONNÉES SPÉCIFIQUES ===
    metadata: {},

    // === CONFIGURATION GLOBALE ===
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
        submitLabel: "Enregistrer la note"
    }
};

/**
 * Configuration pour les tâches
 * Avec statut et date d'échéance
 */
export const taskFormConfig: InteractionFormConfig = {
    // === CHAMPS DE BASE ===
    subject: {
        visible: true,
        required: true,
        placeholder: "Que devez-vous faire ?",
        label: "Tâche"
    },

    content: {
        visible: true,
        required: false,
        placeholder: "Détails de la tâche (optionnel)...",
        label: "Description"
    },

    type: {
        visible: false,
        required: false,
        defaultValue: "todo"
    },

    status: {
        visible: true,
        required: false,
        defaultValue: "backlog",
        options: [
            { value: "backlog", label: "À faire" },
            { value: "pending", label: "En attente" },
            { value: "in_progress", label: "En cours" },
            { value: "done", label: "Terminé" },
            { value: "archived", label: "Archivé" }
        ],
        label: "Statut"
    },

    occurredAt: {
        visible: false,
        required: false,
        defaultValue: new Date().toISOString()
    },

    // === RELATIONS ===
    zones: {
        visible: true,
        required: true,
        label: "Zones concernées"
    },

    projects: {
        visible: true,
        required: false,
        label: "Projet associé"
    },

    tags: {
        visible: true,
        required: false,
        placeholder: "Ajouter des tags...",
        label: "Tags"
    },

    contacts: {
        visible: false,
        required: false,
        defaultValue: []
    },

    structures: {
        visible: false,
        required: false,
        defaultValue: []
    },

    // === MÉTADONNÉES SPÉCIFIQUES ===
    metadata: {
        dueDate: {
            visible: true,
            required: false,
            label: "Date d'échéance",
            placeholder: "Quand doit-elle être terminée ?"
        },
        priority: {
            visible: true,
            required: false,
            defaultValue: 3,
            options: [
                { value: 1, label: "Très urgent" },
                { value: 2, label: "Urgent" },
                { value: 3, label: "Normal" },
                { value: 4, label: "Faible" },
                { value: 5, label: "Très faible" }
            ],
            label: "Priorité"
        },
        estimatedDuration: {
            visible: true,
            required: false,
            placeholder: "Combien de temps estimez-vous ?",
            label: "Durée estimée"
        }
    },

    // === CONFIGURATION GLOBALE ===
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
        submitLabel: "Créer la tâche"
    }
};

/**
 * Configuration pour les devis
 * Avec montant et informations de facturation
 */
export const quoteFormConfig: InteractionFormConfig = {
    // === CHAMPS DE BASE ===
    subject: {
        visible: true,
        required: true,
        placeholder: "Objet du devis...",
        label: "Objet"
    },

    content: {
        visible: true,
        required: true,
        placeholder: "Description des travaux ou services...",
        label: "Description"
    },

    type: {
        visible: false,
        required: false,
        defaultValue: "expense"
    },

    status: {
        visible: false,
        required: false,
        defaultValue: null // Pas de statut workflow pour les devis
    },

    occurredAt: {
        visible: true,
        required: false,
        defaultValue: new Date().toISOString(),
        label: "Date du devis"
    },

    // === RELATIONS ===
    zones: {
        visible: true,
        required: true,
        label: "Zones concernées"
    },

    projects: {
        visible: true,
        required: false,
        label: "Projet associé"
    },

    tags: {
        visible: true,
        required: false,
        placeholder: "ex: électricité, plomberie, rénovation...",
        label: "Tags"
    },

    contacts: {
        visible: true,
        required: false,
        label: "Artisan/Entreprise"
    },

    structures: {
        visible: false,
        required: false,
        defaultValue: []
    },

    // === MÉTADONNÉES SPÉCIFIQUES ===
    metadata: {
        amount: {
            visible: true,
            required: true,
            placeholder: "0.00",
            label: "Montant (€)",
            validation: {
                min: 0,
                pattern: "^[0-9]+(\.[0-9]{1,2})?$"
            }
        },
        location: {
            visible: true,
            required: false,
            placeholder: "Lieu des travaux...",
            label: "Lieu"
        }
    },

    // === CONFIGURATION GLOBALE ===
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
        submitLabel: "Enregistrer le devis"
    }
};

/**
 * Configuration pour les dépenses
 * Similaire aux devis mais pour les achats effectués
 */
export const expenseFormConfig: InteractionFormConfig = {
    // === CHAMPS DE BASE ===
    subject: {
        visible: true,
        required: true,
        placeholder: "Achat effectué...",
        label: "Achat"
    },

    content: {
        visible: true,
        required: false,
        placeholder: "Détails de la dépense...",
        label: "Description"
    },

    type: {
        visible: false,
        required: false,
        defaultValue: "expense"
    },

    status: {
        visible: false,
        required: false,
        defaultValue: null
    },

    occurredAt: {
        visible: true,
        required: true,
        defaultValue: new Date().toISOString(),
        label: "Date d'achat"
    },

    // === RELATIONS ===
    zones: {
        visible: true,
        required: true,
        label: "Zones concernées"
    },

    projects: {
        visible: true,
        required: false,
        label: "Projet associé"
    },

    tags: {
        visible: true,
        required: false,
        placeholder: "ex: matériaux, outils, services...",
        label: "Tags"
    },

    contacts: {
        visible: true,
        required: false,
        label: "Vendeur/Magasin"
    },

    structures: {
        visible: false,
        required: false,
        defaultValue: []
    },

    // === MÉTADONNÉES SPÉCIFIQUES ===
    metadata: {
        amount: {
            visible: true,
            required: true,
            placeholder: "0.00",
            label: "Montant payé (€)",
            validation: {
                min: 0,
                pattern: "^[0-9]+(\.[0-9]{1,2})?$"
            }
        },
        location: {
            visible: true,
            required: false,
            placeholder: "Où avez-vous acheté ?",
            label: "Lieu d'achat"
        }
    },

    // === CONFIGURATION GLOBALE ===
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
        submitLabel: "Enregistrer la dépense"
    }
};

/**
 * Configuration pour la maintenance
 * Avec informations sur l'équipement et l'intervention
 */
export const maintenanceFormConfig: InteractionFormConfig = {
    // === CHAMPS DE BASE ===
    subject: {
        visible: true,
        required: true,
        placeholder: "Type de maintenance...",
        label: "Intervention"
    },

    content: {
        visible: true,
        required: true,
        placeholder: "Que s'est-il passé ? Qu'avez-vous fait ?",
        label: "Description"
    },

    type: {
        visible: false,
        required: false,
        defaultValue: "maintenance"
    },

    status: {
        visible: true,
        required: false,
        defaultValue: "done",
        options: [
            { value: "planned", label: "Planifié" },
            { value: "in_progress", label: "En cours" },
            { value: "done", label: "Terminé" },
            { value: "failed", label: "Échec" }
        ],
        label: "Statut"
    },

    occurredAt: {
        visible: true,
        required: true,
        defaultValue: new Date().toISOString(),
        label: "Date d'intervention"
    },

    // === RELATIONS ===
    zones: {
        visible: true,
        required: true,
        label: "Zones concernées"
    },

    projects: {
        visible: true,
        required: false,
        label: "Projet associé"
    },

    tags: {
        visible: true,
        required: false,
        placeholder: "ex: plomberie, électricité, chauffage...",
        label: "Tags"
    },

    contacts: {
        visible: true,
        required: false,
        label: "Intervenant"
    },

    structures: {
        visible: false,
        required: false,
        defaultValue: []
    },

    // === MÉTADONNÉES SPÉCIFIQUES ===
    metadata: {
        amount: {
            visible: true,
            required: false,
            placeholder: "Coût de l'intervention",
            label: "Coût (€)",
            validation: {
                min: 0
            }
        },
        priority: {
            visible: true,
            required: false,
            defaultValue: 3,
            options: [
                { value: 1, label: "Urgence" },
                { value: 2, label: "Important" },
                { value: 3, label: "Normal" },
                { value: 4, label: "Préventif" }
            ],
            label: "Type"
        }
    },

    // === CONFIGURATION GLOBALE ===
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

/**
 * Map de toutes les configurations disponibles
 */
export const formConfigurations = {
    note: noteFormConfig,
    task: taskFormConfig,
    todo: taskFormConfig, // Alias
    quote: quoteFormConfig,
    expense: expenseFormConfig,
    maintenance: maintenanceFormConfig
} as const;

/**
 * Type helper pour les clés de configuration
 */
export type FormConfigurationType = keyof typeof formConfigurations;

/**
 * Fonction utilitaire pour récupérer une configuration
 */
export function getFormConfiguration(type: FormConfigurationType): InteractionFormConfig {
    const config = formConfigurations[type];
    if (!config) {
        throw new Error(`Configuration de formulaire non trouvée pour le type: ${type}`);
    }
    return config;
}

/**
 * Fonction utilitaire pour valider si un champ doit être affiché
 */
export function shouldShowField(fieldConfig: any): boolean {
    return fieldConfig?.visible === true;
}

/**
 * Fonction utilitaire pour récupérer la valeur par défaut d'un champ
 */
export function getFieldDefaultValue(fieldConfig: any): any {
    return fieldConfig?.defaultValue;
}

/**
 * Fonction utilitaire pour récupérer les valeurs par défaut complètes d'un formulaire
 */
export function getFormDefaults(config: InteractionFormConfig): Record<string, any> {
    const defaults: Record<string, any> = {};

    // Champs de base
    Object.entries(config).forEach(([key, fieldConfig]) => {
        if (typeof fieldConfig === 'object' && fieldConfig !== null && 'defaultValue' in fieldConfig) {
            if (fieldConfig.defaultValue !== undefined) {
                defaults[key] = fieldConfig.defaultValue;
            }
        }
    });

    // Métadonnées
    if (config.metadata) {
        const metadataDefaults: Record<string, any> = {};
        Object.entries(config.metadata).forEach(([key, fieldConfig]) => {
            if (fieldConfig?.defaultValue !== undefined) {
                metadataDefaults[key] = fieldConfig.defaultValue;
            }
        });
        if (Object.keys(metadataDefaults).length > 0) {
            defaults.metadata = metadataDefaults;
        }
    }

    return defaults;
}