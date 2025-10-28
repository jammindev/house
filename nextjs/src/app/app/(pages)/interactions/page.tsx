// nextjs/src/app/app/(pages)/interactions/page.tsx

// "use client";
// import React, { useEffect } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// import { useToast } from "@/components/ToastProvider";

// import { useI18n } from "@/lib/i18n/I18nProvider";
// import InteractionList from "@interactions/components/InteractionList";
// import { useInteractions } from "@interactions/hooks/useInteractions";

// import { Plus } from "lucide-react";
// import AppPageLayout from "@/components/layout/AppPageLayout";

// export default function InteractionsPage() {
//   const { t } = useI18n();
//   const { show } = useToast();
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   const { interactions, documentCounts, loading, error } = useInteractions();

//   useEffect(() => {
//     if (searchParams?.get("created") === "1") {
//       const sp = new URLSearchParams(searchParams.toString());
//       sp.delete("created");
//       const next = `/app/interactions${sp.toString() ? `?${sp.toString()}` : ""}`;
//       router.replace(next, { scroll: false });
//       show({ title: t("interactionscreatedSuccess"), variant: "success" });
//     }
//   }, [searchParams, router, show, t]);

//   return (
//     <AppPageLayout
//       title={t("interactionstitle")}
//       actions={[{ icon: Plus, href: "/app/interactions/new" }]}
//       hideBackButton
//     >
//       {error ? (
//         <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div>
//       ) : null}

//       {loading ? (
//         <div className="text-sm text-gray-500">{t("interactionsloading")}</div>
//       ) : (
//         <InteractionList interactions={interactions} documentCounts={documentCounts} t={t} />
//       )}
//     </AppPageLayout>
//   );
// }

"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { usePageLayout } from "@/app/app/(pages)/layout";
import { Loader2, Plus } from "lucide-react";

import InteractionList from "@interactions/components/InteractionList";
import { useInteractions } from "@interactions/hooks/useInteractions";

export default function InteractionsPage() {
  const { t } = useI18n();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { interactions, documentCounts, loading, error } = useInteractions();
  const {
    setTitle,
    setSubtitle,
    setActions,
    setHideBackButton,
  } = usePageLayout();

  // --- Configure dynamiquement le layout ---
  useEffect(() => {
    setTitle(t("interactions.title"));
    setSubtitle(t("interactions.subtitle"));
    setActions([{ icon: Plus, href: "/app/interactions/new" }]);
    setHideBackButton(true);
  }, [setTitle, setSubtitle, setActions, setHideBackButton, t]);

  // --- Gestion du toast de succès ---
  useEffect(() => {
    if (searchParams?.get("created") === "1") {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("created");
      const next = `/app/interactions${sp.toString() ? `?${sp.toString()}` : ""}`;
      router.replace(next, { scroll: false });
      show({
        title: t("interactions.createdSuccess"),
        variant: "success",
      });
    }
  }, [searchParams, router, show, t]);

  if (error) {
    return (
      <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (loading) {
    return (<div className="w-full h-full flex items=center justify-center "><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /></div>)
  }

  return (
    <InteractionList
      interactions={interactions}
      documentCounts={documentCounts}
      t={t}
    />
  );
}
