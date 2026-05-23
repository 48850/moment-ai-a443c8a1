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
  public: {
    Tables: {
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
          status: Database["public"]["Enums"]["follow_status"]
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
          status?: Database["public"]["Enums"]["follow_status"]
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
          status?: Database["public"]["Enums"]["follow_status"]
        }
        Relationships: []
      }
      moment_state: {
        Row: {
          created_at: string
          device_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id: string
          state: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          device_id: string | null
          display_name: string
          goal_tags: string[]
          handle: string | null
          id: string
          main_goal: string | null
          school_stage: string | null
          subject_tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          display_name?: string
          goal_tags?: string[]
          handle?: string | null
          id: string
          main_goal?: string | null
          school_stage?: string | null
          subject_tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          display_name?: string
          goal_tags?: string[]
          handle?: string | null
          id?: string
          main_goal?: string | null
          school_stage?: string | null
          subject_tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      progress_events: {
        Row: {
          context: string | null
          created_at: string
          goal_tags: string[]
          id: string
          kind: Database["public"]["Enums"]["event_kind"]
          source_key: string | null
          subject_tags: string[]
          title: string
          user_id: string
          visibility: Database["public"]["Enums"]["visibility_level"]
        }
        Insert: {
          context?: string | null
          created_at?: string
          goal_tags?: string[]
          id?: string
          kind: Database["public"]["Enums"]["event_kind"]
          source_key?: string | null
          subject_tags?: string[]
          title: string
          user_id: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Update: {
          context?: string | null
          created_at?: string
          goal_tags?: string[]
          id?: string
          kind?: Database["public"]["Enums"]["event_kind"]
          source_key?: string | null
          subject_tags?: string[]
          title?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["visibility_level"]
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "progress_events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_privacy: {
        Row: {
          aligned_discovery_opt_in: boolean
          comments_mode: Database["public"]["Enums"]["comments_mode"]
          profile_visibility: Database["public"]["Enums"]["visibility_level"]
          progress_visibility: Database["public"]["Enums"]["visibility_level"]
          updated_at: string
          user_id: string
        }
        Insert: {
          aligned_discovery_opt_in?: boolean
          comments_mode?: Database["public"]["Enums"]["comments_mode"]
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          progress_visibility?: Database["public"]["Enums"]["visibility_level"]
          updated_at?: string
          user_id: string
        }
        Update: {
          aligned_discovery_opt_in?: boolean
          comments_mode?: Database["public"]["Enums"]["comments_mode"]
          profile_visibility?: Database["public"]["Enums"]["visibility_level"]
          progress_visibility?: Database["public"]["Enums"]["visibility_level"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_accepted_follower: {
        Args: { _author: string; _viewer: string }
        Returns: boolean
      }
      is_mutual: { Args: { _a: string; _b: string }; Returns: boolean }
      shares_goal_tag: {
        Args: { _author: string; _viewer: string }
        Returns: boolean
      }
      viewer_aligned_opt_in: { Args: { _viewer: string }; Returns: boolean }
    }
    Enums: {
      comments_mode: "off" | "friends" | "mutuals"
      event_kind:
        | "task_completed"
        | "review_saved"
        | "lesson_learned"
        | "plan_repaired"
        | "streak_milestone"
        | "weekly_recap"
        | "community_joined"
      follow_status: "pending" | "accepted"
      visibility_level: "private" | "friends" | "aligned" | "public"
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
      comments_mode: ["off", "friends", "mutuals"],
      event_kind: [
        "task_completed",
        "review_saved",
        "lesson_learned",
        "plan_repaired",
        "streak_milestone",
        "weekly_recap",
        "community_joined",
      ],
      follow_status: ["pending", "accepted"],
      visibility_level: ["private", "friends", "aligned", "public"],
    },
  },
} as const
