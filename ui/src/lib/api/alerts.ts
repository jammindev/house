import { api } from '@/lib/axios';

export type AlertSeverity = 'critical' | 'warning';

export interface OverdueTaskAlert {
  id: string;
  title: string;
  due_date: string;
  days_overdue: number;
  entity_url: string;
  severity: AlertSeverity;
}

export interface ExpiringWarrantyAlert {
  id: string;
  title: string;
  warranty_expires_on: string;
  days_remaining: number;
  entity_url: string;
  severity: AlertSeverity;
}

export interface DueMaintenanceAlert {
  id: string;
  title: string;
  next_service_due: string;
  days_remaining: number;
  entity_url: string;
  severity: AlertSeverity;
}

export interface LowStockAlert {
  id: string;
  title: string;
  status: 'low_stock' | 'out_of_stock' | 'expired';
  quantity: string;
  min_quantity: string | null;
  unit: string;
  entity_url: string;
  severity: AlertSeverity;
}

export interface AlertsSummary {
  overdue_tasks: OverdueTaskAlert[];
  expiring_warranties: ExpiringWarrantyAlert[];
  due_maintenances: DueMaintenanceAlert[];
  low_stock: LowStockAlert[];
  weather_alerts: WeatherAlert[];
  total: number;
}

export type WeatherAlertKind = 'frost' | 'heatwave' | 'wind' | 'storm';

export interface WeatherAlert {
  kind: WeatherAlertKind;
  date: string;
  value: number | null;
  unit: string | null;
  entity_url: string;
  severity: AlertSeverity;
}

export async function fetchAlertsSummary(): Promise<AlertsSummary> {
  const { data } = await api.get<AlertsSummary>('/alerts/summary/');
  return data;
}
