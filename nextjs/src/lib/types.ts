// nextjs/src/lib/types.ts
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
          status: string | null
          subject: string
          tags: string[]
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          enriched_text?: string | null
          household_id: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          status?: string | null
          subject: string
          tags?: string[]
          type: string
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
          status?: string | null
          subject?: string
          tags?: string[]
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          created_by: string
          file_path: string
          id: string
          household_id: string
          metadata: Json | null
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
          id?: string
          household_id: string
          metadata?: Json | null
          mime_type?: string | null
          name: string
          notes?: string
          ocr_text?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          file_path?: string
          id?: string
          household_id?: string
          metadata?: Json | null
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
      interaction_contacts: {
        Row: {
          created_at: string
          interaction_id: string
          contact_id: string
        }
        Insert: {
          created_at?: string
          interaction_id: string
          contact_id: string
        }
        Update: {
          created_at?: string
          interaction_id?: string
          contact_id?: string
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
            foreignKeyName: "interaction_zones_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interaction_zones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
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
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      project_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
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
          description?: string
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
          description?: string
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
      projects: {
        Row: {
          actual_cost_cached: number
          closed_at: string | null
          cover_interaction_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          household_id: string
          id: string
          is_pinned: boolean
          planned_budget: number
          priority: number
          project_group_id: string | null
          start_date: string | null
          status: "draft" | "active" | "on_hold" | "completed" | "cancelled"
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
          description?: string
          due_date?: string | null
          household_id: string
          id?: string
          is_pinned?: boolean
          planned_budget?: number
          priority?: number
          project_group_id?: string | null
          start_date?: string | null
          status?: "draft" | "active" | "on_hold" | "completed" | "cancelled"
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
          description?: string
          due_date?: string | null
          household_id?: string
          id?: string
          is_pinned?: boolean
          planned_budget?: number
          priority?: number
          project_group_id?: string | null
          start_date?: string | null
          status?: "draft" | "active" | "on_hold" | "completed" | "cancelled"
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
            referencedRelation: "project_groups"
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
      zones: {
        Row: {
          created_at: string | null
          created_by: string | null
          household_id: string | null
          id: string
          name: string
          note: string | null
          parent_id: string | null
          surface: number | null
          color: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          household_id?: string | null
          id?: string
          name: string
          note?: string | null
          parent_id?: string | null
          surface?: number | null
          color?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          household_id?: string | null
          id?: string
          name?: string
          note?: string | null
          parent_id?: string | null
          surface?: number | null
          color?: string
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
            columns: ["parent_id", "household_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id", "household_id"]
          },
        ]
      }
    }
    Views: {
      project_group_metrics: {
        Row: {
          actual_cost: number
          documents_count: number
          done_todos: number
          group_id: string
          open_todos: number
          planned_budget: number
          projects_count: number
        }
        Relationships: []
      }
      project_metrics: {
        Row: {
          actual_cost: number
          documents_count: number
          done_todos: number
          open_todos: number
          project_id: string
        }
        Relationships: []
      }
    }
    Functions: {
      create_entry_with_zones: {
        Args: {
          p_household_id: string
          p_raw_text: string
          p_zone_ids: string[]
        }
        Returns: string
      }
      create_household_with_owner: {
        Args: { p_name: string }
        Returns: string
      }
    }
    Enums: {
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
    Enums: {},
  },
} as const
