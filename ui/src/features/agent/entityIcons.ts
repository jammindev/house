import {
  FileText, Notebook, Wrench, ListTodo, FolderKanban, MapPin,
  Box, ShieldCheck, User, Building2, ExternalLink,
  Bird, Egg, Gauge, PiggyBank, Repeat, LineChart, ShoppingCart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Maps an agent `entity_type` to its lucide icon. Shared by every place that
 * renders an entity chip (citations, the "what I know" context panel, the context
 * picker, the global search palette) so a new entity type gets a consistent icon in
 * one edit.
 *
 * It must cover every `entity_type` registered in `agent.searchables` — a type
 * missing here falls back to a generic glyph, and in the search palette that means
 * several groups of results looking alike. Tenu depuis Python, seul côté qui connaît
 * la liste : `agent/tests/test_global_search.py::TestThePaletteCoversTheRegistry`.
 */
export const ENTITY_ICONS: Record<string, LucideIcon> = {
  document: FileText,
  interaction: Notebook,
  equipment: Wrench,
  task: ListTodo,
  project: FolderKanban,
  zone: MapPin,
  stock_item: Box,
  insurance_contract: ShieldCheck,
  contact: User,
  structure: Building2,
  budget: PiggyBank,
  recurring_expense: Repeat,
  chicken: Bird,
  chicken_event: Egg,
  meter: Gauge,
  tracker: LineChart,
  shopping_item: ShoppingCart,
};

/** Generic fallback glyph for an unmapped entity type. */
export const ENTITY_ICON_FALLBACK: LucideIcon = ExternalLink;
