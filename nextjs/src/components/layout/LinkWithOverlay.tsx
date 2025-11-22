"use client";

import Link, { type LinkProps } from "next/link";
import {
    forwardRef,
    type AnchorHTMLAttributes,
    type MouseEvent,
    type ReactNode,
} from "react";
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
                showOverlay();
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
