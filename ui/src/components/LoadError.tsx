import { Link } from 'react-router-dom';

interface LoadErrorProps {
  /** Message d'erreur (déjà traduit). */
  message: string;
  /** Lien de repli optionnel (ex: retour à la liste). */
  link?: { to: string; label: string };
}

/**
 * Encart d'erreur de chargement standard (token `destructive`).
 * Remplace le bloc `border-destructive/30 bg-destructive/10 …` recopié dans ~10 pages.
 */
export default function LoadError({ message, link }: LoadErrorProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      {message}
      {link ? (
        <Link to={link.to} className="ml-2 underline hover:no-underline">
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}
