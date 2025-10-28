// nextjs/src/app/app/(pages)/usePageLayoutConfig.ts
'use client';

import { useEffect } from 'react';
import { usePageLayout } from './layout';
import type { LucideIcon } from 'lucide-react';

interface UsePageLayoutConfigProps {
    title?: string;
    subtitle?: string;
    context?: string;
    hideBackButton?: boolean;
    actions?: {
        icon: LucideIcon;
        label?: string;
        href?: string;
        onClick?: () => void;
    }[];
}

/**
 * Permet de configurer le layout de page de manière déclarative.
 * Exemple :
 * usePageLayoutConfig({
 *   title: "Contacts",
 *   subtitle: "Gérez vos relations",
 *   actions: [{ icon: Plus, href: "/app/contacts/new" }],
 *   hideBackButton: true,
 * });
 */
export function usePageLayoutConfig({
    title,
    subtitle,
    context,
    hideBackButton,
    actions,
}: UsePageLayoutConfigProps) {
    const {
        setTitle,
        setSubtitle,
        setContext,
        setActions,
        setHideBackButton,
    } = usePageLayout();

    useEffect(() => {
        if (title) setTitle(title);
        if (subtitle !== undefined) setSubtitle(subtitle);
        if (context !== undefined) setContext(context);
        if (actions !== undefined) setActions(actions);
        if (hideBackButton !== undefined) setHideBackButton(hideBackButton);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, subtitle, context, hideBackButton, JSON.stringify(actions)]);
}
