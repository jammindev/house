"use client";
import React from 'react';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Settings, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function DashboardContent() {
    const { loading, user, households, selectedHouseholdId, setSelectedHouseholdId } = useGlobal();

    const getDaysSinceRegistration = () => {
        if (!user?.registered_at) return 0;
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - user.registered_at.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

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
                                <Button className="bg-primary-600 text-white hover:bg-primary-700">
                                    Create a Household
                                </Button>
                            </Link>
                            <p className="text-sm text-gray-600">Create your first household to continue.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // If multiple households and none selected, ask to choose one
    if (households.length > 1 && !selectedHouseholdId) {
        return (
            <div className="space-y-6 p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Select a Household</CardTitle>
                        <CardDescription>Choose which household to work with.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-2 gap-3">
                            {households.map(h => (
                                <button
                                    key={h.id}
                                    onClick={() => setSelectedHouseholdId(h.id)}
                                    className="text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="font-medium">{h.name}</div>
                                    <div className="text-xs text-gray-500 mt-1">Click to select</div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const daysSinceRegistration = getDaysSinceRegistration();

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome, {user?.email?.split('@')[0]}! 👋</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Member for {daysSinceRegistration} days
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Frequently used features</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Link
                            href="/app/households"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <Settings className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">Households</h3>
                                <p className="text-sm text-gray-500">Manage your households</p>
                            </div>
                        </Link>
                        <Link
                            href="/app/entries"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <Settings className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">Entries</h3>
                                <p className="text-sm text-gray-500">Manage your entries</p>
                            </div>
                        </Link>
                        <Link
                            href="/app/user-settings"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <Settings className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">User Settings</h3>
                                <p className="text-sm text-gray-500">Manage your account preferences</p>
                            </div>
                        </Link>

                        <Link
                            href="/app/table"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <ExternalLink className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">Example Page</h3>
                                <p className="text-sm text-gray-500">Check out example features</p>
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
