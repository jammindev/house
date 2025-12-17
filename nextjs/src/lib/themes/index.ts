// nextjs/src/lib/themes/index.ts
/**
 * Point d'entrée principal pour le système de thèmes
 * Réexporte toutes les fonctionnalités liées aux thèmes
 */

export {
    AVAILABLE_THEMES,
    getDefaultTheme,
    isValidTheme,
    getThemeInfo,
    getThemesByCategory,
    type ThemeOption
} from './themes.config';
