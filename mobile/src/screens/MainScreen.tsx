// mobile/src/screens/MainScreen.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui'
import { useNavigation, NavigationProp } from '@react-navigation/native'
import type { RootStackParamList } from '../navigation/AppNavigator'

export function MainScreen() {
    const { user, signOut } = useAuth()
    const navigation = useNavigation<NavigationProp<RootStackParamList>>()

    const handleNavigateToDirectory = () => {
        navigation.navigate('Directory')
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Bienvenue dans House! 🏠</Text>
                <Text style={styles.subtitle}>Connecté en tant que: {user?.email}</Text>

                <View style={styles.buttonContainer}>
                    <Button
                        style={styles.button}
                        onPress={handleNavigateToDirectory}
                    >
                        📱 Répertoire (DONNÉES RÉELLES!)
                    </Button>

                    <Button
                        style={styles.button}
                        onPress={signOut}
                    >
                        Se déconnecter
                    </Button>
                </View>
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
    buttonContainer: {
        gap: 16,
        width: '100%',
        alignItems: 'center',
    },
    button: {
        minWidth: 200,
    },
})