import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design-system/card';

interface SettingsSectionProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Standardized settings card component.
 * All settings sections should use this for consistent layout.
 */
export function SettingsSection({ title, description, actions, children }: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader className={actions ? 'flex flex-row items-start justify-between space-y-0' : undefined}>
        <div className="flex-1 space-y-1.5">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
