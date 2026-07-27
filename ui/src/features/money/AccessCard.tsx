import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Card } from '@/design-system/card';
import { pushBack } from '@/lib/backNavigation';

interface AccessCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  hint: string;
}

/**
 * Une porte vers une sous-page du module Argent — analyse, récurrences, bilans.
 *
 * Le panneau Budgets en portait trois, écrites trois fois à l'identique en
 * `<div className="rounded-lg border border-border bg-card …">`, alors que la
 * règle du projet dit de toujours passer par `Card`. Le balisage manuel n'était
 * pas qu'une entorse de style : il refait à la main ce que `Card` garantit
 * (rayon, bordure, fond en tokens), donc il dérive au premier ajustement du
 * design-system, et seulement sur ces trois cartes-là.
 *
 * Le `pushBack` est intégré : une sous-page ouverte d'ici doit revenir ici, et
 * l'oublier sur une seule des trois portes est exactement le genre d'écart qu'un
 * composant partagé rend impossible.
 */
export default function AccessCard({ to, icon: Icon, title, hint }: AccessCardProps) {
  const location = useLocation();
  return (
    <Link to={to} state={pushBack(location)} className="group block">
      <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/60">
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground group-hover:underline">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Card>
    </Link>
  );
}
