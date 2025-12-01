'use client';

import { useState, useEffect } from 'react';
import { useGlobal } from '@/lib/context/GlobalContext';
import type { BridgeAccount, BridgeTransaction } from '@/lib/bridge';

export interface BridgeUserData {
  appUserId: string;
  email: string;
  bridgeUserUuid: string;
  accessToken?: string;
  connectedAt: string;
}

export function useBanking() {
  const { user, selectedHouseholdId } = useGlobal();
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [bridgeUser, setBridgeUser] = useState<BridgeUserData | null>(null);
  const [accounts, setAccounts] = useState<BridgeAccount[]>([]);
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [error, setError] = useState<string>('');

  // Clés localStorage
  const getBridgeStorageKey = (userId: string, householdId: string) => 
    `bridge_user_${userId}_${householdId}`;
  const getAccountsStorageKey = (userId: string, householdId: string) => 
    `bridge_accounts_${userId}_${householdId}`;
  const getTransactionsStorageKey = (userId: string, householdId: string) => 
    `bridge_transactions_${userId}_${householdId}`;

  // Charger les données sauvegardées
  useEffect(() => {
    if (user?.id && selectedHouseholdId) {
      loadStoredBankingData();
    }
  }, [user?.id, selectedHouseholdId]);

  const loadStoredBankingData = () => {
    if (!user?.id || !selectedHouseholdId) return;

    try {
      // Charger les données utilisateur Bridge
      const bridgeData = localStorage.getItem(getBridgeStorageKey(user.id, selectedHouseholdId));
      if (bridgeData) {
        setBridgeUser(JSON.parse(bridgeData));
      }

      // Charger les comptes
      const accountsData = localStorage.getItem(getAccountsStorageKey(user.id, selectedHouseholdId));
      if (accountsData) {
        setAccounts(JSON.parse(accountsData));
      }

      // Charger les transactions
      const transactionsData = localStorage.getItem(getTransactionsStorageKey(user.id, selectedHouseholdId));
      if (transactionsData) {
        setTransactions(JSON.parse(transactionsData));
      }
    } catch (error) {
      console.error('Error loading banking data from localStorage:', error);
    }
  };

  const saveBridgeUser = (data: BridgeUserData) => {
    if (!user?.id || !selectedHouseholdId) return;
    localStorage.setItem(getBridgeStorageKey(user.id, selectedHouseholdId), JSON.stringify(data));
    setBridgeUser(data);
  };

  const saveAccounts = (accountsData: BridgeAccount[]) => {
    if (!user?.id || !selectedHouseholdId) return;
    localStorage.setItem(getAccountsStorageKey(user.id, selectedHouseholdId), JSON.stringify(accountsData));
    setAccounts(accountsData);
  };

  const saveTransactions = (transactionsData: BridgeTransaction[]) => {
    if (!user?.id || !selectedHouseholdId) return;
    localStorage.setItem(getTransactionsStorageKey(user.id, selectedHouseholdId), JSON.stringify(transactionsData));
    setTransactions(transactionsData);
  };

  // Connecter à Bridge
  const connectToBank = async (email: string) => {
    if (!user?.id) {
      throw new Error('Utilisateur non authentifié');
    }

    setConnecting(true);
    setError('');

    try {
      const res = await fetch('/api/bridge/create-connect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appUserId: user.id,
          email,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Échec de la connexion');
      }

      const data = await res.json();

      // Sauvegarder les données utilisateur Bridge
      const bridgeUserData: BridgeUserData = {
        appUserId: user.id,
        email,
        bridgeUserUuid: data.bridgeUserUuid,
        connectedAt: new Date().toISOString(),
      };

      saveBridgeUser(bridgeUserData);

      // Rediriger vers Bridge Connect
      window.location.href = data.redirectUrl;
    } catch (error: any) {
      console.error('Banking connection error:', error);
      setError(error.message || 'Impossible de démarrer la connexion bancaire');
      throw error;
    } finally {
      setConnecting(false);
    }
  };

  // Synchroniser les données bancaires
  const syncBankingData = async () => {
    if (!bridgeUser?.bridgeUserUuid) {
      throw new Error('Aucune connexion Bridge trouvée');
    }

    setLoading(true);
    setError('');

    try {
      // 1. Obtenir un access token frais
      const tokenRes = await fetch('/api/bridge/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridgeUserUuid: bridgeUser.bridgeUserUuid }),
      });

      if (!tokenRes.ok) {
        throw new Error('Impossible de récupérer le token d\'accès');
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.accessToken;

      // Sauvegarder le token dans les données utilisateur
      const updatedBridgeUser = { ...bridgeUser, accessToken };
      saveBridgeUser(updatedBridgeUser);

      // 2. Récupérer les comptes
      const accountsRes = await fetch('/api/bridge/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      if (!accountsRes.ok) {
        throw new Error('Impossible de récupérer les comptes');
      }

      const accountsData = await accountsRes.json();
      saveAccounts(accountsData.accounts || []);

      // 3. Récupérer les transactions (30 derniers jours)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const transactionsRes = await fetch('/api/bridge/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          since: thirtyDaysAgo.toISOString().split('T')[0],
          limit: 100,
        }),
      });

      if (!transactionsRes.ok) {
        throw new Error('Impossible de récupérer les transactions');
      }

      const transactionsData = await transactionsRes.json();
      saveTransactions(transactionsData.transactions || []);

      console.log('Banking data synchronized:', {
        accounts: accountsData.accounts?.length || 0,
        transactions: transactionsData.transactions?.length || 0,
      });
    } catch (error: any) {
      console.error('Failed to sync banking data:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Détecter le retour de Bridge Connect et synchroniser automatiquement
  useEffect(() => {
    const handleFocus = async () => {
      if (bridgeUser?.bridgeUserUuid && !loading) {
        console.log('Page focused - checking for new banking data');
        try {
          await syncBankingData();
        } catch (error) {
          console.log('Auto-sync failed (normal if no new data):', error);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [bridgeUser, loading]);

  // Déconnecter Bridge
  const disconnectBank = () => {
    if (!user?.id || !selectedHouseholdId) return;

    localStorage.removeItem(getBridgeStorageKey(user.id, selectedHouseholdId));
    localStorage.removeItem(getAccountsStorageKey(user.id, selectedHouseholdId));
    localStorage.removeItem(getTransactionsStorageKey(user.id, selectedHouseholdId));

    setBridgeUser(null);
    setAccounts([]);
    setTransactions([]);
    setError('');
  };

  // Nettoyer les anciennes connexions Bridge
  const cleanupOldConnections = async () => {
    if (!bridgeUser?.bridgeUserUuid) {
      setError('Aucune connexion Bridge trouvée');
      return;
    }

    try {
      setLoading(true);
      
      // Récupérer la liste des items Bridge
      const itemsRes = await fetch('/api/bridge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bridgeUserUuid: bridgeUser.bridgeUserUuid,
          action: 'list'
        }),
      });
      
      if (!itemsRes.ok) throw new Error('Impossible de récupérer les items');
      
      const itemsData = await itemsRes.json();
      const items = itemsData.items || [];
      
      if (items.length <= 1) {
        console.log('Aucun item à nettoyer');
        return;
      }
      
      // Trier par date de mise à jour et garder seulement le plus récent
      const sortedItems = items.sort((a: any, b: any) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      const itemsToDelete = sortedItems.slice(1).map((item: any) => item.id);
      
      if (itemsToDelete.length === 0) {
        console.log('Aucun item obsolète trouvé');
        return;
      }
      
      // Supprimer les anciens items
      const deleteRes = await fetch('/api/bridge/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          itemIds: itemsToDelete,
          bridgeUserUuid: bridgeUser.bridgeUserUuid
        }),
      });
      
      if (!deleteRes.ok) throw new Error('Échec de la suppression des anciens items');
      
      console.log(`${itemsToDelete.length} anciens items supprimés`);
      
      // Re-synchroniser les données après nettoyage
      await syncBankingData();
      
    } catch (error: any) {
      console.error('Échec du nettoyage:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Vérifier si connecté
  const isConnected = !!bridgeUser?.bridgeUserUuid;

  // Calculer les statistiques
  const accountsByCurrency = accounts?.reduce((acc, account) => {
    const currency = account.currency_code || 'EUR';
    if (!acc[currency]) acc[currency] = [];
    acc[currency].push(account);
    return acc;
  }, {} as Record<string, BridgeAccount[]>) || {};

  const balancesByCurrency = Object.entries(accountsByCurrency).reduce((acc, [currency, currencyAccounts]) => {
    acc[currency] = currencyAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  const totalTransactions = transactions?.length || 0;
  const recentTransactions = transactions
    ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    ?.slice(0, 10) || [];

  return {
    // État
    loading,
    connecting,
    error,
    isConnected,
    bridgeUser,
    accounts,
    transactions,
    recentTransactions,
    
    // Statistiques
    balancesByCurrency,
    totalTransactions,
    
    // Actions
    connectToBank,
    syncBankingData,
    disconnectBank,
    cleanupOldConnections,
    setError,
  };
}