export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          person_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          person_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog: {
        Row: {
          action: Database["public"]["Enums"]["changelog_action"]
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          row_id: string
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["changelog_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: number
          row_id: string
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["changelog_action"]
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: number
          row_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_requests: {
        Row: { id: string; reporter_user_id: string; person_id: string | null; kind: Database["public"]["Enums"]["correction_kind"]; details: string; status: Database["public"]["Enums"]["correction_status"]; resolved_by: string | null; created_at: string; resolved_at: string | null }
        Insert: { id?: string; reporter_user_id?: string; person_id?: string | null; kind: Database["public"]["Enums"]["correction_kind"]; details: string; status?: Database["public"]["Enums"]["correction_status"]; resolved_by?: string | null; created_at?: string; resolved_at?: string | null }
        Update: { id?: string; reporter_user_id?: string; person_id?: string | null; kind?: Database["public"]["Enums"]["correction_kind"]; details?: string; status?: Database["public"]["Enums"]["correction_status"]; resolved_by?: string | null; created_at?: string; resolved_at?: string | null }
        Relationships: []
      }
      links: {
        Row: {
          academic_year: string | null
          big_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          little_id: string
          proposed_by: string | null
          status: Database["public"]["Enums"]["link_status"]
        }
        Insert: {
          academic_year?: string | null
          big_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          little_id: string
          proposed_by?: string | null
          status?: Database["public"]["Enums"]["link_status"]
        }
        Update: {
          academic_year?: string | null
          big_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          little_id?: string
          proposed_by?: string | null
          status?: Database["public"]["Enums"]["link_status"]
        }
        Relationships: [
          {
            foreignKeyName: "links_big_id_fkey"
            columns: ["big_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_little_id_fkey"
            columns: ["little_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      lins: {
        Row: {
          color: string
          created_at: string
          founder_id: string
          id: string
          name: string
        }
        Insert: {
          color: string
          created_at?: string
          founder_id: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          founder_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lins_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          auth_user_id: string | null
          bio: string | null
          claimed_at: string | null
          created_at: string
          display_name: string
          preferred_name: string | null
          pronouns: string | null
          school: string | null
          current_city: string | null
          interests: string | null
          csa_role: string | null
          grad_year: number
          hidden: boolean
          hometown: string | null
          id: string
          instagram: string | null
          linkedin: string | null
          major: string | null
          merged_into: string | null
          penn_email: string | null
          personal_auth_user_id: string | null
          personal_email: string | null
          photo_path: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          bio?: string | null
          claimed_at?: string | null
          created_at?: string
          display_name: string
          preferred_name?: string | null
          pronouns?: string | null
          school?: string | null
          current_city?: string | null
          interests?: string | null
          csa_role?: string | null
          grad_year: number
          hidden?: boolean
          hometown?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          major?: string | null
          merged_into?: string | null
          penn_email?: string | null
          personal_auth_user_id?: string | null
          personal_email?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          bio?: string | null
          claimed_at?: string | null
          created_at?: string
          display_name?: string
          preferred_name?: string | null
          pronouns?: string | null
          school?: string | null
          current_city?: string | null
          interests?: string | null
          csa_role?: string | null
          grad_year?: number
          hidden?: boolean
          hometown?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          major?: string | null
          merged_into?: string | null
          penn_email?: string | null
          personal_auth_user_id?: string | null
          personal_email?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      people_with_contact: {
        Row: {
          auth_user_id: string | null
          bio: string | null
          claimed_at: string | null
          created_at: string | null
          display_name: string | null
          preferred_name: string | null
          pronouns: string | null
          school: string | null
          current_city: string | null
          interests: string | null
          csa_role: string | null
          grad_year: number | null
          hidden: boolean | null
          hometown: string | null
          id: string | null
          instagram: string | null
          linkedin: string | null
          major: string | null
          merged_into: string | null
          penn_email: string | null
          personal_auth_user_id: string | null
          personal_email: string | null
          photo_path: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ancestors_of: { Args: { p: string }; Returns: string[] }
      current_person_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      descendants_of: { Args: { p: string }; Returns: string[] }
      is_admin: { Args: never; Returns: boolean }
      is_avatar_path: { Args: { object_name: string }; Returns: boolean }
      is_penn_email: { Args: { email: string }; Returns: boolean }
      lin_graph: { Args: { lin: string }; Returns: Json }
      lin_members: {
        Args: { lin: string }
        Returns: {
          is_founder: boolean
          person_id: string
        }[]
      }
      lins_of: { Args: { p: string }; Returns: string[] }
      photo_owner: { Args: { object_name: string }; Returns: string }
      merge_people: {
        Args: { duplicate: string; survivor: string; survivor_photo_path?: string }
        Returns: undefined
      }
    }
    Enums: {
      changelog_action: "insert" | "update" | "delete"
      correction_kind: "profile" | "relationship" | "missing_person"
      correction_status: "pending" | "resolved" | "dismissed"
      link_status: "pending" | "confirmed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      changelog_action: ["insert", "update", "delete"],
      correction_kind: ["profile", "relationship", "missing_person"],
      correction_status: ["pending", "resolved", "dismissed"],
      link_status: ["pending", "confirmed"],
    },
  },
} as const
