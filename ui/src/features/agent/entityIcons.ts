import {
  FileText, Notebook, Wrench, ListTodo, FolderKanban, MapPin,
  Box, ShieldCheck, User, Building2, ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Maps an agent `entity_type` to its lucide icon. Shared by every place that
 * renders an entity chip (citations, the "what I know" context panel, the
 * context picker) so a new entity type gets a consistent icon in one edit.
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
};

/** Generic fallback glyph for an unmapped entity type. */
export const ENTITY_ICON_FALLBACK: LucideIcon = ExternalLink;
