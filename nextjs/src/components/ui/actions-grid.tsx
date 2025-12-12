// nextjs/src/components/ui/actions-grid.tsx
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useIsMobile } from "@/features/documents";
import { 
  INTERACTION_TYPE_CONFIGS, 
  getSpecializedRouteTypes,
  getInteractionTypesByCategory,
  type InteractionTypeConfig 
} from "@interactions/constants/interactionTypes";
import type { InteractionStatus, InteractionType } from "@interactions/types";

// Action personnalisée (locale)
export interface CustomAction {
  key: string;
  labelKey: string;
  descriptionKey?: string;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
  category?: string;
}

// Action basée sur un type d'interaction
export interface InteractionAction {
  type: InteractionType;
  category?: string; // Override de la catégorie par défaut
}

// Configuration des props
export interface ActionsGridProps {
  // Actions d'interactions (utilise les configs centralisées)
  interactionActions?: InteractionAction[];
  // Actions custom/locales
  customActions?: CustomAction[];
  // Catégories à afficher (si non spécifié, toutes)
  categories?: string[];
  // Paramètres pour les interactions
  projectId?: string | null;
  returnTo?: string | null;
  zones?: string | null;
  // Callback pour les types d'interactions
  onInteractionTypeSelect?: (type: InteractionType) => void;
  // Layout
  showCategoryHeaders?: boolean;
  responsive?: boolean; // true = 2 col desktop, false = toujours 1 col
}

type ActionConfig = InteractionTypeConfig & {
  status?: InteractionStatus | "";
  isCustom?: boolean;
  onClick?: () => void;
  category: string; // Permet toute string au lieu de seulement les catégories prédéfinies
};

export default function ActionsGrid({
  interactionActions = [],
  customActions = [],
  categories,
  projectId,
  returnTo,
  zones,
  onInteractionTypeSelect,
  showCategoryHeaders = true,
  responsive = true,
}: ActionsGridProps) {
  const { t } = useI18n();
  const router = useRouter();
  const isMobile = useIsMobile();

  // Préparer les actions d'interactions
  const interactionConfigs: ActionConfig[] = interactionActions.map(action => ({
    ...INTERACTION_TYPE_CONFIGS[action.type],
    category: action.category || INTERACTION_TYPE_CONFIGS[action.type].category,
    status: INTERACTION_TYPE_CONFIGS[action.type].defaultStatus,
  }));

  // Préparer les actions custom
  const customConfigs: ActionConfig[] = customActions.map(action => ({
    ...INTERACTION_TYPE_CONFIGS.other, // Use a base config
    key: action.key,
    type: action.key as InteractionType, // Fake pour la compatibilité
    labelKey: action.labelKey,
    descriptionKey: action.descriptionKey || action.labelKey,
    icon: action.icon,
    color: action.color,
    category: action.category || "other",
    hasSpecializedRoute: false,
    isCustom: true,
    onClick: action.onClick,
  }));

  // Combiner toutes les actions
  const allActions = [...interactionConfigs, ...customConfigs];

  // Grouper par catégorie
  const actionsByCategory = allActions.reduce((acc, action) => {
    const category = action.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(action);
    return acc;
  }, {} as Record<string, ActionConfig[]>);

  // Filtrer par catégories si spécifié
  const filteredCategories = categories 
    ? Object.fromEntries(Object.entries(actionsByCategory).filter(([cat]) => categories.includes(cat)))
    : actionsByCategory;

  const handleActionClick = useCallback(
    (action: ActionConfig) => {
      if (action.isCustom && action.onClick) {
        action.onClick();
        return;
      }

      if (onInteractionTypeSelect) {
        onInteractionTypeSelect(action.type);
        return;
      }

      // Navigation automatique pour les types d'interactions
      const specializedTypes = getSpecializedRouteTypes();
      const params = new URLSearchParams();

      if (action.status) {
        params.set("status", action.status);
      }
      if (projectId) {
        params.set("projectId", projectId);
      }
      if (returnTo) {
        params.set("returnTo", returnTo);
      }
      if (zones) {
        params.set("zones", zones);
      }

      const queryString = params.toString();

      if (specializedTypes.includes(action.type)) {
        const url = `/app/interactions/new/${action.type}${queryString ? `?${queryString}` : ""}`;
        router.push(url);
      } else {
        params.set("type", action.type);
        router.push(`/app/interactions/new?${params.toString()}`);
      }
    },
    [router, onInteractionTypeSelect, projectId, returnTo, zones],
  );

  if (showCategoryHeaders) {
    return (
      <div className="space-y-6">
        <div className={`grid gap-6 ${responsive && !isMobile ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {Object.entries(filteredCategories).map(([category, actions]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t(`dashboard.quickActions.categories.${category}`)}
              </h3>
              <div className="grid gap-3 grid-cols-4">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Card
                      key={action.key}
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer border shadow-sm transition-all duration-200 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary-600 aspect-square"
                      onClick={() => handleActionClick(action)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleActionClick(action);
                        }
                      }}
                    >
                      <CardContent className="p-3 h-full flex flex-col items-center justify-center gap-2">
                        <div className={`p-2 rounded-md border ${action.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-medium text-foreground leading-tight">{t(action.labelKey)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Mode sans headers de catégories - grille simple
  return (
    <div className="grid gap-3 grid-cols-4">
      {Object.values(filteredCategories).flat().map((action) => {
        const Icon = action.icon;
        return (
          <Card
            key={action.key}
            role="button"
            tabIndex={0}
            className="group cursor-pointer border shadow-sm transition-all duration-200 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary-600 aspect-square"
            onClick={() => handleActionClick(action)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleActionClick(action);
              }
            }}
          >
            <CardContent className="p-3 h-full flex flex-col items-center justify-center gap-2">
              <div className={`p-2 rounded-md border ${action.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-foreground leading-tight">{t(action.labelKey)}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}