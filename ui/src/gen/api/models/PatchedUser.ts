/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { ColorThemeEnum } from './ColorThemeEnum';
import type { LocaleEnum } from './LocaleEnum';
import type { NullEnum } from './NullEnum';
import type { ThemeEnum } from './ThemeEnum';
export type PatchedUser = {
    readonly id?: number;
    email?: string;
    first_name?: string;
    last_name?: string;
    /**
     * Display name shown in the UI
     */
    display_name?: string;
    /**
     * User's preferred language. Null means use browser detection.
     *
     * * `en` - English
     * * `fr` - Français
     * * `de` - Deutsch
     * * `es` - Español
     */
    locale?: (LocaleEnum | BlankEnum | NullEnum) | null;
    /**
     * User's avatar image file
     */
    avatar?: string | null;
    /**
     * User's preferred theme (light/dark/system)
     *
     * * `light` - Light
     * * `dark` - Dark
     * * `system` - System
     */
    theme?: (ThemeEnum | BlankEnum);
    /**
     * User's preferred color palette
     *
     * * `theme-house` - House
     * * `theme-blue` - Blue
     * * `theme-sass` - Sass
     * * `theme-sass2` - Sass 2
     * * `theme-sass3` - Sass 3
     * * `theme-purple` - Purple
     * * `theme-green` - Green
     * * `theme-crimson` - Crimson
     * * `theme-teal` - Teal
     * * `theme-amber` - Amber
     * * `theme-indigo` - Indigo
     * * `theme-rose` - Rose
     * * `theme-cyan` - Cyan
     * * `theme-slate` - Slate
     * * `theme-emerald` - Emerald
     * * `theme-lavender` - Lavender
     * * `theme-midnight` - Midnight
     */
    color_theme?: (ColorThemeEnum | BlankEnum);
    /**
     * Return display_name if set, otherwise first_name + last_name
     */
    readonly full_name?: string;
    password?: string;
    readonly is_active?: boolean;
    readonly is_staff?: boolean;
    readonly date_joined?: string;
};

