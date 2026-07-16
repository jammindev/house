import {
  AlertCircle, LayoutDashboard, Sparkles, User,
  type LucideIcon,
} from 'lucide-react';
import { MODULES } from '@/lib/modules';

/**
 * Registre du contenu des tutoriels — la SEULE source de vérité côté code.
 *
 * Toute la prose vit dans les fichiers de traduction (namespace `tutorials`) :
 * - guide     → `tutorials.guide.<key>.title` / `.intro`
 *               `tutorials.guide.<key>.steps.<stepId>.title` / `.body`
 * - checklist → `tutorials.start.items.<key>.title` / `.description`
 *
 * Maintenance (voir skill `/tutorials`) : ajouter une feature = une entrée ici
 * (ou un stepId dans un guide existant) + les clés dans les 4 locales. Aucun
 * backend à toucher : la progression est stockée comme liste de clés opaques
 * sur `User.completed_tutorials`.
 *
 * Les guides adossés à un module (`moduleKey`) héritent de son icône et sont
 * masqués quand le module est désactivé pour le foyer.
 */

export interface TutorialGuide {
  /** Clé stable — i18n `tutorials.guide.<key>.*` + progression `guide.<key>`. */
  key: string;
  /** Module du registre MODULES : icône partagée + masquage si désactivé. */
  moduleKey?: string;
  /** Icône explicite pour les guides hors module (dashboard, agent…). */
  Icon?: LucideIcon;
  /** Deep-link vers la page concernée par le guide. */
  to: string;
  /** Ids sémantiques des étapes — stables même si on insère/réordonne. */
  stepIds: string[];
}

export interface GettingStartedItem {
  /** Clé stable — i18n `tutorials.start.items.<key>.*` + progression `start.<key>`. */
  key: string;
  /** Deep-link vers la page où réaliser l'action. */
  to: string;
  /** Masque l'item si ce module est désactivé pour le foyer. */
  moduleKey?: string;
}

/** Checklist « Bien démarrer » — les premières actions clés dans l'app. */
export const GETTING_STARTED: GettingStartedItem[] = [
  { key: 'create-zone', to: '/app/zones', moduleKey: 'zones' },
  { key: 'add-equipment', to: '/app/equipment', moduleKey: 'equipment' },
  { key: 'first-task', to: '/app/tasks', moduleKey: 'tasks' },
  { key: 'log-note', to: '/app/interactions', moduleKey: 'interactions' },
  { key: 'ask-agent', to: '/app/agent' },
  { key: 'invite-member', to: '/app/settings' },
];

/** Guides — pages transverses d'abord, puis un guide par module (ordre MODULES). */
export const TUTORIAL_GUIDES: TutorialGuide[] = [
  { key: 'dashboard', Icon: LayoutDashboard, to: '/app/dashboard', stepIds: ['overview', 'activity', 'alerts'] },
  { key: 'agent', Icon: Sparkles, to: '/app/agent', stepIds: ['ask', 'citations', 'web', 'context', 'create', 'memory'] },
  { key: 'zones', moduleKey: 'zones', to: '/app/zones', stepIds: ['create', 'hierarchy', 'navigate'] },
  { key: 'equipment', moduleKey: 'equipment', to: '/app/equipment', stepIds: ['add', 'purchase', 'history'] },
  { key: 'electricity', moduleKey: 'electricity', to: '/app/electricity', stepIds: ['board', 'readings', 'analyze'] },
  { key: 'water', moduleKey: 'water', to: '/app/water', stepIds: ['readings', 'charts'] },
  { key: 'weather', moduleKey: 'weather', to: '/app/weather', stepIds: ['location', 'forecast', 'dashboard', 'alerts'] },
  { key: 'stock', moduleKey: 'stock', to: '/app/stock', stepIds: ['add', 'quantities', 'expiry'] },
  { key: 'chickens', moduleKey: 'chickens', to: '/app/chickens', stepIds: ['flock', 'eggs', 'events', 'stats'] },
  { key: 'insurance', moduleKey: 'insurance', to: '/app/insurance', stepIds: ['contracts', 'documents'] },
  { key: 'tasks', moduleKey: 'tasks', to: '/app/tasks', stepIds: ['create', 'organize', 'weather', 'complete'] },
  { key: 'projects', moduleKey: 'projects', to: '/app/projects', stepIds: ['create', 'plan', 'budget'] },
  { key: 'interactions', moduleKey: 'interactions', to: '/app/interactions', stepIds: ['log', 'types', 'link'] },
  { key: 'trackers', moduleKey: 'trackers', to: '/app/trackers', stepIds: ['create', 'entries', 'charts'] },
  { key: 'expenses', moduleKey: 'expenses', to: '/app/expenses', stepIds: ['record', 'sources', 'review'] },
  { key: 'documents', moduleKey: 'documents', to: '/app/documents', stepIds: ['upload', 'link', 'find'] },
  { key: 'photos', moduleKey: 'photos', to: '/app/photos', stepIds: ['browse', 'add'] },
  { key: 'directory', moduleKey: 'directory', to: '/app/directory', stepIds: ['contacts', 'structures'] },
  { key: 'alerts', Icon: AlertCircle, to: '/app/alerts', stepIds: ['review', 'act'] },
  { key: 'settings', Icon: User, to: '/app/settings', stepIds: ['profile', 'household', 'modules'] },
];

/** Clé de progression d'un guide, telle que stockée sur l'utilisateur. */
export function guideDoneKey(key: string): string {
  return `guide.${key}`;
}

/** Clé de progression d'un item de checklist. */
export function startDoneKey(key: string): string {
  return `start.${key}`;
}

const MODULE_ICONS = new Map(MODULES.map((m) => [m.key, m.Icon]));

function resolveIcon(guide: TutorialGuide): LucideIcon {
  if (guide.moduleKey) {
    const icon = MODULE_ICONS.get(guide.moduleKey);
    if (icon) return icon;
  }
  return guide.Icon ?? Sparkles;
}

/** Icône par guide — celle du module s'il y en a un, sinon l'explicite.
 *  Précalculé au chargement pour garder des références de composant stables. */
export const GUIDE_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  TUTORIAL_GUIDES.map((g) => [g.key, resolveIcon(g)]),
);

export function findGuide(key: string | undefined): TutorialGuide | undefined {
  return TUTORIAL_GUIDES.find((g) => g.key === key);
}
