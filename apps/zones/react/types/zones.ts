export type Zone = {
  id: string;
  name: string;
  created_by?: string;
  parent_id?: string | null;
  note?: string | null;
  surface?: number | null;
  color: string;
  full_path?: string;
  depth?: number;
  children_count?: number;
  updated_at?: string;
};

export type ZoneDetail = Zone & {
  household_id: string;
  created_at?: string | null;
  parent?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
};

export type ZoneStats = {
  totalCount: number;
  rootCount: number;
  childCount: number;
  surfaceSum: number;
  hasSurfaceData: boolean;
};

export type ZoneTree = {
  zonesById: Map<string, Zone>;
  sortedZones: Zone[];
  zoneDepths: Map<string, number>;
  zoneStats: ZoneStats;
};

export type ZonePhoto = {
  zone: string;
  document: string;
  document_name?: string;
  document_file_path?: string;
  role?: string;
  note?: string;
  created_at?: string;
};

export type ZonesPageProps = {
  householdId?: string | null;
  initialZones: Array<{
    id: string;
    name: string;
    fullPath: string;
    color: string;
    parentId: string | null;
  }>;
};

export type ZoneDetailPageProps = {
  householdId?: string | null;
  zoneId: string;
  initialZone?: {
    id: string;
    name: string;
    parentId: string | null;
    parentName?: string | null;
    note?: string | null;
    surface?: number | null;
    color?: string | null;
    updatedAt?: string | null;
  };
  initialStats?: {
    childrenCount: number;
    photosCount: number;
  };
  initialPhotos?: ZonePhoto[];
};

export type ZoneMutationPayload = {
  name: string;
  parent_id: string | null;
  note: string | null;
  surface: number | null;
  color?: string | null;
};
