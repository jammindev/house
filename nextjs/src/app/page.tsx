import React from 'react';
import Link from 'next/link';
import { ArrowRight, NotepadText, FolderOpen, Search, Layers, Shield } from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';

export default function Home() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || 'House';

  const features = [
    {
      icon: NotepadText,
      title: 'Journal Entries',
      description: 'Capture notes, receipts, maintenance logs, or any household detail with timestamps.',
      color: 'text-primary-600'
    },
    {
      icon: Layers,
      title: 'Zones & Organization',
      description: 'Tag entries to rooms or areas (e.g., Kitchen, Garage) with parent/child zones.',
      color: 'text-blue-600'
    },
    {
      icon: FolderOpen,
      title: 'Attachments',
      description: 'Upload files and link them to entries; view images/PDFs inline.',
      color: 'text-amber-600'
    },
    {
      icon: Search,
      title: 'OCR & Search (coming)',
      description: 'Extract text from images and search across your household’s knowledge base.',
      color: 'text-emerald-600'
    },
    {
      icon: Shield,
      title: 'Multi‑tenant & Private',
      description: 'Row‑Level Security keeps data scoped to your household members.',
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                {productName}
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <Link href="#features" className="text-gray-600 hover:text-gray-900">Features</Link>
              <Link href="/app" className="text-gray-600 hover:text-gray-900">Open App</Link>
              <AuthAwareButtons variant="nav" />
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Your household’s second brain
            <span className="block text-primary-600">Entries, zones, and attachments</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            House centralizes the little things: appliance manuals, paint codes, service visits, and receipts. Attach files, tag by room, and find it later.
          </p>
          <div className="mt-10 flex gap-3 justify-center">
            <Link
              href="/app/entries/new"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-primary-700 text-white hover:bg-primary-800 transition-colors"
            >
              Create a new entry
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center px-5 py-2.5 rounded-lg border text-gray-800 hover:bg-gray-50"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border shadow-sm">
                <f.icon className={`h-7 w-7 ${f.color}`} />
                <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-sm">© {new Date().getFullYear()} {productName}. All rights reserved.</p>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/legal/privacy" className="text-gray-600 hover:text-gray-900">Privacy</Link>
              <Link href="/legal/terms" className="text-gray-600 hover:text-gray-900">Terms</Link>
              <Link href="/app" className="text-gray-600 hover:text-gray-900">Open App</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
