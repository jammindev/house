// nextjs/src/app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, NotepadText, FolderOpen, Search, Layers, Shield, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSPASassClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = await createSPASassClient();
        const {
          data: { user },
        } = await supabase.getSupabaseClient().auth.getUser();
        if (user) {
          router.push("/app");
          return;
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || "House";

  const features = [
    {
      icon: NotepadText,
      title: t("landing.features.interactions.title"),
      description: t("landing.features.interactions.description"),
      color: "text-primary-600",
    },
    {
      icon: Layers,
      title: t("landing.features.zones.title"),
      description: t("landing.features.zones.description"),
      color: "text-blue-600",
    },
    {
      icon: FolderOpen,
      title: t("landing.features.attachments.title"),
      description: t("landing.features.attachments.description"),
      color: "text-amber-600",
    },
    {
      icon: Search,
      title: t("landing.features.search.title"),
      description: t("landing.features.search.description"),
      color: "text-emerald-600",
    },
    {
      icon: Shield,
      title: t("landing.features.security.title"),
      description: t("landing.features.security.description"),
      color: "text-purple-600",
    },
    {
      icon: FolderKanban,
      title: t("landing.features.projects.title"),
      description: t("landing.features.projects.description"),
      color: "text-rose-600",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center">
                <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                  {productName}
                </span>
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="#features"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("landing.nav.features")}
              </Link>
              <Link
                href="/app"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("landing.nav.openApp")}
              </Link>
              <div className="flex items-center space-x-3">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    {t("landing.nav.login")}
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm" className="bg-primary-600 hover:bg-primary-700">
                    {t("landing.nav.getStarted")}
                  </Button>
                </Link>
              </div>
            </div>
            {/* Mobile menu button */}
            <div className="md:hidden">
              <Link href="/auth/register">
                <Button size="sm" className="bg-primary-600 hover:bg-primary-700">
                  {t("landing.nav.getStarted")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            {t("landing.hero.title")}{" "}
            <span className="block mt-2 bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
              {t("landing.hero.titleHighlight")}
            </span>
          </h1>
          <p className="mt-6 text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t("landing.hero.subtitle")}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/app/interactions/new">
              <Button size="lg" className="bg-primary-600 hover:bg-primary-700 w-full sm:w-auto">
                {t("landing.hero.cta.primary")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/app">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {t("landing.hero.cta.secondary")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              {t("landing.features.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("landing.features.subtitle")}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature, i) => (
              <Card key={i} className="border-border hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="mb-3">
                    <feature.icon className={`h-10 w-10 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ready to organize your household?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join House today and never lose track of important household information again.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/auth/register">
              <Button size="lg" className="bg-primary-600 hover:bg-primary-700 w-full sm:w-auto">
                {t("landing.nav.getStarted")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/app">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {t("landing.nav.openApp")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-sm text-muted-foreground">
              {t("landing.footer.copyright", { year: new Date().getFullYear(), productName })}
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/legal/privacy"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("landing.footer.privacy")}
              </Link>
              <Link
                href="/legal/terms"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("landing.footer.terms")}
              </Link>
              <Link
                href="/app"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("landing.footer.openApp")}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
