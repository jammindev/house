// nextjs/src/app/app/page.tsx
"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useGlobal } from '@/lib/context/GlobalContext';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Settings, NotebookPen, Layers, PlusCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';

type InteractionSummary = {
  id: string;
  subject: string;
  content: string;
  occurred_at: string;
  created_at: string;
  type: string;
};

export default function DashboardContent() {
  const { loading, user, households, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const [interactions, setInteractions] = useState<InteractionSummary[]>([]);
  const [interactionCount, setInteractionCount] = useState<number>(0);
  const [zoneCount, setZoneCount] = useState<number>(0);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const currentHousehold = useMemo(() => households.find(h => h.id === selectedHouseholdId) || null, [households, selectedHouseholdId]);

  const getDaysSinceRegistration = () => {
    if (!user?.registered_at) return 0;
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - user.registered_at.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  useEffect(() => {
    const load = async () => {
      if (!selectedHouseholdId) return;
      setLoadingData(true);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();

        // Recent interactions
        const { data: interactionData, count: interactionTotal, error: interactionError } = await client
          .from('interactions')
          .select('id, subject, content, occurred_at, created_at, type', { count: 'exact' })
          .eq('household_id', selectedHouseholdId)
          .order('occurred_at' as any, { ascending: false })
          .limit(3);
        if (interactionError) throw interactionError;
        setInteractions((interactionData ?? []) as unknown as InteractionSummary[]);
        setInteractionCount(interactionTotal || 0);

        // Zones count
        const { count: zCount, error: zErr } = await client
          .from('zones' as any)
          .select('id', { count: 'exact', head: true })
          .eq('household_id', selectedHouseholdId);
        if (zErr) throw zErr;
        setZoneCount(zCount || 0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [selectedHouseholdId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If user has no household, prompt to create one
  if (!households || households.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user?.email?.split('@')[0]}!</CardTitle>
            <CardDescription>You don't belong to a household yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Link href="/app/households/new">
                <Button className="bg-primary-600 text-white hover:bg-primary-700">Create a Household</Button>
              </Link>
              <p className="text-sm text-gray-600">Create your first household to continue.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const daysSinceRegistration = getDaysSinceRegistration();

  return (
    <div className="space-y-6 md:p-6">
      {/* Stats + Quick actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.interactions')}</CardTitle>
            <CardDescription>{t('dashboard.totalInHousehold')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{loadingData ? '—' : interactionCount}</div>
            <div className="mt-3 flex items-center gap-2">
              <Link href="/app/interactions"><Button variant="secondary" size="sm">{t('dashboard.view')}</Button></Link>
              <Link href="/app/interactions/new"><Button size="sm"><PlusCircle className="w-4 h-4 mr-1" /> {t('dashboard.new')}</Button></Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.zones')}</CardTitle>
            <CardDescription>{t('dashboard.roomsAndAreas')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{loadingData ? '—' : zoneCount}</div>
            <div className="mt-3 flex items-center gap-2">
              <Link href="/app/zones"><Button variant="secondary" size="sm">{t('dashboard.manage')}</Button></Link>
              <Link href="/app/zones"><Button size="sm"><Layers className="w-4 h-4 mr-1" /> {t('dashboard.add')}</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent entries */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentInteractions')} {currentHousehold ? `· ${currentHousehold.name}` : ''}</CardTitle>
          <CardDescription>{t('dashboard.latestThree')}</CardDescription>
        </CardHeader>
        <CardContent>
          {(!selectedHouseholdId) ? (
            <div className="text-sm text-gray-600">{t('dashboard.selectHousehold')}</div>
          ) : loadingData ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : interactions.length === 0 ? (
            <div className="text-sm text-gray-600">{t('dashboard.noEntries')} <Link className="underline" href="/app/interactions/new">{t('dashboard.createOne')}</Link>.</div>
          ) : (
            <ul className="space-y-2">
              {interactions.map(interaction => (
                <li key={interaction.id} className="border rounded-md p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">{new Date(interaction.occurred_at || interaction.created_at).toLocaleString()}</div>
                    <Link className="text-xs text-primary-700 underline" href={`/app/interactions/${interaction.id}`}>{t('common.open')}</Link>
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900 line-clamp-1">{interaction.subject}</div>
                  <div className="mt-1 text-sm text-gray-700 line-clamp-2 whitespace-pre-wrap">{interaction.content}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
