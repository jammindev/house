import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

type ToastVariant = 'default' | 'destructive' | 'success'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
  action?: ToastAction
}

interface ToastStore {
  toasts: ToastItem[]
  toast: (options: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  toast: (options) => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { id, ...options }] }))
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))

/** Hook React — à utiliser dans les composants */
export function useToast() {
  return useToastStore(useShallow((s) => ({ toast: s.toast, dismiss: s.dismiss, toasts: s.toasts })))
}

/** Appelable hors composant (ex: dans un catch utilitaire) */
export const toast = (options: Omit<ToastItem, 'id'>) =>
  useToastStore.getState().toast(options)
