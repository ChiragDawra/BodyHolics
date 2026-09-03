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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alert_reads: {
        Row: {
          alert_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          alert_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          alert_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_reads_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          gym_id: string
          id: string
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          gym_id: string
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          gym_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          gym_id: string
          id: string
          method: Database["public"]["Enums"]["attendance_method"]
          profile_id: string
          recorded_by: string | null
        }
        Insert: {
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          gym_id: string
          id?: string
          method?: Database["public"]["Enums"]["attendance_method"]
          profile_id: string
          recorded_by?: string | null
        }
        Update: {
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          method?: Database["public"]["Enums"]["attendance_method"]
          profile_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crowd_schedule: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          gym_id: string
          id: string
          level: Database["public"]["Enums"]["crowd_level"]
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          gym_id: string
          id?: string
          level: Database["public"]["Enums"]["crowd_level"]
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          gym_id?: string
          id?: string
          level?: Database["public"]["Enums"]["crowd_level"]
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "crowd_schedule_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_hour_blocks: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          gym_id: string
          id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          gym_id: string
          id?: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          gym_id?: string
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_hour_blocks_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_secrets: {
        Row: {
          check_pin_hash: string
          gym_id: string
          updated_at: string
        }
        Insert: {
          check_pin_hash: string
          gym_id: string
          updated_at?: string
        }
        Update: {
          check_pin_hash?: string
          gym_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_secrets_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          created_at: string
          crowd_override: Database["public"]["Enums"]["crowd_level"] | null
          crowd_updated_at: string
          id: string
          is_open_override: boolean | null
          join_code: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          crowd_override?: Database["public"]["Enums"]["crowd_level"] | null
          crowd_updated_at?: string
          id?: string
          is_open_override?: boolean | null
          join_code: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          crowd_override?: Database["public"]["Enums"]["crowd_level"] | null
          crowd_updated_at?: string
          id?: string
          is_open_override?: boolean | null
          join_code?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          end_date: string
          gym_id: string
          id: string
          plan_id: string | null
          profile_id: string
          start_date: string
          status: Database["public"]["Enums"]["membership_status"]
        }
        Insert: {
          created_at?: string
          end_date: string
          gym_id: string
          id?: string
          plan_id?: string | null
          profile_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
        }
        Update: {
          created_at?: string
          end_date?: string
          gym_id?: string
          id?: string
          plan_id?: string | null
          profile_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
        }
        Relationships: [
          {
            foreignKeyName: "memberships_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          gym_id: string
          id: string
          membership_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_at: string
          plan_id: string | null
          profile_id: string
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_paise: number
          created_at?: string
          gym_id: string
          id?: string
          membership_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          plan_id?: string | null
          profile_id: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_paise?: number
          created_at?: string
          gym_id?: string
          id?: string
          membership_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_at?: string
          plan_id?: string | null
          profile_id?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          benefits: string[]
          created_at: string
          duration_days: number
          gym_id: string
          id: string
          is_active: boolean
          name: string
          price_paise: number
        }
        Insert: {
          benefits?: string[]
          created_at?: string
          duration_days: number
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          price_paise: number
        }
        Update: {
          benefits?: string[]
          created_at?: string
          duration_days?: number
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          emergency_contact: string | null
          full_name: string | null
          gym_id: string
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          full_name?: string | null
          gym_id: string
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          full_name?: string | null
          gym_id?: string
          id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_codes: {
        Row: {
          code: string
          created_at: string
          gym_id: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          code: string
          created_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          code?: string
          created_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_codes_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_walk_in_member: {
        Args: {
          p_email: string
          p_full_name: string
          p_gym_id: string
          p_phone: string
        }
        Returns: string
      }
      check_assert_pin: {
        Args: { p_gym_slug: string; p_pin: string }
        Returns: string
      }
      check_dashboard: {
        Args: { p_gym_slug: string; p_pin: string }
        Returns: Json
      }
      check_pin_valid: {
        Args: { p_gym_slug: string; p_pin: string }
        Returns: boolean
      }
      check_publish_alert: {
        Args: {
          p_body: string
          p_gym_slug: string
          p_pin: string
          p_title: string
        }
        Returns: string
      }
      check_set_crowd: {
        Args: {
          p_gym_slug: string
          p_level: Database["public"]["Enums"]["crowd_level"]
          p_pin: string
        }
        Returns: Database["public"]["Enums"]["crowd_level"]
      }
      check_set_open: {
        Args: { p_gym_slug: string; p_open: boolean; p_pin: string }
        Returns: Json
      }
      complete_profile: {
        Args: {
          p_emergency_contact: string
          p_full_name: string
          p_phone: string
          p_staff_code: string
        }
        Returns: Json
      }
      is_gym_owner: { Args: { p_gym_id: string }; Returns: boolean }
      is_staff: { Args: { p_gym_id: string }; Returns: boolean }
      is_staff_anywhere: { Args: never; Returns: boolean }
      membership_is_current: {
        Args: { m: Database["public"]["Tables"]["memberships"]["Row"] }
        Returns: boolean
      }
      quietest_hour: {
        Args: { p_gym_id: string; p_weekday: number }
        Returns: Json
      }
      staff_code_valid: { Args: { p_code: string }; Returns: boolean }
    }
    Enums: {
      attendance_method: "manual" | "qr"
      crowd_level: "not_crowded" | "moderate" | "crowded" | "very_crowded"
      membership_status: "active" | "expired" | "cancelled"
      payment_method: "cash" | "upi" | "card" | "other"
      payment_status: "collected" | "pending" | "refunded"
      staff_role: "owner" | "staff"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attendance_method: ["manual", "qr"],
      crowd_level: ["not_crowded", "moderate", "crowded", "very_crowded"],
      membership_status: ["active", "expired", "cancelled"],
      payment_method: ["cash", "upi", "card", "other"],
      payment_status: ["collected", "pending", "refunded"],
      staff_role: ["owner", "staff"],
    },
  },
} as const
