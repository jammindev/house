export type DashboardTone = 'slate' | 'sky' | 'amber' | 'emerald' | 'rose';
export type DashboardIconName = 'activity' | 'calendar' | 'documents' | 'plus' | 'projects' | 'settings' | 'tasks';

export interface DashboardMetaItem {
  label: string;
  labelKey?: string;
  value: string;
}

export interface DashboardBadge {
  label: string;
  tone: DashboardTone;
}

export interface DashboardItem {
  id: string;
  title: string;
  url?: string;
  description?: string;
  badge?: DashboardBadge;
  meta: DashboardMetaItem[];
}

export interface DashboardSection {
  id: string;
  title: string;
  titleKey?: string;
  description: string;
  descriptionKey?: string;
  href: string;
  hrefLabel: string;
  hrefLabelKey?: string;
  icon: DashboardIconName;
  emptyMessage: string;
  emptyMessageKey?: string;
  items: DashboardItem[];
}

export interface DashboardSummaryCard {
  id: string;
  label: string;
  labelKey?: string;
  value: number;
  helper: string;
  helperKey?: string;
  helperParams?: Record<string, string | number>;
  href: string;
  icon: DashboardIconName;
  tone: DashboardTone;
}

export interface DashboardQuickAction {
  label: string;
  labelKey?: string;
  href: string;
  icon: DashboardIconName;
  actionType?: 'link' | 'typePicker';
}

export interface DashboardHeader {
  eyebrow: string;
  eyebrowKey?: string;
  title: string;
  titleKey?: string;
  subtitle: string;
  subtitleKey?: string;
}

export interface DashboardEmptyState {
  title: string;
  titleKey?: string;
  description: string;
  descriptionKey?: string;
  href: string;
  hrefLabel: string;
  hrefLabelKey?: string;
}

export interface DashboardPageProps {
  header: DashboardHeader;
  summary: DashboardSummaryCard[];
  quickActions: DashboardQuickAction[];
  sections: DashboardSection[];
  emptyState?: DashboardEmptyState | null;
}

export interface InteractionTypeOption {
  value: string;
  labelKey: string;
  fallbackLabel: string;
  descriptionKey: string;
  fallbackDescription: string;
  primary: boolean;
}

export type DashboardTextResolver = (
  key: string | undefined,
  fallback: string,
  params?: Record<string, string | number>
) => string;
