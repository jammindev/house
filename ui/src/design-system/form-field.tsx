import * as React from 'react';
import { Label } from './label';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  /** Précision sous le champ — ce qu'un libellé ne peut pas dire sans devenir une phrase. */
  hint?: string;
}

export function FormField({ label, htmlFor, children, hint }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        /* `aria-describedby` volontairement absent : le champ est fourni par
           l'appelant, on ne peut pas lui greffer d'attribut d'ici. Le texte
           reste lu dans l'ordre du document, juste après le champ. */
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
