"use client";

import Link, { type LinkProps } from "next/link";
import {
    forwardRef,
    type AnchorHTMLAttributes,
    type MouseEvent,
    type ReactNode,
    useEffect,
    useRef,
} from "react";
import { useRouter } from "next/navigation";
import { useNavigationOverlay } from "./NavigationOverlayProvider";

export interface LinkWithOverlayProps
    extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>,
    LinkProps {
    children: ReactNode;
    /**
     * Set to false to prevent the overlay for a specific link.
     */
    showOverlayOnNavigate?: boolean;
    disabled?: boolean;
}

const LinkWithOverlay = forwardRef<HTMLAnchorElement, LinkWithOverlayProps>(
    ({
        children,
        onClick,
        disabled = false,
        showOverlayOnNavigate = true,
        tabIndex,
        ...props
    },
        ref,
    ) => {
        const { showOverlay } = useNavigationOverlay();
        const router = useRouter();
        const timeoutRef = useRef<number | null>(null);

        useEffect(() => {
            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            };
        }, []);

        const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
            if (disabled) {
                event.preventDefault();
                return;
            }

            onClick?.(event);
            if (
                event.defaultPrevented ||
                event.metaKey ||
                event.altKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.button !== 0
            ) {
                return;
            }

            if (showOverlayOnNavigate) {
                // Prevent the default immediate navigation so we can show the overlay
                // and perform a programmatic navigation after a minimum delay (500ms).
                event.preventDefault();
                showOverlay();

                const href = props.href;
                const hrefString =
                    typeof href === "string"
                        ? href
                        : href instanceof URL
                            ? href.toString()
                            : (props.href as any)?.toString?.() ?? "/";

                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                timeoutRef.current = window.setTimeout(() => {
                    if ((props as any).target === "_blank") {
                        window.open(hrefString, "_blank");
                        return;
                    }

                    if ((props as any).replace) {
                        router.replace(hrefString);
                    } else {
                        router.push(hrefString);
                    }
                }, 500);
            }
        };

        return (
            <Link
                {...props}
                ref={ref}
                onClick={handleClick}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : tabIndex}
            >
                {children}
            </Link>
        );
    },
);

LinkWithOverlay.displayName = "LinkWithOverlay";

export default LinkWithOverlay;
