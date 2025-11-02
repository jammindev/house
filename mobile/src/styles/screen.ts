// mobile/src/styles/screen.ts
import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const screenStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.gray[50],
    },
    content: {
        flex: 1,
        padding: 16,
    },
    header: {
        paddingBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.gray[900],
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: colors.gray[600],
    },
});