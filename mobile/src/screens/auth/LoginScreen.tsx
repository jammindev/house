// mobile/src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react'
import { View, StyleSheet, Alert, ScrollView, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'

type LoginFormData = {
    email: string
    password: string
}

export function LoginScreen() {
    const [isLoading, setIsLoading] = useState(false)
    const { signIn } = useAuth()

    const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>()

    const handleLogin = async (data: LoginFormData) => {
        try {
            setIsLoading(true)
            const result = await signIn(data.email, data.password)

            if (result.error) {
                Alert.alert('Erreur de connexion', result.error.message)
                return
            }

            // La navigation se fera automatiquement grâce au contexte d'auth
            Alert.alert('Succès', 'Connexion réussie!')
        } catch (error) {
            console.error('Erreur de connexion:', error)
            Alert.alert('Erreur', 'Une erreur est survenue lors de la connexion')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>House</Text>
                    <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>
                </View>

                <Card style={styles.card}>
                    <CardHeader>
                        <CardTitle>Connexion</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Controller
                            control={control}
                            name="email"
                            rules={{
                                required: 'L\'email est requis',
                                pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: 'Email invalide'
                                }
                            }}
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    label="Email"
                                    placeholder="votre@email.com"
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    error={errors.email?.message}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            )}
                        />

                        <Controller
                            control={control}
                            name="password"
                            rules={{
                                required: 'Le mot de passe est requis',
                                minLength: {
                                    value: 6,
                                    message: 'Le mot de passe doit contenir au moins 6 caractères'
                                }
                            }}
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    label="Mot de passe"
                                    placeholder="••••••••"
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    error={errors.password?.message}
                                    secureTextEntry
                                />
                            )}
                        />

                        <Button
                            style={styles.loginButton}
                            onPress={handleSubmit(handleLogin)}
                        // disabled={isLoading}
                        >
                            {isLoading ? 'Connexion...' : 'Se connecter'}
                        </Button>
                    </CardContent>
                </Card>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#09090b',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#71717a',
        textAlign: 'center',
    },
    card: {
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    loginButton: {
        marginTop: 16,
    },
})