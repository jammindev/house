export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_1: string
          address_2: string
          city: string
          contact_id: string | null
          country: string
          created_at: string | null
          created_by: string
          household_id: string
          id: string
          is_primary: boolean | null
          label: string | null
          structure_id: string | null
          updated_at: string | null
          updated_by: string | null
          zipcode: string
        }
        Insert: {
          address_1?: string
          address_2?: string
          city?: string
          contact_id?: string | null
          country?: string
          created_at?: string | null
          created_by: string
          household_id: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          structure_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          zipcode?: string
        }
        Update: {
          address_1?: string
          address_2?: string
          city?: string
          contact_id?: string | null
          country?: string
          created_at?: string | null
          created_by?: string
          household_id?: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          structure_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          zipcode?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string | null
          created_by: string
          first_name: string
          household_id: string
          id: string
          last_name: string
          notes: string | null
          position: string | null
          structure_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          first_name?: string
          household_id: string
          id?: string
          last_name?: string
          notes?: string | null
          position?: string | null
          structure_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          first_name?: string
          household_id?: string
          id?: string
          last_name?: string
          notes?: string | null
          position?: string | null
          structure_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          created_by: string
          file_path: string
          household_id: string
          id: string
          metadata: Json
          mime_type: string | null
          name: string
          notes: string
          ocr_text: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          file_path: string
          household_id: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          name?: string
          notes?: string
          ocr_text?: string | null
          type?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          file_path?: string
          household_id?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          name?: string
          notes?: string
          ocr_text?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          contact_id: string | null
          created_at: string | null
          created_by: string
          email: string
          household_id: string
          id: string
          is_primary: boolean | null
          label: string | null
          structure_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          created_by: string
          email: string
          household_id: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          structure_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string
          email?: string
          household_id?: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          structure_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: string
          condition: string | null
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          installed_at: string | null
          last_service_at: string | null
          maintenance_interval_months: number | null
          manufacturer: string | null
          model: string | null
          name: string
          next_service_due: string | null
          notes: string
          purchase_date: string | null
          purchase_price: number | null
          purchase_vendor: string | null
          retired_at: string | null
          serial_number: string | null
          status: string
          tags: string[]
          updated_at: string
          updated_by: string | null
          warranty_expires_on: string | null
          warranty_notes: string
          warranty_provider: string | null
          zone_id: string | null
        }
        Insert: {
          category?: string
          condition?: string | null
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          installed_at?: string | null
          last_service_at?: string | null
          maintenance_interval_months?: number | null
          manufacturer?: string | null
          model?: string | null
          name: string
          next_service_due?: string | null
          notes?: string
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_vendor?: string | null
          retired_at?: string | null
          serial_number?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          warranty_expires_on?: string | null
          warranty_notes?: string
          warranty_provider?: string | null
          zone_id?: string | null
        }
        Update: {
          category?: string
          condition?: string | null
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          installed_at?: string | null
          last_service_at?: string | null
          maintenance_interval_months?: number | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          next_service_due?: string | null
          notes?: string
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_vendor?: string | null
          retired_at?: string | null
          serial_number?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          warranty_expires_on?: string | null
          warranty_notes?: string
          warranty_provider?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_interactions: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_id: string
          interaction_id: string
          note: string
          role: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_id: string
          interaction_id: string
          note?: string
          role?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          interaction_id?: string
          note?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_interactions_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_interactions_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          household_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          household_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          address: string | null
          ai_prompt_context: string | null
          city: string | null
          context_notes: string | null
          country: string | null
          created_at: string | null
          default_household: boolean
          id: string
          inbound_email_alias: string | null
          name: string
        }
        Insert: {
          address?: string | null
          ai_prompt_context?: string | null
          city?: string | null
          context_notes?: string | null
          country?: string | null
          created_at?: string | null
          default_household?: boolean
          id?: string
          inbound_email_alias?: string | null
          name: string
        }
        Update: {
          address?: string | null
          ai_prompt_context?: string | null
          city?: string | null
          context_notes?: string | null
          country?: string | null
          created_at?: string | null
          default_household?: boolean
          id?: string
          inbound_email_alias?: string | null
          name?: string
        }
        Relationships: []
      }
      incoming_email_attachments: {
        Row: {
          content_base64: string | null
          content_type: string | null
          created_at: string | null
          document_id: string | null
          filename: string
          id: string
          incoming_email_id: string
          metadata: Json | null
          size_bytes: number | null
        }
        Insert: {
          content_base64?: string | null
          content_type?: string | null
          created_at?: string | null
          document_id?: string | null
          filename: string
          id?: string
          incoming_email_id: string
          metadata?: Json | null
          size_bytes?: number | null
        }
        Update: {
          content_base64?: string | null
          content_type?: string | null
          created_at?: string | null
          document_id?: string | null
          filename?: string
          id?: string
          incoming_email_id?: string
          metadata?: Json | null
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "incoming_email_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_email_attachments_incoming_email_id_fkey"
            columns: ["incoming_email_id"]
            isOneToOne: false
            referencedRelation: "incoming_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_emails: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string | null
          created_by: string | null
          from_email: string
          from_name: string | null
          household_id: string
          id: string
          interaction_id: string | null
          message_id: string
          metadata: Json | null
          processed_at: string | null
          processing_error: string | null
          processing_status: Database["public"]["Enums"]["email_processing_status"]
          received_at: string
          subject: string
          to_email: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          created_by?: string | null
          from_email: string
          from_name?: string | null
          household_id: string
          id?: string
          interaction_id?: string | null
          message_id: string
          metadata?: Json | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["email_processing_status"]
          received_at?: string
          subject?: string
          to_email: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          created_by?: string | null
          from_email?: string
          from_name?: string | null
          household_id?: string
          id?: string
          interaction_id?: string | null
          message_id?: string
          metadata?: Json | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: Database["public"]["Enums"]["email_processing_status"]
          received_at?: string
          subject?: string
          to_email?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incoming_emails_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_emails_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_contacts: {
        Row: {
          contact_id: string
          created_at: string
          interaction_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          interaction_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          interaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_contacts_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_documents: {
        Row: {
          created_at: string
          document_id: string
          interaction_id: string
          note: string
          role: string
        }
        Insert: {
          created_at?: string
          document_id: string
          interaction_id: string
          note?: string
          role?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          interaction_id?: string
          note?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_documents_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_structures: {
        Row: {
          created_at: string
          interaction_id: string
          structure_id: string
        }
        Insert: {
          created_at?: string
          interaction_id: string
          structure_id: string
        }
        Update: {
          created_at?: string
          interaction_id?: string
          structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_structures_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_structures_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_tags: {
        Row: {
          created_at: string
          created_by: string | null
          interaction_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          interaction_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          interaction_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interaction_tags_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      interaction_zones: {
        Row: {
          interaction_id: string
          zone_id: string
        }
        Insert: {
          interaction_id: string
          zone_id: string
        }
        Update: {
          interaction_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_zones_entry_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_zones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          enriched_text: string | null
          household_id: string
          id: string
          metadata: Json | null
          occurred_at: string
          project_id: string | null
          status: string | null
          subject: string
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          created_by: string
          enriched_text?: string | null
          household_id: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          project_id?: string | null
          status?: string | null
          subject?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          enriched_text?: string | null
          household_id?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          project_id?: string | null
          status?: string | null
          subject?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "interactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      phones: {
        Row: {
          contact_id: string | null
          created_at: string | null
          created_by: string
          household_id: string
          id: string
          is_primary: boolean | null
          label: string | null
          phone: string
          structure_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          created_by: string
          household_id: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          phone: string
          structure_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string
          household_id?: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          phone?: string
          structure_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phones_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phones_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "structures"
            referencedColumns: ["id"]
          },
        ]
      }
      project_ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "project_ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      project_ai_threads: {
        Row: {
          archived_at: string | null
          created_at: string
          household_id: string
          id: string
          project_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          household_id: string
          id?: string
          project_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          household_id?: string
          id?: string
          project_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_ai_threads_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_ai_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_ai_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          household_id: string
          id: string
          name: string
          tags: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          household_id: string
          id?: string
          name: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          household_id?: string
          id?: string
          name?: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_groups_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      project_zones: {
        Row: {
          created_at: string | null
          created_by: string | null
          project_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          project_id: string
          zone_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          project_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_metrics"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_zones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_cost_cached: number
          closed_at: string | null
          cover_interaction_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          household_id: string
          id: string
          is_pinned: boolean
          planned_budget: number
          priority: number
          project_group_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          tags: string[]
          title: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_cost_cached?: number
          closed_at?: string | null
          cover_interaction_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          household_id: string
          id?: string
          is_pinned?: boolean
          planned_budget?: number
          priority?: number
          project_group_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[]
          title: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_cost_cached?: number
          closed_at?: string | null
          cover_interaction_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          household_id?: string
          id?: string
          is_pinned?: boolean
          planned_budget?: number
          priority?: number
          project_group_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_cover_interaction_id_fkey"
            columns: ["cover_interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_group_metrics"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "projects_project_group_id_fkey"
            columns: ["project_group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      structures: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          household_id: string
          id: string
          name: string
          tags: string[] | null
          type: string | null
          updated_at: string | null
          updated_by: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          household_id: string
          id?: string
          name?: string
          tags?: string[] | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          household_id?: string
          id?: string
          name?: string
          tags?: string[] | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structures_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      system_admins: {
        Row: {
          created_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          name: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_list: {
        Row: {
          created_at: string
          description: string | null
          done: boolean
          done_at: string | null
          id: number
          owner: string
          title: string
          urgent: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: number
          owner: string
          title: string
          urgent?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: number
          owner?: string
          title?: string
          urgent?: boolean
        }
        Relationships: []
      }
      zone_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string
          note: string
          role: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id: string
          note?: string
          role?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string
          note?: string
          role?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_documents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          color: string
          created_at: string | null
          created_by: string | null
          household_id: string | null
          id: string
          name: string
          note: string | null
          parent_id: string | null
          surface: number | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          created_by?: string | null
          household_id?: string | null
          id?: string
          name: string
          note?: string | null
          parent_id?: string | null
          surface?: number | null
        }
        Update: {
          color?: string
          created_at?: string | null
          created_by?: string | null
          household_id?: string | null
          id?: string
          name?: string
          note?: string | null
          parent_id?: string | null
          surface?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "zones_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_parent_same_household_fk"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      project_group_metrics: {
        Row: {
          actual_cost: number | null
          documents_count: number | null
          done_todos: number | null
          group_id: string | null
          open_todos: number | null
          planned_budget: number | null
          projects_count: number | null
        }
        Relationships: []
      }
      project_metrics: {
        Row: {
          actual_cost: number | null
          documents_count: number | null
          done_todos: number | null
          open_todos: number | null
          project_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assert_quote_has_link: {
        Args: { p_interaction_id: string }
        Returns: undefined
      }
      create_entry_with_zones: {
        Args: {
          p_household_id: string
          p_raw_text: string
          p_zone_ids: string[]
        }
        Returns: string
      }
      create_household_with_owner:
        | { Args: { p_name: string }; Returns: string }
        | {
            Args: {
              p_address?: string
              p_ai_prompt_context?: string
              p_city?: string
              p_context_notes?: string
              p_country?: string
              p_name: string
            }
            Returns: string
          }
      create_interaction_with_zones:
        | {
            Args: {
              p_contact_ids?: string[]
              p_content?: string
              p_household_id: string
              p_incoming_email_id?: string
              p_occurred_at?: string
              p_project_id?: string
              p_status?: string
              p_structure_ids?: string[]
              p_subject: string
              p_tag_ids?: string[]
              p_type?: string
              p_zone_ids: string[]
            }
            Returns: string
          }
        | {
            Args: {
              p_contact_ids?: string[]
              p_content?: string
              p_household_id: string
              p_metadata?: Json
              p_occurred_at?: string
              p_project_id?: string
              p_status?: string
              p_structure_ids?: string[]
              p_subject: string
              p_tag_ids?: string[]
              p_type?: string
              p_zone_ids: string[]
            }
            Returns: string
          }
      delete_household: { Args: { p_household_id: string }; Returns: undefined }
      ensure_household_email_alias: { Args: never; Returns: undefined }
      generate_household_email_alias: {
        Args: { household_uuid: string }
        Returns: string
      }
      get_household_members: {
        Args: { p_household_id: string }
        Returns: {
          joined_at: string
          role: string
          user_display_name: string
          user_email: string
          user_id: string
        }[]
      }
      get_system_stats: { Args: never; Returns: Json }
      get_user_admin_role: { Args: never; Returns: string }
      grant_admin_role: {
        Args: { p_notes?: string; p_role?: string; p_user_id: string }
        Returns: undefined
      }
      is_super_admin: { Args: never; Returns: boolean }
      is_system_admin: { Args: never; Returns: boolean }
      leave_household: { Args: { p_household_id: string }; Returns: undefined }
      lighten_hex_color: {
        Args: { base: string; factor?: number }
        Returns: string
      }
      project_expense_amount: { Args: { p_metadata: Json }; Returns: number }
      refresh_project_actual_cost: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      revoke_admin_role: { Args: { p_user_id: string }; Returns: undefined }
    }
    Enums: {
      email_processing_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "ignored"
      project_status: "draft" | "active" | "on_hold" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      email_processing_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "ignored",
      ],
      project_status: ["draft", "active", "on_hold", "completed", "cancelled"],
    },
  },
} as const
