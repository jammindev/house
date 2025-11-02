// mobile/src/screens/dashboard/DashboardScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui'

export function DashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Vue d'ensemble de votre maison</Text>
        </View>

        <View style={styles.content}>
          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Interactions récentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Text style={styles.cardText}>
                Aucune interaction récente
              </Text>
            </CardContent>
          </Card>

          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Zones</CardTitle>
            </CardHeader>
            <CardContent>
              <Text style={styles.cardText}>
                Gérez vos zones de la maison
              </Text>
            </CardContent>
          </Card>

          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Projets</CardTitle>
            </CardHeader>
            <CardContent>
              <Text style={styles.cardText}>
                Suivez vos projets en cours
              </Text>
            </CardContent>
          </Card>

          <Card style={styles.card}>
            <CardHeader>
              <CardTitle>Tâches</CardTitle>
            </CardHeader>
            <CardContent>
              <Text style={styles.cardText}>
                Organisez vos tâches
              </Text>
            </CardContent>
          </Card>
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
  content: {
    padding: 20,
    paddingTop: 10,
  },
  card: {
    marginBottom: 16,
  },
  cardText: {
    fontSize: 14,
    color: '#71717a',
  },
})