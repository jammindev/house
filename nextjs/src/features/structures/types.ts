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
  addresses: StructureAddress[];
  emails: StructureEmail[];
  phones: StructurePhone[];
};

export type CreateStructureInput = {
  householdId: string;
  name: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  tags?: string[] | null;
  addresses?: StructureAddressInput[];
  emails?: StructureEmailInput[];
  phones?: StructurePhoneInput[];
};

export type UpdateStructureInput = {
  structureId: string;
  householdId: string;
  name: string;
  type?: string | null;
  description?: string | null;
  website?: string | null;
  tags?: string[] | null;
  addresses?: StructureAddressInput[];
  emails?: StructureEmailInput[];
  phones?: StructurePhoneInput[];
};

export type StructureAddress = {
  id: string;
  address_1: string;
  address_2?: string | null;
  zipcode?: string | null;
  city?: string | null;
  country?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

export type StructureAddressInput = {
  id?: string;
  address_1: string;
  address_2?: string | null;
  zipcode?: string | null;
  city?: string | null;
  country?: string | null;
  label?: string | null;
  is_primary?: boolean | null;
};

export type StructureEmail = {
  id: string;
  email: string;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

export type StructureEmailInput = {
  id?: string;
  email: string;
  label?: string | null;
  is_primary?: boolean | null;
};

export type StructurePhone = {
  id: string;
  phone: string;
  label?: string | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

export type StructurePhoneInput = {
  id?: string;
  phone: string;
  label?: string | null;
  is_primary?: boolean | null;
};
