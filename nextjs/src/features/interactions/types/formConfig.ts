// nextjs/src/features/interactions/types/formConfig.ts

export interface InteractionFormField {
    // Contrôle d'affichage
    visible: boolean;
    required: boolean;
    disabled?: boolean;

    // Valeur par défaut si le champ n'est pas affiché
    defaultValue?: any;

    // Configuration spécifique au champ
    placeholder?: string;
    label?: string;
    helpText?: string;

    // Pour les champs de sélection
    options?: Array<{ value: any; label: string }>;

    // Validation
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        custom?: (value: any) => boolean | string;
    };
}

export interface InteractionFormConfig {
    // Champs de base
    subject: InteractionFormField;
    content: InteractionFormField;
    type: InteractionFormField;
    status: InteractionFormField;
    occurredAt: InteractionFormField;

    // Relations
    zones: InteractionFormField;
    projects: InteractionFormField;
    tags: InteractionFormField;
    contacts: InteractionFormField;
    structures: InteractionFormField;

    // Métadonnées spécifiques (selon le type)
    metadata: {
        amount?: InteractionFormField;
        dueDate?: InteractionFormField;
        priority?: InteractionFormField;
        estimatedDuration?: InteractionFormField;
        location?: InteractionFormField;
        participants?: InteractionFormField;
        attachments?: InteractionFormField;
        // Extensible selon les besoins
        [key: string]: InteractionFormField | undefined;
    };

    // Configuration globale
    layout: {
        showHeader: boolean;
        showFooter: boolean;
        groupFields: boolean;
        responsiveColumns: boolean;
    };

    // Actions
    actions: {
        showCancel: boolean;
        showReset: boolean;
        showSaveAsDraft: boolean;
        submitLabel: string;
    };
}

// Interface pour les données du formulaire
export interface InteractionFormData {
    // Champs de base (correspondent à la DB)
    subject: string;
    content: string;
    type: string;
    status: string | null;
    occurred_at: string;

    // Relations (IDs)
    zone_ids: string[];
    project_id: string | null;
    tag_ids: string[];
    contact_ids: string[];
    structure_ids: string[];

    // Métadonnées (stockées en JSONB)
    metadata: Record<string, any>;

    // Documents/fichiers
    documents: Array<{
        file?: File;
        document_id?: string;
        type: string;
        name: string;
        notes: string;
    }>;
}

// Types pour la factory
export type InteractionFormType =
    | "note"
    | "task"
    | "quote"
    | "expense"
    | "call"
    | "visit"
    | "document"
    | "meeting"
    | "maintenance"
    | "repair"
    | "installation"
    | "inspection";

// Interface pour le composant factory
export interface InteractionFormFactoryProps {
    formType: InteractionFormType;
    config?: Partial<InteractionFormConfig>;
    defaultValues?: Partial<InteractionFormData>;
    onSubmit: (data: InteractionFormData) => void | Promise<void>;
    onCancel?: () => void;
    zones: Array<{ id: string; name: string; parent_id?: string | null }>;
    projects?: Array<{ id: string; title: string; status: string }>;
    householdId: string;
    submitting?: boolean;
    errors?: Record<string, string>;
}