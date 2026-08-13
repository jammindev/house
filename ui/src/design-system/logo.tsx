/**
 * La marque Maisonnée, en `currentColor`.
 *
 * ⚠️ **Jamais `--primary`.** `ui/src/styles/themes.css` porte 17 thèmes de
 * couleur que l'utilisateur choisit ; une marque adossée à `--primary` serait
 * repeinte par le thème du foyer, donc verte chez l'un et violette chez
 * l'autre — ce qui n'est pas une marque. Le signe hérite ici de la couleur du
 * texte, ce qui le rend juste dans les 17 thèmes, en clair comme en sombre,
 * sans qu'aucun d'eux ait à le connaître.
 *
 * La couleur de marque (`#3F5741`) n'existe donc que là où le thème ne va
 * jamais : favicon, icônes PWA, aperçu social, README. C'est délibéré, et c'est
 * documenté dans `docs/assets/brand/README.md`.
 *
 * Le tracé est celui de `docs/assets/brand/logo-mark.svg`, recopié plutôt
 * qu'importé : un `import` de SVG passerait par un plugin de bundler, ajouterait
 * une requête ou un asset au bundle, et rendrait la couleur dépendante de la
 * façon dont le plugin traite `currentColor`. Deux exemplaires d'un `d` de 120
 * caractères sont un moindre mal — et le test de non-régression du lot les
 * compare.
 */
interface LogoProps {
  /** Côté du carré, en pixels. 16 est la plus petite taille tenue. */
  size?: number;
  className?: string;
  /** Décoratif par défaut : le nom du produit est presque toujours écrit à côté. */
  title?: string;
}

export const LOGO_MARK_PATH =
  'M1 21v-7a11 11 0 0 1 22 0v7ZM10.6 19.8c-1-4 .8-8.2 4.6-9.6.9 4.2-1 8.2-4.6 9.6Z';

export function Logo({ size = 24, className, title }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" fillRule="evenodd" d={LOGO_MARK_PATH} />
    </svg>
  );
}

export default Logo;
