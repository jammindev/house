import * as React from 'react';

import { parseDecimalInput, toDecimalDisplay } from '@/lib/format';
import { Input, type InputProps } from './input';

export interface DecimalInputProps
  extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'inputMode' | 'step'> {
  /** Valeur **canonique** : séparateur point, telle qu'elle part vers l'API. */
  value: string;
  /** Reçoit la valeur canonique, jamais la frappe brute. */
  onChange: (value: string) => void;
  /** Décimales maximum — 2 pour un montant, 3 pour un index, 5 pour un tarif. */
  decimals?: number;
  /** Autorise le signe moins : un solde, un ajustement. Refusé par défaut. */
  allowNegative?: boolean;
}

/**
 * Le champ décimal de l'app — **jamais un `<input type="number">`**.
 *
 * Le HTML impose au `value` d'un champ `number` d'être un *valid floating-point
 * number* : le séparateur y est toujours le point, jamais celui de la locale. Une
 * virgule rend la valeur invalide, `e.target.value` renvoie du tronqué, React
 * réécrit ce tronqué dans le DOM et détruit le tampon de saisie — taper « 12,5 »
 * donnait `512` sur Chromium, `5` sur Safari et Firefox. Un montant faux, sans
 * message. Voir #448.
 *
 * Ici la frappe est lue par `parseDecimalInput` (les deux séparateurs, toujours),
 * le parent reçoit du canonique, et le champ réaffiche le séparateur de la
 * locale. Ce qui n'est pas décimal est ignoré : c'est le filtrage que `number`
 * assurait, rendu explicite.
 */
const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onChange, decimals = 2, allowNegative = false, placeholder, ...props }, ref) => {
    const [draft, setDraft] = React.useState<string | null>(null);
    const parseOptions = { decimals, allowNegative };

    // La frappe brute ne s'affiche que tant qu'elle dit la valeur du parent : dès
    // que celui-ci réécrit (ouverture de dialogue, reset après envoi), c'est la
    // sienne qu'on relit — sans quoi le champ garderait un fantôme de la saisie
    // précédente.
    const display =
      draft !== null && parseDecimalInput(draft, parseOptions) === value
        ? draft
        : toDecimalDisplay(value);

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        // Un gabarit chiffré (« 0.00 ») se lit dans la locale comme la valeur ;
        // un gabarit en prose traverse inchangé.
        placeholder={placeholder ? toDecimalDisplay(String(placeholder)) : placeholder}
        value={display}
        onChange={(event) => {
          const raw = event.target.value;
          const parsed = parseDecimalInput(raw, parseOptions);
          if (parsed === null) return; // frappe refusée : lettre, 3e décimale, moins…
          setDraft(raw);
          onChange(parsed);
        }}
      />
    );
  },
);
DecimalInput.displayName = 'DecimalInput';

export { DecimalInput };
