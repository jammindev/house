/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { LocaleEnum } from './LocaleEnum';
import type { ThemeEnum } from './ThemeEnum';
export type User = {
    readonly id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    /**
     * Display name shown in the UI
     */
    display_name?: string;
    /**
     * User's preferred language
     *
     * * `en` - English
     * * `fr` - Français
     * * `de` - Deutsch
     * * `es` - Español
     */
    locale?: LocaleEnum;
    /**
     * URL to user's avatar image
     */
    readonly avatar_url: string;
    /**
     * User's avatar image file
     */
    avatar?: string | null;
    /**
     * User's preferred theme
     *
     * * `light` - Light
     * * `dark` - Dark
     * * `system` - System
     */
    theme?: (ThemeEnum | BlankEnum);
    /**
     * Return display_name if set, otherwise first_name + last_name
     */
    readonly full_name: string;
    password?: string;
    is_active?: boolean;
    readonly is_staff: boolean;
    readonly date_joined: string;
};

