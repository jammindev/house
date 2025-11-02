// mobile/src/components/ui/input.tsx
import React from 'react'
import { TextInput, TextInputProps, StyleSheet, View, Text } from 'react-native'

interface InputProps extends TextInputProps {
    label?: string
    error?: string
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    style,
    ...props
}) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[styles.input, error && styles.inputError, style]}
                placeholderTextColor="#71717a"
                {...props}
            />
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090b',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e4e4e7',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#09090b',
        backgroundColor: '#ffffff',
    },
    inputError: {
        borderColor: '#ef4444',
    },
    error: {
        fontSize: 12,
        color: '#ef4444',
        marginTop: 4,
    },
})