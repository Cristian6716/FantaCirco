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
      players: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: number
          name: string
          real_team: string | null
          role: Database["public"]["Enums"]["player_role"] | null
          status: Database["public"]["Enums"]["player_status"]
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: never
          name: string
          real_team?: string | null
          role?: Database["public"]["Enums"]["player_role"] | null
          status?: Database["public"]["Enums"]["player_status"]
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: never
          name?: string
          real_team?: string | null
          role?: Database["public"]["Enums"]["player_role"] | null
          status?: Database["public"]["Enums"]["player_status"]
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
      admin_delete_all_auctions: { Args: Record<string, never>; Returns: undefined }
      admin_delete_auction: { Args: { p_auction: number }; Returns: undefined }
      admin_pause_auction: { Args: { p_auction: number }; Returns: undefined }
      admin_resume_auction: { Args: { p_auction: number }; Returns: undefined }
      available_credits: { Args: { p_manager: string }; Returns: number }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      locked_credits: { Args: { p_manager: string }; Returns: number }
      place_bid: { Args: { p_amount: number; p_auction: number }; Returns: undefined }
      set_autobid: { Args: { p_auction: number; p_max: number }; Returns: undefined }
      start_auction: {
        Args: {
          p_base?: number
          p_phase1_minutes?: number
          p_phase2_minutes?: number
          p_player: number
        }
        Returns: number
      }
      withdraw: { Args: { p_auction: number }; Returns: undefined }
    }
    Enums: {
      auction_status: "phase1" | "phase2" | "paused" | "ended" | "cancelled"
      player_role: "P" | "D" | "C" | "A"
      player_status: "available" | "in_auction" | "assigned"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
type TablesAndViews = PublicSchema["Tables"] & PublicSchema["Views"]

export type Tables<T extends keyof TablesAndViews> = TablesAndViews[T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
