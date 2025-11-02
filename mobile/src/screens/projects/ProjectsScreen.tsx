// mobile/src/screens/projects/ProjectsScreen.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function ProjectsScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Projets</Text>
                <Text style={styles.subtitle}>Suivez vos projets de rénovation et d'amélioration</Text>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        padding: 20,
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
})