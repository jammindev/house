// mobile/App.tsx
import 'react-native-url-polyfill/auto'
import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { AppNavigator } from './src/navigation/AppNavigator'
import { AuthProvider } from './src/contexts/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  )
}
