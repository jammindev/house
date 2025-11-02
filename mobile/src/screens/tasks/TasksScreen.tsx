// mobile/src/screens/tasks/TasksScreen.tsx
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, FlatList, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTodos, TodoItem } from '@house/shared'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'

export function TasksScreen() {
    const { todos, loading, error, addTodo, toggleTodo, deleteTodo } = useTodos()
    const [newTaskTitle, setNewTaskTitle] = useState('')

    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un titre pour la tâche')
            return
        }

        await addTodo(newTaskTitle.trim())
        setNewTaskTitle('')
    }

    const handleToggleTask = async (id: number) => {
        await toggleTodo(id)
    }

    const handleDeleteTask = async (id: number) => {
        Alert.alert(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir supprimer cette tâche ?',
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: () => deleteTodo(id) }
            ]
        )
    }

    const renderTodoItem = ({ item }: { item: TodoItem }) => (
        <Card style={styles.todoItem}>
            <CardContent style={styles.todoContent}>
                <View style={styles.todoHeader}>
                    <Text style={[styles.todoTitle, item.done && styles.todoTitleDone]}>
                        {item.title}
                    </Text>
                    {item.urgent && (
                        <View style={styles.urgentBadge}>
                            <Text style={styles.urgentText}>Urgent</Text>
                        </View>
                    )}
                </View>

                {item.description && (
                    <Text style={styles.todoDescription}>{item.description}</Text>
                )}

                <View style={styles.todoActions}>
                    <Button
                        style={[styles.actionButton, item.done ? styles.undoButton : styles.doneButton]}
                        onPress={() => handleToggleTask(item.id)}
                    >
                        {item.done ? 'Annuler' : 'Terminer'}
                    </Button>
                    <Button
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteTask(item.id)}
                    >
                        Supprimer
                    </Button>
                </View>
            </CardContent>
        </Card>
    )

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Erreur: {error}</Text>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                <View style={styles.header}>
                    <Text style={styles.title}>Tâches</Text>
                    <Text style={styles.subtitle}>Organisez et suivez vos tâches quotidiennes</Text>
                </View>

                <Card style={styles.addCard}>
                    <CardHeader>
                        <CardTitle>Nouvelle tâche</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input
                            placeholder="Titre de la tâche"
                            value={newTaskTitle}
                            onChangeText={setNewTaskTitle}
                        />
                        <Button
                            style={styles.addButton}
                            onPress={handleAddTask}
                        >
                            Ajouter
                        </Button>
                    </CardContent>
                </Card>

                <View style={styles.todosContainer}>
                    {loading ? (
                        <Text style={styles.loadingText}>Chargement...</Text>
                    ) : (
                        <FlatList
                            data={todos}
                            renderItem={renderTodoItem}
                            keyExtractor={(item) => item.id.toString()}
                            scrollEnabled={false}
                        />
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#09090b',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#71717a',
    },
    addCard: {
        margin: 20,
        marginTop: 10,
    },
    addButton: {
        marginTop: 12,
    },
    todosContainer: {
        padding: 20,
        paddingTop: 0,
    },
    loadingText: {
        textAlign: 'center',
        color: '#71717a',
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        textAlign: 'center',
    },
    todoItem: {
        marginBottom: 12,
    },
    todoContent: {
        padding: 16,
    },
    todoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    todoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090b',
        flex: 1,
    },
    todoTitleDone: {
        textDecorationLine: 'line-through',
        color: '#71717a',
    },
    urgentBadge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    urgentText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    todoDescription: {
        fontSize: 14,
        color: '#71717a',
        marginBottom: 12,
    },
    todoActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 8,
        fontSize: 12,
    },
    doneButton: {
        backgroundColor: '#22c55e',
    },
    undoButton: {
        backgroundColor: '#71717a',
    },
    deleteButton: {
        backgroundColor: '#ef4444',
    },
})