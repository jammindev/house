// mobile/src/screens/MainScreen.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui'

export function MainScreen() {
    const { user, signOut } = useAuth()

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Bienvenue dans House!</Text>
                <Text style={styles.subtitle}>Connecté en tant que: {user?.email}</Text>

                <Button
                    style={styles.button}
                    onPress={signOut}
                >
                    Se déconnecter
                </Button>
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
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#09090b',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#71717a',
        marginBottom: 40,
        textAlign: 'center',
    },
    button: {
        minWidth: 200,
    },
})