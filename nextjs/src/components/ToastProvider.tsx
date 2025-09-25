"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";
type Toast = { id: string; title: string; description?: string; variant?: ToastVariant; duration?: number };

type ToastContextType = {
  show: (t: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, any>>({});

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, duration: 3000, variant: "info", ...t };
    setToasts((prev) => [...prev, toast]);
    timers.current[id] = setTimeout(() => remove(id), toast.duration);
  }, [remove]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 w-[90vw] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "relative rounded-md border px-4 py-3 pr-8 shadow-sm text-sm bg-white",
              t.variant === "success" && "border-green-200",
              t.variant === "error" && "border-red-200",
              t.variant === "info" && "border-blue-200",
              t.variant === "warning" && "border-yellow-200",
            ].filter(Boolean).join(" ")}
          >
            <div className="font-medium mb-0.5">
              {t.title}
            </div>
            {t.description && (
              <div className="text-gray-600">{t.description}</div>
            )}
            <button
              onClick={() => remove(t.id)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
