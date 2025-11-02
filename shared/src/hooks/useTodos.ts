// shared/src/hooks/useTodos.ts
import { useState, useEffect } from 'react'
import { createNativeSassClient } from '../supabase/client-native'

export interface TodoItem {
    id: number
    title: string
    description?: string | null
    done: boolean
    urgent: boolean
    created_at: string
    done_at?: string | null
    owner: string
}

export function useTodos() {
    const [todos, setTodos] = useState<TodoItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadTodos = async () => {
        try {
            setLoading(true)
            setError(null)

            const client = await createNativeSassClient()
            const result = await client.getMyTodoList(1, 100, 'created_at', null)

            if (result.error) {
                throw new Error(result.error.message)
            }

            setTodos(result.data || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue')
        } finally {
            setLoading(false)
        }
    }

    const addTodo = async (title: string, description?: string, urgent = false) => {
        try {
            const client = await createNativeSassClient()
            const result = await client.createTask({
                title,
                description,
                done: false,
                urgent,
                owner: 'current-user' // TODO: récupérer l'utilisateur actuel
            })

            if (result.error) {
                throw new Error(result.error.message)
            }

            // Recharger la liste
            await loadTodos()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout')
        }
    }

    const toggleTodo = async (id: number) => {
        try {
            const client = await createNativeSassClient()
            const result = await client.updateAsDone(id)

            if (result.error) {
                throw new Error(result.error.message)
            }

            // Mettre à jour localement
            setTodos(prev => prev.map(todo =>
                todo.id === id ? { ...todo, done: true } : todo
            ))
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour')
        }
    }

    const deleteTodo = async (id: number) => {
        try {
            const client = await createNativeSassClient()
            const result = await client.removeTask(id)

            if (result.error) {
                throw new Error(result.error.message)
            }

            // Supprimer localement
            setTodos(prev => prev.filter(todo => todo.id !== id))
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
        }
    }

    useEffect(() => {
        loadTodos()
    }, [])

    return {
        todos,
        loading,
        error,
        addTodo,
        toggleTodo,
        deleteTodo,
        reload: loadTodos
    }
}