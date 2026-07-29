import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Input } from '@/design-system/input';
import { cn } from '@/lib/utils';
import { useTransientLayer } from '@/lib/transientLayers';
import { useSuppliers } from './hooks';
import { matchSuppliers } from './suppliers';

/**
 * Le champ fournisseur de toute l'application — le catalogue, cherchable.
 *
 * Il remplace six `<Input>` nus. Ce n'était pas qu'une gêne de frappe : rien
 * n'empêchait « Leroy Merlin », « leroy merlin » et « LEROY MERLIN » de devenir
 * trois fournisseurs, donc trois chips de filtre et trois lignes de
 * `by_supplier` pour un seul magasin.
 *
 * **Un combobox et non un `<select>`**, et c'est la contrainte structurante : un
 * fournisseur inconnu doit rester saisissable sur place. Un select fermé
 * imposerait de déclarer le magasin avant de pouvoir enregistrer la dépense qui
 * le fait connaître — le formulaire en trop que ce chantier supprime. Le texte
 * tapé **est** la valeur ; le serveur l'inscrit au catalogue et renvoie
 * l'orthographe canonique (`register_supplier`), donc choisir et taper mènent au
 * même endroit et les valeurs convergent d'elles-mêmes.
 *
 * Conséquence assumée : `onChange` part à chaque frappe, comme l'`<input>` qu'il
 * remplace. Aucun appelant n'a de logique de « commit », et un champ qui ne
 * remonterait sa valeur qu'à la fermeture du panneau perdrait la saisie de
 * quelqu'un qui enregistre sans quitter le champ.
 */

interface SupplierComboboxProps {
  /** id du champ — à apparier avec le `htmlFor` du FormField. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Nom proposé si le champ est vide à l'ouverture du panneau — la dérivation du
   * libellé bancaire (`supplier_guess`). Une **proposition**, jamais une
   * écriture : elle n'est appliquée que si on la choisit.
   */
  suggestion?: string;
}

export default function SupplierCombobox({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  suggestion,
}: SupplierComboboxProps) {
  const { t } = useTranslation();
  const { data: suppliers = [] } = useSuppliers();

  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const close = React.useCallback(() => setOpen(false), []);
  // Tant que le panneau est ouvert, il revendique Échap face au dialog parent :
  // ce champ vit dans des SheetDialog, et refermer une liste ne doit pas fermer
  // le formulaire ni perdre la saisie.
  useTransientLayer(open);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, close]);

  const matches = React.useMemo(() => matchSuppliers(suppliers, value), [suppliers, value]);

  // Un nom tapé qui ne figure pas encore au catalogue : on le dit, pour que
  // « aucune correspondance » ne se lise pas comme « saisie refusée ».
  const isNew =
    value.trim().length > 0 &&
    !suppliers.some((row) => row.name.toLowerCase() === value.trim().toLowerCase());

  const showSuggestion = Boolean(suggestion) && value.trim().length === 0;

  React.useEffect(() => setHighlight(0), [value, open]);

  const pick = (name: string) => {
    onChange(name);
    close();
    inputRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (matches.length === 0) return;
      setHighlight((previous) => {
        const next = event.key === 'ArrowDown' ? previous + 1 : previous - 1;
        return (next + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === 'Enter' && open && matches.length > 0) {
      // Entrée choisit dans la liste au lieu de valider le formulaire : le
      // panneau est ouvert, donc le geste en cours est le choix.
      event.preventDefault();
      pick(matches[highlight].name);
      return;
    }
    if (event.key === 'Tab') close();
  };

  const listboxId = `${id}-listbox`;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t('suppliers.placeholder')}
          className="pr-9"
          // Le catalogue du foyer est la bonne liste ; celle du navigateur
          // superposerait ses propres suggestions au panneau, sur un champ dont
          // les valeurs ne veulent rien dire hors de ce foyer.
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={t('suppliers.toggle')}
          onClick={() => {
            setOpen((previous) => !previous);
            inputRef.current?.focus();
          }}
          className="absolute right-0 top-0 flex h-10 w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t('suppliers.listLabel')}
          className="absolute z-50 mt-1 max-h-56 w-full min-w-[14rem] overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {showSuggestion ? (
            <button
              type="button"
              onClick={() => pick(suggestion as string)}
              className="flex w-full items-start gap-2 border-b border-border px-3 py-1.5 text-left text-sm hover:bg-muted"
            >
              <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{suggestion}</span>
                <span className="block text-xs text-muted-foreground">
                  {t('suppliers.fromLabel')}
                </span>
              </span>
            </button>
          ) : null}

          {matches.map((row, index) => (
            <button
              key={row.name}
              type="button"
              role="option"
              aria-selected={row.name === value}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => pick(row.name)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                index === highlight && 'bg-muted',
              )}
            >
              <span className="w-4 shrink-0">
                {row.name === value ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">{row.name}</span>
              {row.count > 0 ? (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {row.count}
                </span>
              ) : null}
            </button>
          ))}

          {matches.length === 0 && !showSuggestion ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {isNew ? t('suppliers.willBeAdded') : t('suppliers.empty')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
