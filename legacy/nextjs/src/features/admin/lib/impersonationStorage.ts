"use client";

const ORIGIN_KEY = "house:impersonation:origin";
const TARGET_KEY = "house:impersonation:target";
export const IMPERSONATION_EVENT = "house-impersonation-changed";

export type StoredImpersonationOrigin = {
    access_token: string;
    refresh_token: string;
    email?: string | null;
    user_id?: string | null;
};

export type StoredImpersonationTarget = {
    id: string;
    email: string | null;
    display_name?: string | null;
};

const notify = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(IMPERSONATION_EVENT));
};

export function readImpersonationOrigin(): StoredImpersonationOrigin | null {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(ORIGIN_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredImpersonationOrigin;
    } catch {
        sessionStorage.removeItem(ORIGIN_KEY);
        return null;
    }
}

export function readImpersonationTarget(): StoredImpersonationTarget | null {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(TARGET_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredImpersonationTarget;
    } catch {
        sessionStorage.removeItem(TARGET_KEY);
        return null;
    }
}

export function saveImpersonationOrigin(origin: StoredImpersonationOrigin) {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(origin));
    notify();
}

export function saveImpersonationTarget(target: StoredImpersonationTarget) {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(TARGET_KEY, JSON.stringify(target));
    notify();
}

export function clearImpersonationState() {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(ORIGIN_KEY);
    sessionStorage.removeItem(TARGET_KEY);
    notify();
}

