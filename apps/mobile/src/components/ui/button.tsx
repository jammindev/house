// mobile/src/components/ui/button.tsx
import React from 'react'
import { Text, TextProps, StyleSheet } from 'react-native'

interface ButtonProps extends TextProps {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'default',
    size = 'default',
    style,
    children,
    ...props
}) => {
    const buttonStyles = [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        style
    ]

    return (
        <Text style={buttonStyles} {...props}>
            {children}
        </Text>
    )
}

const styles = StyleSheet.create({
    base: {
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        textAlign: 'center',
        fontWeight: '500',
        fontSize: 14,
    },
    default: {
        backgroundColor: '#18181b',
        color: '#fafafa',
    },
    destructive: {
        backgroundColor: '#ef4444',
        color: '#fafafa',
    },
    outline: {
        borderWidth: 1,
        borderColor: '#e4e4e7',
        backgroundColor: 'transparent',
        color: '#09090b',
    },
    secondary: {
        backgroundColor: '#f4f4f5',
        color: '#09090b',
    },
    ghost: {
        backgroundColor: 'transparent',
        color: '#09090b',
    },
    link: {
        backgroundColor: 'transparent',
        color: '#18181b',
        textDecorationLine: 'underline',
    },
    size_default: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
    },
    size_sm: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 12,
    },
    size_lg: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        fontSize: 16,
    },
    size_icon: {
        width: 40,
        height: 40,
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
})