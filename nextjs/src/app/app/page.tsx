"use client";

import { redirect } from "next/navigation";
import { useGlobal } from "@/lib/context/GlobalContext";
import { NoHouseholdState, NoSelectedHouseholdState } from "@households/components";
import { Loader2 } from "lucide-react";

export default function AppIndex() {
  const { loading, households, selectedHouseholdId } = useGlobal();

  if (loading) {
    return <div className="absolute inset-0 w-full lg:pl-64 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  // Cas 1: Pas de households du tout
  if (!households || households.length === 0) {
    return <NoHouseholdState />;
  }

  // Cas 2: Des households existent mais aucun n'est sélectionné
  if (!selectedHouseholdId) {
    return <NoSelectedHouseholdState />;
  }

  // Cas 3: Un household est sélectionné, rediriger vers le dashboard
  redirect("/app/dashboard");
}
