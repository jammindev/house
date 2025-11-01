"use client";

import Link from "next/link";
import {
  Sparkles,
  Home,
  Notebook,
  MapPin,
  Users,
  FileText,
  LayoutDashboard,
  CheckCircle,
} from "lucide-react";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TutorialPageContent() {
  const { t } = useI18n();

  const steps = [
    {
      icon: Home,
      title: t("tutorial.steps.createHousehold.title"),
      description: t("tutorial.steps.createHousehold.description"),
    },
    {
      icon: Notebook,
      title: t("tutorial.steps.captureInteraction.title"),
      description: t("tutorial.steps.captureInteraction.description"),
    },
    {
      icon: MapPin,
      title: t("tutorial.steps.organizeZones.title"),
      description: t("tutorial.steps.organizeZones.description"),
    },
    {
      icon: Users,
      title: t("tutorial.steps.inviteAndPlan.title"),
      description: t("tutorial.steps.inviteAndPlan.description"),
    },
  ];

  const features = [
    {
      icon: Notebook,
      title: t("tutorial.features.interactions.title"),
      description: t("tutorial.features.interactions.description"),
    },
    {
      icon: MapPin,
      title: t("tutorial.features.zones.title"),
      description: t("tutorial.features.zones.description"),
    },
    {
      icon: FileText,
      title: t("tutorial.features.documents.title"),
      description: t("tutorial.features.documents.description"),
    },
    {
      icon: LayoutDashboard,
      title: t("tutorial.features.projects.title"),
      description: t("tutorial.features.projects.description"),
    },
  ];

  const tips = [
    t("tutorial.tips.items.mobile"),
    t("tutorial.tips.items.sections"),
    t("tutorial.tips.items.support"),
    t("tutorial.tips.items.access"),
  ];

  const quickActions = [
    {
      href: "/app/dashboard",
      label: t("tutorial.actions.dashboard"),
      variant: "default" as const,
    },
    {
      href: "/app/interactions",
      label: t("tutorial.actions.interactions"),
      variant: "outline" as const,
    },
    {
      href: "/app/zones",
      label: t("tutorial.actions.zones"),
      variant: "outline" as const,
    },
  ];

  return (
    <ResourcePageShell
      title={t("tutorial.title")}
      subtitle={t("tutorial.subtitle")}
      hideBackButton
      bodyClassName="space-y-10"
    >
      <section aria-labelledby="tutorial-intro">
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                <Sparkles className="h-5 w-5 text-primary-600" aria-hidden="true" />
              </span>
              <h2 id="tutorial-intro" className="text-lg font-semibold text-primary-900">
                {t("tutorial.introTitle")}
              </h2>
            </div>
            <p className="text-sm text-primary-800">{t("tutorial.intro")}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="tutorial-steps">
        <div className="flex flex-col gap-2">
          <h2 id="tutorial-steps" className="text-xl font-semibold text-foreground">
            {t("tutorial.stepsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("tutorial.stepsDescription")}</p>
        </div>
        <ol className="mt-4 space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <Card className="border-border/70 bg-background">
                  <div className="flex items-start gap-4 p-4 sm:p-5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-base font-semibold text-primary-700"
                    >
                      {index + 1}
                    </span>
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="h-5 w-5 text-primary-600" aria-hidden="true" />
                        <p className="text-base font-medium text-foreground">{step.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="tutorial-features">
        <div className="flex flex-col gap-2">
          <h2 id="tutorial-features" className="text-xl font-semibold text-foreground">
            {t("tutorial.featuresTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("tutorial.featuresDescription")}</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="h-full border-border/70">
                <CardHeader className="gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                  <CardDescription className="text-sm text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="tutorial-tips">
        <div className="flex flex-col gap-2">
          <h2 id="tutorial-tips" className="text-xl font-semibold text-foreground">
            {t("tutorial.tipsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("tutorial.tipsDescription")}</p>
        </div>
        <ul className="mt-4 space-y-3">
          {tips.map((tip) => (
            <li key={tip}>
              <div className="flex items-start gap-3 rounded-lg border border-dashed border-border/80 bg-muted/40 p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 text-primary-600" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{tip}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tutorial-actions">
        <div className="flex flex-col gap-2">
          <h2 id="tutorial-actions" className="text-xl font-semibold text-foreground">
            {t("tutorial.actionsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("tutorial.actionsDescription")}</p>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {quickActions.map((action) => (
            <Button
              key={action.href}
              asChild
              variant={action.variant}
              className="w-full sm:w-auto"
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      </section>
    </ResourcePageShell>
  );
}
