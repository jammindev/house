// nextjs/src/features/interactions/constants/interactionTypes.ts
import {
    FileText,
    CheckSquare,
    Calculator,
    Phone,
    Users,
    CreditCard,
    MapPin,
    MessageCircle,
    FolderOpen,
    Wrench,
    Settings,
    Hammer,
    Search,
    Shield,
    AlertTriangle,
    TrendingUp,
    ArrowRightLeft,
    Trash2,
    FileSignature,
    MoreHorizontal,
} from "lucide-react";

import type { InteractionType, InteractionStatus } from "@interactions/types";

export interface InteractionTypeConfig {
    key: string;
    type: InteractionType;
    labelKey: string;
    descriptionKey: string;
    icon: typeof FileText;
    color: string;
    category: "communication" | "task" | "lifecycle" | "document" | "financial" | "other";
    hasSpecializedRoute: boolean;
    defaultStatus?: InteractionStatus | "";
    compatibleWith: ("project" | "equipment" | "general")[];
}

export const INTERACTION_TYPE_CONFIGS: Record<InteractionType, InteractionTypeConfig> = {
    note: {
        key: "note",
        type: "note",
        labelKey: "dashboard.quickActions.addNote",
        descriptionKey: "dashboard.quickActions.addNoteDesc",
        icon: FileText,
        color: "bg-blue-50 text-blue-700 border-blue-200",
        category: "document",
        hasSpecializedRoute: true,
        defaultStatus: "",
        compatibleWith: ["project", "equipment", "general"],
    },
    todo: {
        key: "todo",
        type: "todo",
        labelKey: "dashboard.quickActions.addTask",
        descriptionKey: "dashboard.quickActions.addTaskDesc",
        icon: CheckSquare,
        color: "bg-green-50 text-green-700 border-green-200",
        category: "task",
        hasSpecializedRoute: true,
        defaultStatus: "pending",
        compatibleWith: ["project", "general"],
    },
    expense: {
        key: "expense",
        type: "expense",
        labelKey: "dashboard.quickActions.addExpense",
        descriptionKey: "dashboard.quickActions.addExpenseDesc",
        icon: CreditCard,
        color: "bg-red-50 text-red-700 border-red-200",
        category: "financial",
        hasSpecializedRoute: true,
        defaultStatus: "",
        compatibleWith: ["project", "equipment", "general"],
    },
    quote: {
        key: "quote",
        type: "quote",
        labelKey: "dashboard.quickActions.addQuote",
        descriptionKey: "dashboard.quickActions.addQuoteDesc",
        icon: Calculator,
        color: "bg-purple-50 text-purple-700 border-purple-200",
        category: "financial",
        hasSpecializedRoute: true,
        defaultStatus: "",
        compatibleWith: ["project", "general"],
    },
    call: {
        key: "call",
        type: "call",
        labelKey: "dashboard.quickActions.addCall",
        descriptionKey: "dashboard.quickActions.addCallDesc",
        icon: Phone,
        color: "bg-amber-50 text-amber-700 border-amber-200",
        category: "communication",
        hasSpecializedRoute: true,
        defaultStatus: "",
        compatibleWith: ["project", "general"],
    },
    meeting: {
        key: "meeting",
        type: "meeting",
        labelKey: "dashboard.quickActions.addMeeting",
        descriptionKey: "dashboard.quickActions.addMeetingDesc",
        icon: Users,
        color: "bg-indigo-50 text-indigo-700 border-indigo-200",
        category: "communication",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["project", "general"],
    },
    visit: {
        key: "visit",
        type: "visit",
        labelKey: "dashboard.quickActions.addVisit",
        descriptionKey: "dashboard.quickActions.addVisitDesc",
        icon: MapPin,
        color: "bg-orange-50 text-orange-700 border-orange-200",
        category: "communication",
        hasSpecializedRoute: true,
        defaultStatus: "",
        compatibleWith: ["project", "general"],
    },
    message: {
        key: "message",
        type: "message",
        labelKey: "dashboard.quickActions.addMessage",
        descriptionKey: "dashboard.quickActions.addMessageDesc",
        icon: MessageCircle,
        color: "bg-cyan-50 text-cyan-700 border-cyan-200",
        category: "communication",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["project", "general"],
    },
    document: {
        key: "document",
        type: "document",
        labelKey: "dashboard.quickActions.addDocument",
        descriptionKey: "dashboard.quickActions.addDocumentDesc",
        icon: FolderOpen,
        color: "bg-gray-50 text-gray-700 border-gray-200",
        category: "document",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["project", "equipment", "general"],
    },
    maintenance: {
        key: "maintenance",
        type: "maintenance",
        labelKey: "dashboard.quickActions.addMaintenance",
        descriptionKey: "dashboard.quickActions.addMaintenanceDesc",
        icon: Settings,
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        category: "lifecycle",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["equipment"],
    },
    repair: {
        key: "repair",
        type: "repair",
        labelKey: "dashboard.quickActions.addRepair",
        descriptionKey: "dashboard.quickActions.addRepairDesc",
        icon: Wrench,
        color: "bg-yellow-50 text-yellow-700 border-yellow-200",
        category: "lifecycle",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["equipment"],
    },
    installation: {
        key: "installation",
        type: "installation",
        labelKey: "dashboard.quickActions.addInstallation",
        descriptionKey: "dashboard.quickActions.addInstallationDesc",
        icon: Hammer,
        color: "bg-slate-50 text-slate-700 border-slate-200",
        category: "lifecycle",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["equipment"],
    },
    inspection: {
        key: "inspection",
        type: "inspection",
        labelKey: "dashboard.quickActions.addInspection",
        descriptionKey: "dashboard.quickActions.addInspectionDesc",
        icon: Search,
        color: "bg-teal-50 text-teal-700 border-teal-200",
        category: "lifecycle",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["equipment"],
    },
    warranty: {
        key: "warranty",
        type: "warranty",
        labelKey: "dashboard.quickActions.addWarranty",
        descriptionKey: "dashboard.quickActions.addWarrantyDesc",
        icon: Shield,
        color: "bg-green-100 text-green-800 border-green-300",
        category: "lifecycle",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["equipment"],
    },
    issue: {
        key: "issue",
        type: "issue",
        labelKey: "dashboard.quickActions.addIssue",
        descriptionKey: "dashboard.quickActions.addIssueDesc",
        icon: AlertTriangle,
        color: "bg-red-100 text-red-800 border-red-300",
        category: "lifecycle",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["equipment"],
    },
    upgrade: {
        key: "upgrade",
        type: "upgrade",
        labelKey: "dashboard.quickActions.addUpgrade",
        descriptionKey: "dashboard.quickActions.addUpgradeDesc",
        icon: TrendingUp,
        color: "bg-violet-50 text-violet-700 border-violet-200",
        category: "lifecycle",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["equipment"],
    },
    replacement: {
        key: "replacement",
        type: "replacement",
        labelKey: "dashboard.quickActions.addReplacement",
        descriptionKey: "dashboard.quickActions.addReplacementDesc",
        icon: ArrowRightLeft,
        color: "bg-pink-50 text-pink-700 border-pink-200",
        category: "lifecycle",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["equipment"],
    },
    disposal: {
        key: "disposal",
        type: "disposal",
        labelKey: "dashboard.quickActions.addDisposal",
        descriptionKey: "dashboard.quickActions.addDisposalDesc",
        icon: Trash2,
        color: "bg-red-50 text-red-600 border-red-200",
        category: "lifecycle",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["equipment"],
    },
    signature: {
        key: "signature",
        type: "signature",
        labelKey: "dashboard.quickActions.addSignature",
        descriptionKey: "dashboard.quickActions.addSignatureDesc",
        icon: FileSignature,
        color: "bg-blue-100 text-blue-800 border-blue-300",
        category: "document",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["project", "general"],
    },
    other: {
        key: "other",
        type: "other",
        labelKey: "dashboard.quickActions.addOther",
        descriptionKey: "dashboard.quickActions.addOtherDesc",
        icon: MoreHorizontal,
        color: "bg-neutral-50 text-neutral-700 border-neutral-200",
        category: "other",
        hasSpecializedRoute: false,
        defaultStatus: "",
        compatibleWith: ["project", "equipment", "general"],
    },
};

// Utilitaires pour filtrer par catégorie et compatibilité
export const getInteractionTypesByCategory = (category?: InteractionTypeConfig["category"], compatibleWith?: "project" | "equipment" | "general") => {
    const allConfigs = Object.values(INTERACTION_TYPE_CONFIGS);
    
    // Filtrer par compatibilité si spécifié
    const compatibleConfigs = compatibleWith 
        ? allConfigs.filter(config => config.compatibleWith.includes(compatibleWith))
        : allConfigs;
    
    if (category) {
        return compatibleConfigs.filter(config => config.category === category);
    }
    
    // Retourner toutes les configs groupées par catégorie
    const grouped = compatibleConfigs.reduce((acc, config) => {
        if (!acc[config.category]) {
            acc[config.category] = [];
        }
        acc[config.category].push(config);
        return acc;
    }, {} as Record<InteractionTypeConfig["category"], InteractionTypeConfig[]>);
    
    return grouped;
};

// Utilitaires pour obtenir les types avec routes spécialisées
export const getSpecializedRouteTypes = () => {
    return Object.values(INTERACTION_TYPE_CONFIGS)
        .filter(config => config.hasSpecializedRoute)
        .map(config => config.type);
};

// Utilitaire pour obtenir la configuration d'un type
export const getInteractionTypeConfig = (type: InteractionType): InteractionTypeConfig => {
    return INTERACTION_TYPE_CONFIGS[type];
};