import { CalendarClock, FileText, FolderKanban, ListTodo, Plus, Settings2, Sparkles, type LucideIcon } from 'lucide-react';

import type { DashboardIconName, DashboardTone, InteractionTypeOption } from './types';

export const ICONS: Record<DashboardIconName, LucideIcon> = {
  activity: Sparkles,
  calendar: CalendarClock,
  documents: FileText,
  plus: Plus,
  projects: FolderKanban,
  settings: Settings2,
  tasks: ListTodo,
};

export const TONE_STYLES: Record<DashboardTone, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
};

export const SECTION_LAYOUT: Record<string, string> = {
  upcoming: 'lg:col-span-6',
  'pinned-projects': 'lg:col-span-6',
  tasks: 'xl:col-span-4',
  activity: 'xl:col-span-4',
  documents: 'xl:col-span-4',
};

export const INTERACTION_TYPE_OPTIONS: InteractionTypeOption[] = [
  {
    value: 'note',
    labelKey: 'dashboard.typePicker.types.note.label',
    fallbackLabel: 'Note',
    descriptionKey: 'dashboard.typePicker.types.note.description',
    fallbackDescription: 'Capture a free-form note.',
    primary: true,
  },
  {
    value: 'todo',
    labelKey: 'dashboard.typePicker.types.todo.label',
    fallbackLabel: 'Task',
    descriptionKey: 'dashboard.typePicker.types.todo.description',
    fallbackDescription: 'Track something that needs to be done.',
    primary: true,
  },
  {
    value: 'expense',
    labelKey: 'dashboard.typePicker.types.expense.label',
    fallbackLabel: 'Expense',
    descriptionKey: 'dashboard.typePicker.types.expense.description',
    fallbackDescription: 'Record a cost or purchase.',
    primary: true,
  },
  {
    value: 'maintenance',
    labelKey: 'dashboard.typePicker.types.maintenance.label',
    fallbackLabel: 'Maintenance',
    descriptionKey: 'dashboard.typePicker.types.maintenance.description',
    fallbackDescription: 'Log routine care or an intervention.',
    primary: true,
  },
  {
    value: 'repair',
    labelKey: 'dashboard.typePicker.types.repair.label',
    fallbackLabel: 'Repair',
    descriptionKey: 'dashboard.typePicker.types.repair.description',
    fallbackDescription: 'Track a fix for something broken.',
    primary: false,
  },
  {
    value: 'installation',
    labelKey: 'dashboard.typePicker.types.installation.label',
    fallbackLabel: 'Installation',
    descriptionKey: 'dashboard.typePicker.types.installation.description',
    fallbackDescription: 'Record a new setup or fitting.',
    primary: false,
  },
  {
    value: 'inspection',
    labelKey: 'dashboard.typePicker.types.inspection.label',
    fallbackLabel: 'Inspection',
    descriptionKey: 'dashboard.typePicker.types.inspection.description',
    fallbackDescription: 'Keep a trace of a check or review.',
    primary: false,
  },
  {
    value: 'warranty',
    labelKey: 'dashboard.typePicker.types.warranty.label',
    fallbackLabel: 'Warranty',
    descriptionKey: 'dashboard.typePicker.types.warranty.description',
    fallbackDescription: 'Store a warranty-related event.',
    primary: false,
  },
  {
    value: 'issue',
    labelKey: 'dashboard.typePicker.types.issue.label',
    fallbackLabel: 'Issue',
    descriptionKey: 'dashboard.typePicker.types.issue.description',
    fallbackDescription: 'Log a problem that needs attention.',
    primary: false,
  },
  {
    value: 'upgrade',
    labelKey: 'dashboard.typePicker.types.upgrade.label',
    fallbackLabel: 'Upgrade',
    descriptionKey: 'dashboard.typePicker.types.upgrade.description',
    fallbackDescription: 'Track an improvement or enhancement.',
    primary: false,
  },
  {
    value: 'replacement',
    labelKey: 'dashboard.typePicker.types.replacement.label',
    fallbackLabel: 'Replacement',
    descriptionKey: 'dashboard.typePicker.types.replacement.description',
    fallbackDescription: 'Record when something is replaced.',
    primary: false,
  },
  {
    value: 'disposal',
    labelKey: 'dashboard.typePicker.types.disposal.label',
    fallbackLabel: 'Disposal',
    descriptionKey: 'dashboard.typePicker.types.disposal.description',
    fallbackDescription: 'Keep a trace of removal or disposal.',
    primary: false,
  },
];
