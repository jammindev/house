// nextjs/src/lib/themes/themes.config.ts
/**
 * Configuration centralisée des thèmes de l'application
 * Ce fichier contient les métadonnées de tous les thèmes disponibles
 */

export interface ThemeOption {
    value: string;
    label: string;
    description?: string;
    category?: 'warm' | 'cool' | 'neutral' | 'vibrant';
}

export const AVAILABLE_THEMES: ThemeOption[] = [
    {
        value: 'blue',
        label: 'theme.blue',
        description: 'theme.blueDescription',
        category: 'cool'
    },
    {
        value: 'sass',
        label: 'theme.sass',
        description: 'theme.sassDescription',
        category: 'vibrant'
    },
    {
        value: 'sass2',
        label: 'theme.sass2',
        description: 'theme.sass2Description',
        category: 'neutral'
    },
    {
        value: 'sass3',
        label: 'theme.sass3',
        description: 'theme.sass3Description',
        category: 'cool'
    },
    {
        value: 'house',
        label: 'theme.house',
        description: 'theme.houseDescription',
        category: 'warm'
    },
    {
        value: 'purple',
        label: 'theme.purple',
        description: 'theme.purpleDescription',
        category: 'vibrant'
    },
    {
        value: 'green',
        label: 'theme.green',
        description: 'theme.greenDescription',
        category: 'cool'
    },
    {
        value: 'crimson',
        label: 'theme.crimson',
        description: 'theme.crimsonDescription',
        category: 'warm'
    },
    {
        value: 'teal',
        label: 'theme.teal',
        description: 'theme.tealDescription',
        category: 'cool'
    },
    {
        value: 'amber',
        label: 'theme.amber',
        description: 'theme.amberDescription',
        category: 'warm'
    },
    {
        value: 'indigo',
        label: 'theme.indigo',
        description: 'theme.indigoDescription',
        category: 'cool'
    },
    {
        value: 'rose',
        label: 'theme.rose',
        description: 'theme.roseDescription',
        category: 'vibrant'
    },
    {
        value: 'cyan',
        label: 'theme.cyan',
        description: 'theme.cyanDescription',
        category: 'cool'
    },
    {
        value: 'slate',
        label: 'theme.slate',
        description: 'theme.slateDescription',
        category: 'neutral'
    },
    {
        value: 'emerald',
        label: 'theme.emerald',
        description: 'theme.emeraldDescription',
        category: 'cool'
    },
    {
        value: 'lavender',
        label: 'theme.lavender',
        description: 'theme.lavenderDescription',
        category: 'vibrant'
    },
    {
        value: 'midnight',
        label: 'theme.midnight',
        description: 'theme.midnightDescription',
        category: 'cool'
    },
];

/**
 * Obtient le thème par défaut depuis les variables d'environnement
 */
export function getDefaultTheme(): string {
    const envTheme = process.env.NEXT_PUBLIC_THEME;
    return envTheme?.startsWith('theme-') ? envTheme.slice(6) : (envTheme ?? 'sass3');
}

/**
 * Valide qu'un thème existe
 */
export function isValidTheme(theme: string): boolean {
    return AVAILABLE_THEMES.some(t => t.value === theme);
}

/**
 * Obtient les informations d'un thème
 */
export function getThemeInfo(themeValue: string): ThemeOption | undefined {
    return AVAILABLE_THEMES.find(t => t.value === themeValue);
}

/**
 * Obtient les thèmes groupés par catégorie
 */
export function getThemesByCategory() {
    return AVAILABLE_THEMES.reduce((acc, theme) => {
        const category = theme.category || 'neutral';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(theme);
        return acc;
    }, {} as Record<string, ThemeOption[]>);
}
