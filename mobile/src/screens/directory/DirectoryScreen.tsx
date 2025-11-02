// mobile/src/screens/directory/DirectoryScreen.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    Linking,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';

import { useContacts } from '../../hooks/useContacts';
import { useStructures } from '../../hooks/useStructures';
import { screenStyles } from '../../styles/screen';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { Contact, formatFullName } from '@house/shared';
import type { Structure } from '../../types/structure';

type DirectoryView = 'contacts' | 'structures';

// Types pour la navigation
type DirectoryNavigation = NavigationProp<any>;

export default function DirectoryScreen() {
    const navigation = useNavigation<DirectoryNavigation>();
    const [currentView, setCurrentView] = useState<DirectoryView>('contacts');

    const { contacts, loading: contactsLoading, error: contactsError } = useContacts();
    const { structures, loading: structuresLoading, error: structuresError } = useStructures();

    const handleViewChange = useCallback((view: DirectoryView) => {
        setCurrentView(view);
    }, []);

    const handleContactSelect = useCallback((contact: Contact) => {
        // navigation.navigate('ContactDetail', { contactId: contact.id });
        Alert.alert('Contact sélectionné', `Détails de ${formatFullName(contact)}`);
    }, []);

    const handleStructureSelect = useCallback((structure: Structure) => {
        // navigation.navigate('StructureDetail', { structureId: structure.id });
        Alert.alert('Structure sélectionnée', `Détails de ${structure.name}`);
    }, []);

    const handleEmailPress = useCallback((email: string) => {
        Linking.openURL(`mailto:${email}`);
    }, []);

    const handlePhonePress = useCallback((phone: string) => {
        Linking.openURL(`tel:${phone}`);
    }, []);

    const handleAddPress = useCallback(() => {
        const message = currentView === 'contacts'
            ? 'Ajout d\'un nouveau contact'
            : 'Ajout d\'une nouvelle structure';
        Alert.alert('Ajouter', message);
    }, [currentView]);

    const renderContactItem = useCallback(({ item: contact }: { item: Contact }) => {
        const fullName = formatFullName(contact) || 'Contact sans nom';
        const primaryEmail = contact.emails.find((e: any) => e.is_primary) || contact.emails[0];
        const primaryPhone = contact.phones.find((p: any) => p.is_primary) || contact.phones[0];

        return (
            <TouchableOpacity
                style={styles.listItem}
                onPress={() => handleContactSelect(contact)}
                activeOpacity={0.7}
            >
                <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{fullName}</Text>
                        <View style={styles.itemActions}>
                            {primaryEmail && (
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleEmailPress(primaryEmail.email)}
                                >
                                    <Text style={styles.actionIcon}>✉️</Text>
                                </TouchableOpacity>
                            )}
                            {primaryPhone && (
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handlePhonePress(primaryPhone.phone)}
                                >
                                    <Text style={styles.actionIcon}>📞</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleContactSelect(contact)}
                            >
                                <Text style={styles.actionIcon}>▶️</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {(contact.position || contact.structure) && (
                        <View style={styles.metadata}>
                            {contact.position && (
                                <Text style={styles.metadataText}>{contact.position}</Text>
                            )}
                            {contact.structure && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{contact.structure.name}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    }, [handleContactSelect, handleEmailPress, handlePhonePress]);

    const renderStructureItem = useCallback(({ item: structure }: { item: Structure }) => {
        const name = structure.name || 'Structure sans nom';
        const primaryEmail = structure.emails.find((e: any) => e.is_primary) || structure.emails[0];
        const primaryPhone = structure.phones.find((p: any) => p.is_primary) || structure.phones[0];

        return (
            <TouchableOpacity
                style={styles.listItem}
                onPress={() => handleStructureSelect(structure)}
                activeOpacity={0.7}
            >
                <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{name}</Text>
                        <View style={styles.itemActions}>
                            {primaryEmail && (
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handleEmailPress(primaryEmail.email)}
                                >
                                    <Text style={styles.actionIcon}>✉️</Text>
                                </TouchableOpacity>
                            )}
                            {primaryPhone && (
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handlePhonePress(primaryPhone.phone)}
                                >
                                    <Text style={styles.actionIcon}>📞</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleStructureSelect(structure)}
                            >
                                <Text style={styles.actionIcon}>▶️</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {(structure.type || structure.website || structure.tags?.length) && (
                        <View style={styles.metadata}>
                            {structure.type && (
                                <Text style={styles.metadataText}>{structure.type}</Text>
                            )}
                            {structure.website && (
                                <Text style={styles.metadataText}>{structure.website}</Text>
                            )}
                            {structure.tags?.map((tag: any, index: any) => (
                                <View key={index} style={styles.badge}>
                                    <Text style={styles.badgeText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    }, [handleStructureSelect, handleEmailPress, handlePhonePress]);

    const renderEmptyState = useCallback(() => {
        const isContacts = currentView === 'contacts';
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>
                    {isContacts ? '👤' : '🏢'}
                </Text>
                <Text style={styles.emptyTitle}>
                    {isContacts ? 'Aucun contact' : 'Aucune structure'}
                </Text>
                <Text style={styles.emptyDescription}>
                    {isContacts
                        ? 'Commencez par ajouter votre premier contact'
                        : 'Commencez par ajouter votre première structure'
                    }
                </Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddPress}
                >
                    <Text style={styles.addButtonText}>
                        {isContacts ? 'Ajouter un contact' : 'Ajouter une structure'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }, [currentView, handleAddPress]);

    const renderContent = useMemo(() => {
        if (currentView === 'contacts') {
            if (contactsLoading) {
                return (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                );
            }

            if (contactsError) {
                return (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>Erreur lors du chargement des contacts</Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => {/* reload function */ }}
                        >
                            <Text style={styles.retryButtonText}>Réessayer</Text>
                        </TouchableOpacity>
                    </View>
                );
            }

            if (contacts.length === 0) {
                return renderEmptyState();
            }

            return (
                <FlatList
                    data={contacts}
                    renderItem={renderContactItem}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            );
        }

        // Structures view
        if (structuresLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            );
        }

        if (structuresError) {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Erreur lors du chargement des structures</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {/* reload function */ }}
                    >
                        <Text style={styles.retryButtonText}>Réessayer</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (structures.length === 0) {
            return renderEmptyState();
        }

        return (
            <FlatList
                data={structures}
                renderItem={renderStructureItem}
                keyExtractor={(item) => item.id}
                style={styles.list}
                showsVerticalScrollIndicator={false}
            />
        );
    }, [
        currentView,
        contactsLoading,
        contactsError,
        contacts,
        structuresLoading,
        structuresError,
        structures,
        renderContactItem,
        renderStructureItem,
        renderEmptyState,
    ]);

    return (
        <SafeAreaView style={screenStyles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Répertoire</Text>
                <Text style={styles.subtitle}>
                    Gérez contacts et structures du foyer au même endroit.
                </Text>
            </View>

            {/* Toggle Buttons */}
            <View style={styles.toggleContainer}>
                <View style={styles.toggleButtons}>
                    <TouchableOpacity
                        style={[
                            styles.toggleButton,
                            currentView === 'contacts' && styles.toggleButtonActive,
                        ]}
                        onPress={() => handleViewChange('contacts')}
                    >
                        <Text
                            style={[
                                styles.toggleButtonText,
                                currentView === 'contacts' && styles.toggleButtonTextActive,
                            ]}
                        >
                            Contacts
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.toggleButton,
                            currentView === 'structures' && styles.toggleButtonActive,
                        ]}
                        onPress={() => handleViewChange('structures')}
                    >
                        <Text
                            style={[
                                styles.toggleButtonText,
                                currentView === 'structures' && styles.toggleButtonTextActive,
                            ]}
                        >
                            Structures
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {renderContent}
            </View>

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={handleAddPress}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    title: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: colors.gray[900],
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 14,
        color: colors.gray[600],
    },
    toggleContainer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        alignItems: 'flex-end' as const,
    },
    toggleButtons: {
        flexDirection: 'row' as const,
        backgroundColor: colors.gray[100],
        borderRadius: 8,
        padding: 4,
    },
    toggleButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 6,
    },
    toggleButtonActive: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleButtonText: {
        fontSize: 14,
        fontWeight: '500' as const,
        color: colors.gray[600],
    },
    toggleButtonTextActive: {
        color: colors.gray[900],
    },
    content: {
        flex: 1,
    },
    list: {
        flex: 1,
    },
    listItem: {
        backgroundColor: 'white',
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    itemContent: {
        padding: spacing.md,
    },
    itemHeader: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: colors.gray[900],
        flex: 1,
    },
    itemActions: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: spacing.xs,
    },
    actionButton: {
        padding: spacing.xs,
    },
    actionIcon: {
        fontSize: 16,
    },
    metadata: {
        flexDirection: 'row' as const,
        flexWrap: 'wrap' as const,
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    metadataText: {
        fontSize: 12,
        color: colors.gray[600],
        fontWeight: '500' as const,
    },
    badge: {
        backgroundColor: colors.gray[100],
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        fontSize: 12,
        color: colors.gray[700],
        fontWeight: '500' as const,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: colors.gray[900],
        marginBottom: spacing.sm,
    },
    emptyDescription: {
        fontSize: 14,
        color: colors.gray[600],
        textAlign: 'center' as const,
        marginBottom: spacing.lg,
    },
    addButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: 8,
    },
    addButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600' as const,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        paddingHorizontal: spacing.xl,
    },
    errorText: {
        fontSize: 16,
        color: colors.gray[900],
        textAlign: 'center' as const,
        marginBottom: spacing.md,
    },
    retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: 8,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600' as const,
    },
    fab: {
        position: 'absolute' as const,
        bottom: spacing.xl,
        right: spacing.xl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
    fabIcon: {
        fontSize: 24,
        color: 'white',
        fontWeight: 'bold' as const,
    },
});