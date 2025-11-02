"use client";

import LegalDocument from "@/components/LegalDocument";
import { notFound } from "next/navigation";
import { useI18n } from "@/lib/i18n/I18nProvider";

const legalDocuments = {
  privacy: {
    titleKey: "legal.privacyNotice",
    path: "/terms/privacy-notice.md",
  },
  terms: {
    titleKey: "legal.termsOfService",
    path: "/terms/terms-of-service.md",
  },
  refund: {
    titleKey: "legal.refundPolicy",
    path: "/terms/refund-policy.md",
  },
} as const;

type LegalDocumentKey = keyof typeof legalDocuments;

type LegalPageProps = {
  params: { document: string };
};

function isLegalDocumentKey(value: string): value is LegalDocumentKey {
  return value in legalDocuments;
}

export default function LegalPage({ params }: LegalPageProps) {
  const { t } = useI18n();
  const document = params.document;

  if (!isLegalDocumentKey(document)) {
    notFound();
  }

  const { titleKey, path } = legalDocuments[document];

  return (
    <div className="container mx-auto px-4 py-8">
      <LegalDocument title={t(titleKey)} filePath={path} />
    </div>
  );
}
