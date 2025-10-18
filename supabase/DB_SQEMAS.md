-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  contact_id uuid,
  structure_id uuid,
  address_1 text NOT NULL DEFAULT ''::text,
  address_2 text NOT NULL DEFAULT ''::text,
  zipcode text NOT NULL DEFAULT ''::text,
  city text NOT NULL DEFAULT ''::text,
  country text NOT NULL DEFAULT ''::text,
  label text DEFAULT ''::text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  updated_by uuid,
  CONSTRAINT addresses_pkey PRIMARY KEY (id),
  CONSTRAINT addresses_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT addresses_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT addresses_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id),
  CONSTRAINT addresses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT addresses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  structure_id uuid,
  first_name text NOT NULL DEFAULT ''::text,
  last_name text NOT NULL DEFAULT ''::text,
  position text DEFAULT ''::text,
  notes text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  updated_by uuid,
  CONSTRAINT contacts_pkey PRIMARY KEY (id),
  CONSTRAINT contacts_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT contacts_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id),
  CONSTRAINT contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT contacts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  interaction_id uuid NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  ocr_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  type text NOT NULL DEFAULT 'document'::text CHECK (type = ANY (ARRAY['document'::text, 'photo'::text, 'quote'::text, 'invoice'::text, 'contract'::text, 'other'::text])),
  name text NOT NULL DEFAULT ''::text,
  notes text NOT NULL DEFAULT ''::text,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT entry_files_entry_id_fkey FOREIGN KEY (interaction_id) REFERENCES public.interactions(id),
  CONSTRAINT entry_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.emails (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  contact_id uuid,
  structure_id uuid,
  email text NOT NULL,
  label text DEFAULT ''::text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  updated_by uuid,
  CONSTRAINT emails_pkey PRIMARY KEY (id),
  CONSTRAINT emails_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT emails_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT emails_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id),
  CONSTRAINT emails_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT emails_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.household_members (
  household_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member'::text,
  CONSTRAINT household_members_pkey PRIMARY KEY (household_id, user_id),
  CONSTRAINT household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT household_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.households (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT households_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'interaction'::text,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT tags_pkey PRIMARY KEY (id),
  CONSTRAINT tags_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.interaction_zones (
  interaction_id uuid NOT NULL,
  zone_id uuid NOT NULL,
  CONSTRAINT interaction_zones_pkey PRIMARY KEY (interaction_id, zone_id),
  CONSTRAINT entry_zones_entry_id_fkey FOREIGN KEY (interaction_id) REFERENCES public.interactions(id),
  CONSTRAINT entry_zones_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id)
);
CREATE TABLE public.interaction_tags (
  interaction_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT interaction_tags_pkey PRIMARY KEY (interaction_id, tag_id),
  CONSTRAINT interaction_tags_interaction_id_fkey FOREIGN KEY (interaction_id) REFERENCES public.interactions(id),
  CONSTRAINT interaction_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id),
  CONSTRAINT interaction_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  content text NOT NULL,
  enriched_text text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  updated_by uuid,
  subject text NOT NULL DEFAULT 'Untitled interaction'::text,
  type text NOT NULL DEFAULT 'note'::text CHECK (type = ANY (ARRAY['note'::text, 'todo'::text, 'call'::text, 'meeting'::text, 'document'::text, 'expense'::text, 'message'::text, 'signature'::text, 'other'::text])),
  status text CHECK (status IS NULL OR (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'done'::text, 'archived'::text]))),
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  contact_id uuid,
  structure_id uuid,
  CONSTRAINT interactions_pkey PRIMARY KEY (id),
  CONSTRAINT entries_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT entries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id),
  CONSTRAINT interactions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT interactions_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id)
);
CREATE TABLE public.phones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  contact_id uuid,
  structure_id uuid,
  phone text NOT NULL,
  label text DEFAULT ''::text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  updated_by uuid,
  CONSTRAINT phones_pkey PRIMARY KEY (id),
  CONSTRAINT phones_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT phones_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id),
  CONSTRAINT phones_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES public.structures(id),
  CONSTRAINT phones_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT phones_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.structures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  name text NOT NULL DEFAULT ''::text,
  type text DEFAULT ''::text,
  description text DEFAULT ''::text,
  website text DEFAULT ''::text,
  tags ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  updated_by uuid,
  CONSTRAINT structures_pkey PRIMARY KEY (id),
  CONSTRAINT structures_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT structures_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT structures_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.todo_list (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text NOT NULL,
  urgent boolean NOT NULL DEFAULT false,
  description text,
  done boolean NOT NULL DEFAULT false,
  done_at timestamp with time zone,
  owner uuid NOT NULL,
  CONSTRAINT todo_list_pkey PRIMARY KEY (id),
  CONSTRAINT todo_list_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id)
);
CREATE TABLE public.zones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  parent_id uuid,
  created_by uuid,
  note text,
  surface numeric CHECK (surface >= 0::numeric),
  CONSTRAINT zones_pkey PRIMARY KEY (id),
  CONSTRAINT zones_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT zones_parent_same_household_fk FOREIGN KEY (household_id) REFERENCES public.zones(id),
  CONSTRAINT zones_parent_same_household_fk FOREIGN KEY (parent_id) REFERENCES public.zones(id),
  CONSTRAINT zones_parent_same_household_fk FOREIGN KEY (household_id) REFERENCES public.zones(household_id),
  CONSTRAINT zones_parent_same_household_fk FOREIGN KEY (parent_id) REFERENCES public.zones(household_id),
  CONSTRAINT zones_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
