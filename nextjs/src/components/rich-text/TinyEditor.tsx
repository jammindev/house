// Shared TinyMCE editor component
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import "@/styles/tinymce-overrides.css";
import { useI18n } from "@/lib/i18n/I18nProvider";

const DEFAULT_THEME_COLORS = {
    background: "#ffffff",
    surface: "#f8fafc",
    foreground: "#0f172a",
    muted: "#475569",
    border: "#e2e8f0",
    primary: "#0ea5e9",
    primaryForeground: "#ffffff",
};

const toCssColor = (value: string, fallback: string) => {
    const normalized = value.trim();
    if (!normalized) return fallback;
    if (/^[\d.]+\s+[\d.]+%\s+[\d.]+%/.test(normalized)) {
        return `hsl(${normalized})`;
    }
    return normalized;
};

type TinyEditorProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    textareaName?: string;
    placeholder?: string;
    height?: number;
    initOverrides?: Record<string, unknown>;
};

const Editor = dynamic(
    async () => {
        const [tinymceReact] = await Promise.all([import("@tinymce/tinymce-react"), import("tinymce/tinymce")]);

        // Load icons/themes/plugins after tinymce has been initialized on window.
        await import("tinymce/icons/default");
        await import("tinymce/themes/silver");
        await import("tinymce/models/dom");
        await import("tinymce/plugins/autolink");
        await import("tinymce/plugins/code");
        await import("tinymce/plugins/link");
        await import("tinymce/plugins/lists");
        await import("tinymce/plugins/table");
        await import("tinymce/plugins/advlist");
        await import("tinymce/plugins/autosave");
        await import("tinymce/plugins/wordcount");
        await import("tinymce/plugins/quickbars");

        return tinymceReact.Editor;
    },
    { ssr: false }
);

const TINYMCE_CDN_BASE = "https://cdn.jsdelivr.net/npm/tinymce@8.3.0/skins";

export function TinyEditor({
    id,
    value,
    onChange,
    textareaName,
    placeholder,
    height = 640,
    initOverrides,
}: TinyEditorProps) {
    const { t, locale } = useI18n();

    const themeColors = useMemo(() => {
        if (typeof window === "undefined") {
            return { ...DEFAULT_THEME_COLORS, colorScheme: "light" as const };
        }
        const styles = getComputedStyle(document.documentElement);
        const colorScheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
        const color = (token: string, fallback: string) => toCssColor(styles.getPropertyValue(token), fallback);

        return {
            colorScheme,
            background: color("--background", DEFAULT_THEME_COLORS.background),
            surface: color("--card", DEFAULT_THEME_COLORS.surface),
            foreground: color("--foreground", DEFAULT_THEME_COLORS.foreground),
            muted: color("--muted-foreground", DEFAULT_THEME_COLORS.muted),
            border: color("--border", DEFAULT_THEME_COLORS.border),
            primary: color("--primary", DEFAULT_THEME_COLORS.primary),
            primaryForeground: color("--primary-foreground", DEFAULT_THEME_COLORS.primaryForeground),
        };
    }, []);

    const contentStyle = useMemo(() => {
        const { colorScheme, background, surface, foreground, muted, border, primary } = themeColors;
        const fontStack = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

        return `
:root { color-scheme: ${colorScheme}; }
body { background: ${surface}; color: ${foreground}; font-family: ${fontStack}; font-size: 16px; line-height: 1.6; margin: 0; padding: 14px 16px; -webkit-text-size-adjust: 100%; }
p { margin: 0.35rem 0 1.1rem; }
h1 { margin: 1.4rem 0 0.95rem; font-size: 1.4rem; font-weight: 700; line-height: 1.3; color: ${foreground}; }
h2 { margin: 1.2rem 0 0.85rem; font-size: 1.2rem; font-weight: 700; line-height: 1.35; color: ${foreground}; }
h3 { margin: 1rem 0 0.75rem; font-size: 1.05rem; font-weight: 600; line-height: 1.4; color: ${foreground}; }
ul, ol { margin: 0.8rem 0 0.9rem; padding-left: 1.25rem; }
li { margin: 0.25rem 0; }
a { color: ${primary}; text-decoration: underline; }
a:hover { color: ${primary}; opacity: 0.9; }
blockquote { margin: 1rem 0; padding: 0.75rem 1rem; border-left: 4px solid ${border}; background: ${background}; color: ${muted}; border-radius: 10px; }
code { background: ${background}; color: ${foreground}; padding: 2px 6px; border-radius: 8px; border: 1px solid ${border}; font-family: SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.875em; }
pre { background: ${background}; color: ${foreground}; padding: 12px 14px; border-radius: 10px; border: 1px solid ${border}; white-space: pre-wrap; font-size: 0.875em; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875em; }
th, td { border: 1px solid ${border}; padding: 8px 10px; }
th { background: ${surface}; color: ${foreground}; font-weight: 600; text-align: left; }
img { max-width: 100%; height: auto; border-radius: 12px; }
hr { border: none; border-top: 1px solid ${border}; margin: 1.25rem 0; }
strong { color: ${foreground}; }
`;
    }, [themeColors]);

    // Ensure TinyMCE skins/content CSS are available
    useEffect(() => {
        if (typeof document === "undefined") return;
        const ensureLink = (linkId: string, href: string) => {
            if (document.getElementById(linkId)) return;
            const link = document.createElement("link");
            link.id = linkId;
            link.rel = "stylesheet";
            link.href = href;
            document.head.appendChild(link);
        };
        ensureLink("tinymce-skin-oxide", `${TINYMCE_CDN_BASE}/ui/oxide/skin.min.css`);
        ensureLink("tinymce-content-default", `${TINYMCE_CDN_BASE}/content/default/content.min.css`);
    }, []);

    const editorInit = useMemo(() => {
        const baseConfig = {
            menubar: false,
            branding: false,
            height,
            license_key: "gpl",
            plugins: ["autolink", "link", "lists", "advlist", "quickbars"],
            block_formats: "Paragraphe=p; Titre 1=h1; Titre 2=h2; Titre 3=h3",
            toolbar:
                "undo redo | formatselect | bold italic underline | forecolor backcolor | bullist numlist outdent indent | link | removeformat",
            quickbars_selection_toolbar: "bold italic underline | h1 h2 h3 | bullist numlist | link",
            quickbars_insert_toolbar: "quicklink",
            automatic_uploads: false,
            toolbar_mode: "wrap",
            statusbar: false,
            placeholder: placeholder || t("interactionsrawPlaceholder"),
            content_style: contentStyle,
            skin: false,
            content_css: false,
            mobile: {
                toolbar:
                    "undo redo | formatselect | bold italic underline | bullist numlist | forecolor backcolor | link | removeformat",
                toolbar_mode: "wrap",
            },
            language: locale === "fr" ? "fr_FR" : "en",
            language_url: locale === "fr" ? "/tinymce/fr_FR.js" : undefined,
        };

        return {
            ...baseConfig,
            ...(initOverrides || {}),
        };
    }, [contentStyle, height, initOverrides, locale, placeholder, t]);

    return (
        <Editor
            id={id}
            apiKey="no-api-key"
            init={editorInit}
            value={value}
            onEditorChange={(nextValue) => onChange(nextValue)}
            textareaName={textareaName}
        />
    );
}

export default TinyEditor;
