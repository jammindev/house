// mobile/src/types/structure.ts
export type StructureAddress = {
    id: string;
    address_1: string;
    address_2?: string | null;
    zipcode?: string | null;
    city?: string | null;
    country?: string | null;
    label?: string | null;
    is_primary: boolean;
    created_at?: string | null;
};

export type StructureEmail = {
    id: string;
    email: string;
    label?: string | null;
    is_primary: boolean;
    created_at?: string | null;
};

export type StructurePhone = {
    id: string;
    phone: string;
    label?: string | null;
    is_primary: boolean;
    created_at?: string | null;
};

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
    addresses?: Array<{
        id?: string;
        address_1: string;
        address_2?: string | null;
        zipcode?: string | null;
        city?: string | null;
        country?: string | null;
        label?: string | null;
        is_primary?: boolean | null;
    }>;
    emails?: Array<{
        id?: string;
        email: string;
        label?: string | null;
        is_primary?: boolean | null;
    }>;
    phones?: Array<{
        id?: string;
        phone: string;
        label?: string | null;
        is_primary?: boolean | null;
    }>;
};