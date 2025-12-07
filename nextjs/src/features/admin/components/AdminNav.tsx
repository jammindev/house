// Admin navigation sidebar
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, Home, Users, UserCheck, Database, Settings,
  Activity, FileText, BarChart3, AlertTriangle, ArrowLeft
} from 'lucide-react';

interface AdminNavProps {
  className?: string;
}

const adminNavItems = [
  {
    title: 'Vue d\'ensemble',
    href: '/admin',
    icon: BarChart3,
    description: 'Dashboard général'
  },
  {
    title: 'Utilisateurs',
    href: '/admin/users',
    icon: Users,
    description: 'Gestion des comptes'
  },
  {
    title: 'Foyers',
    href: '/admin/households',
    icon: Home,
    description: 'Gestion des foyers'
  },
  {
    title: 'Administrateurs',
    href: '/admin/admins',
    icon: UserCheck,
    description: 'Gestion des admins'
  },
  {
    title: 'Base de données',
    href: '/admin/database',
    icon: Database,
    description: 'Outils de maintenance'
  },
  {
    title: 'Logs système',
    href: '/admin/logs',
    icon: Activity,
    description: 'Journaux d\'activité'
  },
  {
    title: 'Configuration',
    href: '/admin/system',
    icon: Settings,
    description: 'Paramètres système'
  }
];

export function AdminNav({ className }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-2", className)}>
      {/* Return to app */}
      <div className="pb-4 border-b">
        <Link href="/app">
          <Button variant="outline" className="w-full justify-start">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'application
          </Button>
        </Link>
      </div>

      {/* Admin navigation */}
      <div className="space-y-1">
        {adminNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-auto p-3",
                  isActive && "bg-muted font-medium"
                )}
              >
                <div className="flex items-center gap-3 w-full">
                  <Icon className={cn(
                    "h-4 w-4 flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </Button>
            </Link>
          );
        })}
      </div>

      {/* System Status */}
      <div className="pt-4 border-t space-y-3">
        <div className="px-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">STATUT SYSTÈME</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Base de données</span>
              <Badge variant="secondary" className="text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                En ligne
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Stockage</span>
              <Badge variant="secondary" className="text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                Disponible
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">API</span>
              <Badge variant="secondary" className="text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                Opérationnelle
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

interface AdminHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function AdminHeader({ title, description, action }: AdminHeaderProps) {
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-2 flex-1">
          <Shield className="h-5 w-5 text-red-600" />
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action && (
          <div className="flex items-center gap-2">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}