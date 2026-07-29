import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DecimalInput } from './decimal-input';
import { decimalSeparator } from '@/lib/format';

const SEP = decimalSeparator();

/** Champ contrôlé, exactement comme les dialogues de l'app. */
function Harness({
  onValue,
  ...props
}: { onValue?: (v: string) => void } & Partial<React.ComponentProps<typeof DecimalInput>>) {
  const [value, setValue] = React.useState('');
  return (
    <DecimalInput
      aria-label="montant"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
      {...props}
    />
  );
}

/**
 * Le garde-fou : plus aucun champ décimal en `type="number"` dans le front.
 *
 * Un pas fractionnaire est la signature d'un champ décimal, et un champ décimal
 * ne peut pas être un `<input type="number">` — voir le bug #448 juste en
 * dessous. Le contrôle porte sur le pas et non sur `type="number"` : les
 * compteurs entiers (nombre de circuits, de lignes à importer) restent des
 * champs `number` légitimes, avec leurs flèches.
 *
 * Sans ce test, la substitution des trente-cinq champs se referait à la main à
 * chaque branche en cours : les deux dialogues « espèces » d'une PR ouverte au
 * moment du fix réintroduisaient déjà le motif.
 */
const sources = import.meta.glob<string>('../{features,components,design-system,lib}/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('aucun champ décimal ne revient en type="number"', () => {
  it('aucun pas fractionnaire dans le front — un décimal passe par DecimalInput', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.includes('.test.'))
      .filter(([, source]) => /step=["{]0\./.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});

describe('DecimalInput — régression #448', () => {
  it('accepte la virgule : la frappe reste lisible, la valeur part à point', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const field = screen.getByLabelText('montant');

    await userEvent.type(field, '12,5');

    // Ce que l'utilisateur voit : sa frappe, intacte.
    expect(field).toHaveValue('12,5');
    // Ce que le parent stocke et enverra à l'API : un décimal canonique.
    expect(onValue).toHaveBeenLastCalledWith('12.5');
  });

  it('accepte le point sur la même frappe — pavé numérique', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.type(screen.getByLabelText('montant'), '12.5');
    expect(onValue).toHaveBeenLastCalledWith('12.5');
  });

  it('n\'est pas un input number — sinon le navigateur reprend la main sur le séparateur', () => {
    render(<Harness />);
    const field = screen.getByLabelText('montant');
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('inputmode', 'decimal');
  });

  it('ignore la frappe qui n\'est pas décimale, sans vider ce qui est déjà saisi', async () => {
    render(<Harness />);
    const field = screen.getByLabelText('montant');
    await userEvent.type(field, '12,5abc€');
    expect(field).toHaveValue('12,5');
  });

  it('borne les décimales — un montant s\'arrête à deux', async () => {
    render(<Harness />);
    const field = screen.getByLabelText('montant');
    await userEvent.type(field, '12,555');
    expect(field).toHaveValue('12,55');
  });

  it('accepte trois décimales là où la feature en demande trois', async () => {
    render(<Harness decimals={3} />);
    const field = screen.getByLabelText('montant');
    await userEvent.type(field, '12,555');
    expect(field).toHaveValue('12,555');
  });

  it('refuse le moins par défaut, l\'accepte pour un solde', async () => {
    const { unmount } = render(<Harness />);
    await userEvent.type(screen.getByLabelText('montant'), '-12');
    expect(screen.getByLabelText('montant')).toHaveValue('12');
    unmount();

    render(<Harness allowNegative />);
    await userEvent.type(screen.getByLabelText('montant'), '-12');
    expect(screen.getByLabelText('montant')).toHaveValue('-12');
  });

  it('relit la valeur du parent dans la locale — un dialogue rouvert affiche « 12,50 »', () => {
    render(<DecimalInput aria-label="montant" value="12.50" onChange={() => {}} />);
    expect(screen.getByLabelText('montant')).toHaveValue(`12${SEP}50`);
  });

  it('lâche la frappe en cours dès que le parent réécrit la valeur (reset de dialogue)', async () => {
    function Resettable() {
      const [value, setValue] = React.useState('');
      return (
        <>
          <DecimalInput aria-label="montant" value={value} onChange={setValue} />
          <button onClick={() => setValue('')}>reset</button>
        </>
      );
    }
    render(<Resettable />);
    const field = screen.getByLabelText('montant');
    await userEvent.type(field, '12,5');
    expect(field).toHaveValue('12,5');
    await userEvent.click(screen.getByRole('button', { name: 'reset' }));
    expect(field).toHaveValue('');
  });
});
