export type Structure = {
  id: string;
  household_id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateStructureInput = {
  householdId: string;
  name: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  tags?: string[] | null;
};
