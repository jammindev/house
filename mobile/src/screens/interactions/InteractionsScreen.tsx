// mobile/src/screens/interactions/InteractionsScreen.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function InteractionsScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Interactions</Text>
                <Text style={styles.subtitle}>Gérez vos interactions quotidiennes</Text>
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