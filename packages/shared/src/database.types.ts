// Generated from the Supabase schema (supabase/migrations). Do not edit by hand.
// Regenerate: npx supabase gen types typescript --project-id lyplhlbjuhsigkurckqx > packages/shared/src/database.types.ts

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      leads: {
        Row: {
          agent_id: string
          bedrooms_needed: number | null
          budget_monthly: number | null
          call_successful: string | null
          contact: string | null
          conversation_id: string
          created_at: string
          data_collection: Json
          duration_secs: number | null
          evaluation: Json
          id: string
          move_in: string | null
          notes: string | null
          pets: string | null
          preferred_showing_time: string | null
          recommended_listing_slug: string | null
          renter_name: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["lead_status"]
          summary: string | null
          tenant_id: string
          title: string | null
          transcript: Json
          updated_at: string
          vehicles: number | null
        }
        Insert: {
          agent_id: string
          bedrooms_needed?: number | null
          budget_monthly?: number | null
          call_successful?: string | null
          contact?: string | null
          conversation_id: string
          created_at?: string
          data_collection?: Json
          duration_secs?: number | null
          evaluation?: Json
          id?: string
          move_in?: string | null
          notes?: string | null
          pets?: string | null
          preferred_showing_time?: string | null
          recommended_listing_slug?: string | null
          renter_name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          summary?: string | null
          tenant_id: string
          title?: string | null
          transcript?: Json
          updated_at?: string
          vehicles?: number | null
        }
        Update: {
          agent_id?: string
          bedrooms_needed?: number | null
          budget_monthly?: number | null
          call_successful?: string | null
          contact?: string | null
          conversation_id?: string
          created_at?: string
          data_collection?: Json
          duration_secs?: number | null
          evaluation?: Json
          id?: string
          move_in?: string | null
          notes?: string | null
          pets?: string | null
          preferred_showing_time?: string | null
          recommended_listing_slug?: string | null
          renter_name?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          summary?: string | null
          tenant_id?: string
          title?: string | null
          transcript?: Json
          updated_at?: string
          vehicles?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_events: {
        Row: {
          action: string
          actor: string | null
          at: string
          changes: Json | null
          id: number
          listing_id: string | null
          listing_slug: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string
          changes?: Json | null
          id?: never
          listing_id?: string | null
          listing_slug: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          changes?: Json | null
          id?: never
          listing_id?: string | null
          listing_slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          amenities: string[]
          available_now: boolean
          available_on: string | null
          baths: number
          beds: number
          city: string
          cooling: string | null
          created_at: string
          created_by: string | null
          description: string
          heating: string | null
          highlights: string[]
          id: string
          laundry: string | null
          mls_number: string | null
          neighbourhood: string
          outdoor: string | null
          parking_spots: number | null
          parking_type: string | null
          pets: string | null
          postal_code: string
          property_type: string
          province: string
          rent_monthly: number
          slug: string
          sqft: string | null
          status: Database["public"]["Enums"]["listing_status"]
          storage: string | null
          street: string
          tenant_id: string
          tenant_pays: string[]
          title: string
          transit: string | null
          unit: string | null
          updated_at: string
          updated_by: string | null
          utilities_included: string[]
        }
        Insert: {
          amenities?: string[]
          available_now?: boolean
          available_on?: string | null
          baths: number
          beds: number
          city: string
          cooling?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          heating?: string | null
          highlights?: string[]
          id?: string
          laundry?: string | null
          mls_number?: string | null
          neighbourhood: string
          outdoor?: string | null
          parking_spots?: number | null
          parking_type?: string | null
          pets?: string | null
          postal_code: string
          property_type: string
          province: string
          rent_monthly: number
          slug: string
          sqft?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          storage?: string | null
          street: string
          tenant_id: string
          tenant_pays?: string[]
          title: string
          transit?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          utilities_included?: string[]
        }
        Update: {
          amenities?: string[]
          available_now?: boolean
          available_on?: string | null
          baths?: number
          beds?: number
          city?: string
          cooling?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          heating?: string | null
          highlights?: string[]
          id?: string
          laundry?: string | null
          mls_number?: string | null
          neighbourhood?: string
          outdoor?: string | null
          parking_spots?: number | null
          parking_type?: string | null
          pets?: string | null
          postal_code?: string
          property_type?: string
          province?: string
          rent_monthly?: number
          slug?: string
          sqft?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          storage?: string | null
          street?: string
          tenant_id?: string
          tenant_pays?: string[]
          title?: string
          transit?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
          utilities_included?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "listings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["team_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      call_result: { Args: { p_conversation_id: string }; Returns: Json }
    }
    Enums: {
      lead_status: "new" | "contacted" | "closed"
      listing_status: "draft" | "published" | "archived"
      team_role: "admin" | "editor" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      lead_status: ["new", "contacted", "closed"],
      listing_status: ["draft", "published", "archived"],
      team_role: ["admin", "editor", "viewer"],
    },
  },
} as const
