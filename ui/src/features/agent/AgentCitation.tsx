import { Link } from 'react-router-dom';
import {
  FileText, Notebook, Wrench, ListTodo, FolderKanban, MapPin,
  Box, ShieldCheck, User, Building2, ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AgentCitation as Citation } from './api';

const ENTITY_ICONS: Record<string, LucideIcon> = {
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

interface Props {
  citation: Citation;
  /** Numeric superscript shown alongside the chip (1-based) */
  index?: number;
}

export default function AgentCitation({ citation, index }: Props) {
  const Icon = ENTITY_ICONS[citation.entity_type] ?? ExternalLink;
  return (
    <Link
      to={citation.url_path}
      data-testid="agent-citation"
      data-entity-type={citation.entity_type}
      title={citation.snippet || citation.label}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
    >
      {typeof index === 'number' ? (
        <span className="font-semibold tabular-nums text-muted-foreground">{index}</span>
      ) : null}
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{citation.label}</span>
    </Link>
  );
}
