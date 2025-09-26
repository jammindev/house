"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useGlobal } from '@/lib/context/GlobalContext';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Settings, NotebookPen, Layers, PlusCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';

type Entry = { id: string; raw_text: string; created_at: string };

export default function DashboardContent() {
  const { loading, user, households, selectedHouseholdId, setSelectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryCount, setEntryCount] = useState<number>(0);
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

        // Recent entries
        const { data: eData, count: eCount, error: eErr } = await client
          .from('entries' as any)
          .select('id, raw_text, created_at', { count: 'exact' })
          .eq('household_id', selectedHouseholdId)
          .order('created_at' as any, { ascending: false })
          .limit(3);
        if (eErr) throw eErr;
        setEntries((eData || []) as any);
        setEntryCount(eCount || 0);

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
    <div className="space-y-6 p-6">
      {/* Header with household switcher */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>{t('dashboard.welcome', { name: user?.email?.split('@')[0] || '' })} 👋</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <CalendarDays className="h-4 w-4" /> {t('dashboard.memberFor', { days: String(daysSinceRegistration) })}
              </CardDescription>
            </div>
            {households.length > 1 ? (
              <div className="flex items-center gap-2">
                <label htmlFor="hh" className="text-sm text-gray-600">Household</label>
                <select
                  id="hh"
                  value={selectedHouseholdId || ''}
                  onChange={(e) => setSelectedHouseholdId(e.target.value)}
                  className="h-9 px-3 border rounded-md text-sm"
                >
                  {households.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <CardDescription className="mt-1">Household: {currentHousehold?.name}</CardDescription>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Stats + Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.entries')}</CardTitle>
            <CardDescription>{t('dashboard.totalInHousehold')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{loadingData ? '—' : entryCount}</div>
            <div className="mt-3 flex items-center gap-2">
              <Link href="/app/entries"><Button variant="secondary" size="sm">{t('dashboard.view')}</Button></Link>
              <Link href="/app/entries/new"><Button size="sm"><PlusCircle className="w-4 h-4 mr-1" /> {t('dashboard.new')}</Button></Link>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.accountHouseholds')}</CardTitle>
            <CardDescription>Settings and membership</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Link href="/app/user-settings"><Button variant="secondary" size="sm" className="w-full"><Settings className="w-4 h-4 mr-1" /> {t('dashboard.settings')}</Button></Link>
              <Link href="/app/households"><Button size="sm" className="w-full">Households</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent entries */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentEntries')} {currentHousehold ? `· ${currentHousehold.name}` : ''}</CardTitle>
          <CardDescription>{t('dashboard.latestThree')}</CardDescription>
        </CardHeader>
        <CardContent>
          {(!selectedHouseholdId) ? (
            <div className="text-sm text-gray-600">Select a household to see entries.</div>
          ) : loadingData ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-gray-600">{t('dashboard.noEntries')} <Link className="underline" href="/app/entries/new">{t('dashboard.createOne')}</Link>.</div>
          ) : (
            <ul className="space-y-2">
              {entries.map(e => (
                <li key={e.id} className="border rounded-md p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">{new Date(e.created_at).toLocaleString()}</div>
                    <Link className="text-xs text-primary-700 underline" href={`/app/entries/${e.id}`}>Open</Link>
                  </div>
                  <div className="mt-1 text-sm text-gray-900 line-clamp-3 whitespace-pre-wrap">{e.raw_text}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
