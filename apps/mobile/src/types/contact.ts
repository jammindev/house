// mobile/src/types/contact.ts
export type ContactStructure = {
    id: string;
    name: string;
    type?: string | null;
};

export type ContactEmail = {
    id: string;
    email: string;
    label?: string | null;
    is_primary: boolean;
    created_at?: string | null;
};

export type ContactPhone = {
    id: string;
    phone: string;
    label?: string | null;
    is_primary: boolean;
    created_at?: string | null;
};

export type ContactAddress = {
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

export type Contact = {
    id: string;
    household_id: string;
    structure_id?: string | null;
    first_name: string;
    last_name: string;
    position?: string | null;
    notes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    structure?: ContactStructure | null;
    emails: ContactEmail[];
    phones: ContactPhone[];
    addresses: ContactAddress[];
};

export type CreateContactInput = {
    householdId: string;
    firstName: string;
    lastName?: string;
    position?: string;
    notes?: string;
    email?: {
        email: string;
        label?: string | null;
        is_primary?: boolean | null;
    } | null;
    phone?: {
        phone: string;
        label?: string | null;
        is_primary?: boolean | null;
    } | null;
};