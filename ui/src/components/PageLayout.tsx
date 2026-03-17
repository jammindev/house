import { useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '../design-system/button';
import { cn } from '../lib/utils';
import { useSidebarToggle } from './SidebarToggleContext';

export type PageAction =
  | { element: ReactNode }
  | {
      label: string;
      icon: LucideIcon;
      href?: string;
      onClick?: () => void;
      disabled?: boolean;
    };

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: PageAction[];
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function PageLayout({
  title,
  subtitle,
  actions,
  children,
  className,
  contentClassName,
}: PageLayoutProps) {
  const { toggleSidebar } = useSidebarToggle();
  const [scrollOpacity, setScrollOpacity] = useState(1);

  useEffect(() => {
    const onScroll = () => {
      setScrollOpacity(Math.max(0, 1 - window.scrollY / 50));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { document.title = `${title} — House`; }, [title]);

  const actionButtons = actions?.map((action, i) => {
    if ('element' in action) return <div key={i}>{action.element}</div>;
    const btn = (
      <Button key={i} size="icon" variant="outline" disabled={action.disabled} onClick={action.onClick} aria-label={action.label}>
        <action.icon className="h-5 w-5" />
        <span className="sr-only">{action.label}</span>
      </Button>
    );
    return action.href ? <NavLink key={i} to={action.href}>{btn}</NavLink> : btn;
  });

  return (
    <div className={cn('mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 pb-8', className)}>
      <div className="sticky top-0 z-20 pt-4 pb-2 bg-background/80 backdrop-blur">
        <div className="grid grid-cols-[auto,1fr,auto] items-center gap-2">
          <Button size="icon" variant="ghost" onClick={toggleSidebar} aria-label="Menu" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>

          <div className="min-w-0 transition-opacity duration-300" style={{ opacity: scrollOpacity }}>
            <h1 className="text-xl font-semibold text-foreground truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2">{actionButtons}</div>
        </div>
      </div>

      <div className={cn('flex-1', contentClassName)}>{children}</div>
    </div>
  );
}
