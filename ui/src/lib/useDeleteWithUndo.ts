import * as React from 'react'
import { useToast } from '@/lib/toast'

interface DeleteWithUndoOptions {
  /** Label du toast — ex : "Tâche supprimée" */
  label: string
  /** Appel API effectif. Appelé seulement si l'utilisateur n'annule pas. */
  onDelete: (id: string) => Promise<void>
  /** Durée du toast en ms (défaut : 5000). La suppression est différée de cette durée. */
  duration?: number
}

interface TriggerOptions {
  /** Retire l'item de l'état immédiatement (optimiste). */
  onRemove: () => void
  /** Restaure l'item si l'utilisateur annule ou si l'API échoue. */
  onRestore: () => void
}

/**
 * Hook générique "supprimer avec annulation".
 *
 * Workflow :
 * 1. `deleteWithUndo(id, { onRemove, onRestore })` retire l'item de l'UI immédiatement.
 * 2. Un toast apparaît avec un bouton "Annuler" pendant `duration` ms.
 * 3a. Si l'utilisateur clique "Annuler" → `onRestore()` est appelé, l'API n'est pas touchée.
 * 3b. Sinon → `onDelete(id)` est appelé. En cas d'erreur, `onRestore()` est appelé.
 *
 * Usage :
 * ```ts
 * const { deleteWithUndo } = useDeleteWithUndo({
 *   label: 'Tâche supprimée',
 *   onDelete: (id) => deleteTask(id, householdId),
 * })
 *
 * deleteWithUndo(task.id, {
 *   onRemove: () => setTasks((prev) => prev.filter((t) => t.id !== task.id)),
 *   onRestore: () => setTasks((prev) => [...prev, task]),
 * })
 * ```
 */
export function useDeleteWithUndo({ label, onDelete, duration = 5000 }: DeleteWithUndoOptions) {
  const { toast, dismiss } = useToast()
  const pendingRef = React.useRef<Map<string, { timer: ReturnType<typeof setTimeout>; toastId: string; restore: () => void }>>(new Map())

  const deleteWithUndo = React.useCallback(
    (id: string, { onRemove, onRestore }: TriggerOptions) => {
      // Suppression optimiste immédiate
      onRemove()

      const timer = setTimeout(() => {
        pendingRef.current.delete(id)
        onDelete(id).catch(() => onRestore())
      }, duration)

      const toastId = Math.random().toString(36).slice(2)

      const cancel = () => {
        const entry = pendingRef.current.get(id)
        if (!entry) return
        clearTimeout(entry.timer)
        pendingRef.current.delete(id)
        dismiss(entry.toastId)
        onRestore()
      }

      pendingRef.current.set(id, { timer, toastId, restore: onRestore })

      toast({
        title: label,
        duration,
        action: { label: 'Annuler', onClick: cancel },
      })
    },
    [label, onDelete, duration, toast, dismiss],
  )

  return { deleteWithUndo }
}
