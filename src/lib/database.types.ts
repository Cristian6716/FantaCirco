export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      auction_participants: {
        Row: {
          auction_id: number
          created_at: string
          joined_in_phase1: boolean
          manager_id: string
          withdrawn: boolean
          withdrawn_at: string | null
        }
        Insert: {
          auction_id: number
          created_at?: string
          joined_in_phase1?: boolean
          manager_id: string
          withdrawn?: boolean
          withdrawn_at?: string | null
        }
        Update: {
          auction_id?: number
          created_at?: string
          joined_in_phase1?: boolean
          manager_id?: string
          withdrawn?: boolean
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      auctions: {
        Row: {
          base_price: number
          created_at: string
          created_by: string
          current_bid: number
          ended_at: string | null
          id: number
          leader_id: string | null
          paused_at: string | null
          phase1_ends_at: string
          phase2_ends_at: string
          player_id: number
          started_at: string
          status: Database["public"]["Enums"]["auction_status"]
          winner_id: string | null
        }
        Insert: {
          base_price?: number
          created_at?: string
          created_by: string
          current_bid?: number
          ended_at?: string | null
          id?: never
          leader_id?: string | null
          paused_at?: string | null
          phase1_ends_at: string
          phase2_ends_at: string
          player_id: number
          started_at?: string
          status?: Database["public"]["Enums"]["auction_status"]
          winner_id?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string
          created_by?: string
          current_bid?: number
          ended_at?: string | null
          id?: never
          leader_id?: string | null
          paused_at?: string | null
          phase1_ends_at?: string
          phase2_ends_at?: string
          player_id?: number
          started_at?: string
          status?: Database["public"]["Enums"]["auction_status"]
          winner_id?: string | null
        }
        Relationships: []
      }
      autobids: {
        Row: {
          active: boolean
          auction_id: number
          created_at: string
          manager_id: string
          max_amount: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          auction_id: number
          created_at?: string
          manager_id: string
          max_amount: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          auction_id?: number
          created_at?: string
          manager_id?: string
          max_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      bids: {
        Row: {
          amount: number
          auction_id: number
          created_at: string
          id: number
          is_auto: boolean
          manager_id: string
        }
        Insert: {
          amount: number
          auction_id: number
          created_at?: string
          id?: never
          is_auto?: boolean
          manager_id: string
        }
        Update: {
          amount?: number
          auction_id?: number
          created_at?: string
          id?: never
          is_auto?: boolean
          manager_id?: string
        }
        Relationships: []
      }
      giornate: {
        Row: {
          created_at: string
          numero: number
          pronostici_chiusi: boolean
        }
        Insert: {
          created_at?: string
          numero: number
          pronostici_chiusi?: boolean
        }
        Update: {
          created_at?: string
          numero?: number
          pronostici_chiusi?: boolean
        }
        Relationships: []
      }
      managers: {
        Row: {
          created_at: string
          credits_total: number
          display_name: string
          id: string
          is_admin: boolean
          team_name: string | null
          username: string
        }
        Insert: {
          created_at?: string
          credits_total?: number
          display_name: string
          id: string
          is_admin?: boolean
          team_name?: string | null
          username: string
        }
        Update: {
          created_at?: string
          credits_total?: number
          display_name?: string
          id?: string
          is_admin?: boolean
          team_name?: string | null
          username?: string
        }
        Relationships: []
      }
      partite: {
        Row: {
          casa: string
          casa_manager: string | null
          data_ora: string | null
          giornata: number
          gol_casa: number | null
          gol_trasferta: number | null
          id: string
          ordine: number
          trasferta: string
          trasferta_manager: string | null
        }
        Insert: {
          casa: string
          casa_manager?: string | null
          data_ora?: string | null
          giornata: number
          gol_casa?: number | null
          gol_trasferta?: number | null
          id: string
          ordine?: number
          trasferta: string
          trasferta_manager?: string | null
        }
        Update: {
          casa?: string
          casa_manager?: string | null
          data_ora?: string | null
          giornata?: number
          gol_casa?: number | null
          gol_trasferta?: number | null
          id?: string
          ordine?: number
          trasferta?: string
          trasferta_manager?: string | null
        }
        Relationships: []
      }
      players: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: number
          name: string
          real_team: string | null
          roles: string[]
          status: Database["public"]["Enums"]["player_status"]
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: never
          name: string
          real_team?: string | null
          roles?: string[]
          status?: Database["public"]["Enums"]["player_status"]
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: never
          name?: string
          real_team?: string | null
          roles?: string[]
          status?: Database["public"]["Enums"]["player_status"]
        }
        Relationships: []
      }
      podio_rounds: {
        Row: {
          closed_at: string | null
          created_at: string
          id: number
          numero: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: never
          numero: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: never
          numero?: number
          status?: string
        }
        Relationships: []
      }
      podio_votes: {
        Row: {
          created_at: string
          manager_id: string
          pos1: string
          pos2: string
          pos3: string
          round_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          manager_id: string
          pos1: string
          pos2: string
          pos3: string
          round_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          manager_id?: string
          pos1?: string
          pos2?: string
          pos3?: string
          round_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      pronostici: {
        Row: {
          created_at: string
          giornata: number
          manager_id: string
          partita_id: string
          pronostico_1x2: string
          pronostico_ou: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          giornata: number
          manager_id: string
          partita_id: string
          pronostico_1x2: string
          pronostico_ou: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          giornata?: number
          manager_id?: string
          partita_id?: string
          pronostico_1x2?: string
          pronostico_ou?: string
          updated_at?: string
        }
        Relationships: []
      }
      punteggi_giornata: {
        Row: {
          giornata: number
          manager_id: string
          punteggio: number
        }
        Insert: {
          giornata: number
          manager_id: string
          punteggio: number
        }
        Update: {
          giornata?: number
          manager_id?: string
          punteggio?: number
        }
        Relationships: []
      }
      push_outbox: {
        Row: {
          body: string
          created_at: string
          error: string | null
          id: number
          manager_id: string
          sent: boolean
          sent_at: string | null
          tag: string | null
          title: string
          url: string
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          id?: never
          manager_id: string
          sent?: boolean
          sent_at?: string | null
          tag?: string | null
          title: string
          url?: string
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          id?: never
          manager_id?: string
          sent?: boolean
          sent_at?: string | null
          tag?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          manager_id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: never
          manager_id: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: never
          manager_id?: string
          p256dh?: string
        }
        Relationships: []
      }
      torneo_overrides: {
        Row: {
          match_id: string
          updated_at: string
          winner: string
        }
        Insert: {
          match_id: string
          updated_at?: string
          winner: string
        }
        Update: {
          match_id?: string
          updated_at?: string
          winner?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_manager_credits: {
        Row: {
          available: number | null
          credits_total: number | null
          display_name: string | null
          id: string | null
          is_admin: boolean | null
          locked: number | null
          team_name: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_cancel_auction: { Args: { p_auction: number }; Returns: undefined }
      admin_delete_all_auctions: { Args: never; Returns: undefined }
      admin_delete_auction: { Args: { p_auction: number }; Returns: undefined }
      admin_pause_auction: { Args: { p_auction: number }; Returns: undefined }
      admin_resume_auction: { Args: { p_auction: number }; Returns: undefined }
      available_credits: { Args: { p_manager: string }; Returns: number }
      claim_team: { Args: { p_team_name: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      list_login_profiles: {
        Args: never
        Returns: {
          display_name: string
          team_name: string
          username: string
        }[]
      }
      locked_credits: { Args: { p_manager: string }; Returns: number }
      place_bid: {
        Args: { p_amount: number; p_auction: number }
        Returns: undefined
      }
      set_autobid: {
        Args: { p_auction: number; p_max: number }
        Returns: undefined
      }
      start_auction: {
        Args: {
          p_base?: number
          p_phase1_minutes?: number
          p_phase2_minutes?: number
          p_player: number
        }
        Returns: number
      }
      tick: { Args: never; Returns: undefined }
      withdraw: { Args: { p_auction: number }; Returns: undefined }
    }
    Enums: {
      auction_status: "phase1" | "phase2" | "paused" | "ended" | "cancelled"
      player_status: "available" | "in_auction" | "assigned"
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

export const Constants = {
  public: {
    Enums: {
      auction_status: ["phase1", "phase2", "paused", "ended", "cancelled"],
      player_status: ["available", "in_auction", "assigned"],
    },
  },
} as const
