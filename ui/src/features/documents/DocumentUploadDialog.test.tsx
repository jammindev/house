import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentUploadDialog from './DocumentUploadDialog';
import type { DocumentDetail, UploadDocumentInput } from '@/lib/api/documents';

// jsdom n'implémente pas `matchMedia`, dont dépend `useIsMobile` (SheetDialog).
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

// Le vrai sélecteur charge l'arborescence du foyer ; ici seule compte la zone
// qu'il renvoie, appliquée à tout le lot.
vi.mock('@/features/zones/ZonePicker', () => ({
  default: ({ id }: { id?: string }) => <input id={id} readOnly value="" />,
}));

const uploadDocument = vi.fn<(input: UploadDocumentInput) => Promise<{ document: DocumentDetail }>>();

vi.mock('./hooks', () => ({
  useCreateDocument: () => ({
    mutateAsync: (input: UploadDocumentInput) => uploadDocument(input),
    isPending: false,
  }),
}));

function created(name: string): { document: DocumentDetail } {
  return { document: { id: `doc-${name}`, name } as DocumentDetail };
}

function photo(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

/** Sélectionne des fichiers dans le champ du dialogue. */
async function pick(...files: File[]) {
  const input = screen.getByLabelText(/documents.new.selectFiles/) as HTMLInputElement;
  await userEvent.upload(input, files);
}

/**
 * Le champ fichier est `required`, et jsdom déclare un `<input type="file">`
 * invalide même quand `files` est rempli : un clic sur le bouton n'y soumet
 * jamais le formulaire. Le geste utilisateur reste le clic — c'est le moteur qui
 * ne sait pas le rendre.
 */
function submit() {
  const button = screen.getByRole('button', { name: 'documents.upload.submit' });
  return fireEvent.submit(button.closest('form') as HTMLFormElement);
}

/**
 * Ce que ces tests tiennent :
 *
 * 1. **Un lot part en entier, en une ouverture.** Les cinq surfaces d'upload de
 *    l'app (galerie, onglet photos d'une entité, documents, onglet documents,
 *    fiche dépense) partagent ce dialogue : c'est ici — et nulle part ailleurs —
 *    que se décide s'il faut dix ouvertures pour dix photos d'un chantier.
 * 2. **Un fichier qui échoue n'emporte pas ceux qui sont passés.** L'envoi est
 *    séquentiel, fichier par fichier, précisément pour que l'échec du huitième
 *    laisse les sept premiers dans le foyer.
 * 3. **Relancer ne renvoie que ce qui a échoué.** Sans ça, réessayer créerait un
 *    doublon de chaque fichier déjà arrivé — l'app fabriquerait le ménage qu'elle
 *    prétend éviter.
 * 4. **Le nom saisi ne vaut que pour un fichier seul.** Appliqué à un lot, il
 *    donnerait vingt documents portant le même nom, indistinguables.
 */
describe('téléverser plusieurs fichiers en une fois', () => {
  beforeEach(() => {
    uploadDocument.mockReset();
    uploadDocument.mockImplementation((input) => Promise.resolve(created(input.file.name)));
  });

  it('envoie tout le lot et remonte chaque document créé', async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DocumentUploadDialog open onOpenChange={onOpenChange} onSaved={onSaved} forcedType="photo" />,
    );

    await pick(photo('a.jpg'), photo('b.jpg'), photo('c.jpg'));
    await submit();

    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(3));
    expect(uploadDocument.mock.calls.map(([input]) => input.file.name)).toEqual([
      'a.jpg',
      'b.jpg',
      'c.jpg',
    ]);
    expect(onSaved).toHaveBeenCalledTimes(3);
    expect(onSaved.mock.calls.map(([doc]) => doc.id)).toEqual([
      'doc-a.jpg',
      'doc-b.jpg',
      'doc-c.jpg',
    ]);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('garde le lot ouvert quand un fichier échoue, sans perdre les autres', async () => {
    uploadDocument.mockImplementation((input) =>
      input.file.name === 'b.jpg'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(created(input.file.name)),
    );
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DocumentUploadDialog open onOpenChange={onOpenChange} onSaved={onSaved} forcedType="photo" />,
    );

    await pick(photo('a.jpg'), photo('b.jpg'), photo('c.jpg'));
    await submit();

    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(3));
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText(/documents.upload.someFailed/)).toBeInTheDocument();
  });

  it('ne renvoie que les fichiers en échec quand on relance', async () => {
    let failing = true;
    uploadDocument.mockImplementation((input) =>
      input.file.name === 'b.jpg' && failing
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(created(input.file.name)),
    );
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DocumentUploadDialog open onOpenChange={onOpenChange} onSaved={onSaved} forcedType="photo" />,
    );

    await pick(photo('a.jpg'), photo('b.jpg'), photo('c.jpg'));
    await submit();
    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(3));

    failing = false;
    uploadDocument.mockClear();
    await submit();

    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(1));
    expect(uploadDocument.mock.calls[0][0].file.name).toBe('b.jpg');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('applique le nom saisi à un fichier seul, jamais à un lot', async () => {
    const { rerender } = render(
      <DocumentUploadDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} forcedType="photo" />,
    );

    await pick(photo('a.jpg'));
    await userEvent.clear(screen.getByLabelText('documents.fieldName'));
    await userEvent.type(screen.getByLabelText('documents.fieldName'), 'Toiture');
    await submit();

    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(1));
    expect(uploadDocument.mock.calls[0][0].name).toBe('Toiture');

    // Un lot : le champ « nom » disparaît, chaque document garde son fichier.
    uploadDocument.mockClear();
    rerender(
      <DocumentUploadDialog
        open={false}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        forcedType="photo"
      />,
    );
    rerender(
      <DocumentUploadDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} forcedType="photo" />,
    );

    await pick(photo('a.jpg'), photo('b.jpg'));
    expect(screen.queryByLabelText('documents.fieldName')).not.toBeInTheDocument();
    await submit();

    await waitFor(() => expect(uploadDocument).toHaveBeenCalledTimes(2));
    for (const [input] of uploadDocument.mock.calls) expect(input.name).toBeUndefined();
  });
});
