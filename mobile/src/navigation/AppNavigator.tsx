// mobile/src/navigation/AppNavigator.tsx
import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { View, Text, ActivityIndicator } from 'react-native'

// Import des écrans
import { LoginScreen } from '../screens/auth/LoginScreen'
import { MainScreen } from '../screens/MainScreen'
import { useAuth } from '../contexts/AuthContext'

export type RootStackParamList = {
    Auth: undefined
    Main: undefined
}

export type AuthStackParamList = {
    Login: undefined
}

const RootStack = createStackNavigator<RootStackParamList>()
const AuthStack = createStackNavigator<AuthStackParamList>()

function AuthNavigator() {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
    )
}

export function AppNavigator() {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 16 }}>Chargement...</Text>
            </View>
        )
    }

    return (
        <NavigationContainer>
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    <RootStack.Screen name="Main" component={MainScreen} />
                ) : (
                    <RootStack.Screen name="Auth" component={AuthNavigator} />
                )}
            </RootStack.Navigator>
        </NavigationContainer>
    )
}