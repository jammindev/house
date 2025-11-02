// mobile/src/components/ui/card.tsx
import React from 'react'
import { View, ViewProps, StyleSheet, Text } from 'react-native'

interface CardProps extends ViewProps {
    children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({ children, style, ...props }) => {
    return (
        <View style={[styles.card, style]} {...props}>
            {children}
        </View>
    )
}

export const CardHeader: React.FC<CardProps> = ({ children, style, ...props }) => {
    return (
        <View style={[styles.header, style]} {...props}>
            {children}
        </View>
    )
}

export const CardTitle: React.FC<{ children: React.ReactNode; style?: any }> = ({
    children,
    style
}) => {
    return (
        <Text style={[styles.title, style]}>
            {children}
        </Text>
    )
}

export const CardContent: React.FC<CardProps> = ({ children, style, ...props }) => {
    return (
        <View style={[styles.content, style]} {...props}>
            {children}
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e4e4e7',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        padding: 20,
        paddingBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#09090b',
    },
    content: {
        padding: 20,
        paddingTop: 0,
    },
})