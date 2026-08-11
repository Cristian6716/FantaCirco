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
      albo_oro: {
        Row: {
          competizione: string
          created_at: string
          id: number
          note: string | null
          squadra: string
          stagione: string
        }
        Insert: {
          competizione: string
          created_at?: string
          id?: number
          note?: string | null
          squadra: string
          stagione: string
        }
        Update: {
          competizione?: string
          created_at?: string
          id?: number
          note?: string | null
          squadra?: string
          stagione?: string
        }
        Relationships: []
      }
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
        Relationships: [
          {
            foreignKeyName: "auction_participants_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_participants_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_participants_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "auctions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "autobids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autobids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autobids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          adjustments: Json
          ai_summary: string | null
          created_at: string
          data_snapshot: Json
          id: string
          period_end: string | null
          period_start: string | null
          user_id: string
        }
        Insert: {
          adjustments?: Json
          ai_summary?: string | null
          created_at?: string
          data_snapshot?: Json
          id?: string
          period_end?: string | null
          period_start?: string | null
          user_id: string
        }
        Update: {
          adjustments?: Json
          ai_summary?: string | null
          created_at?: string
          data_snapshot?: Json
          id?: string
          period_end?: string | null
          period_start?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["message_role"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["message_role"]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["message_role"]
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: string | null
          created_at: string
          equipment: string | null
          external_id: string | null
          id: string
          images: string[]
          instructions: string | null
          level: string | null
          muscle_group: string | null
          name: string
          primary_muscles: string[]
          secondary_muscles: string[]
        }
        Insert: {
          category?: string | null
          created_at?: string
          equipment?: string | null
          external_id?: string | null
          id?: string
          images?: string[]
          instructions?: string | null
          level?: string | null
          muscle_group?: string | null
          name: string
          primary_muscles?: string[]
          secondary_muscles?: string[]
        }
        Update: {
          category?: string | null
          created_at?: string
          equipment?: string | null
          external_id?: string | null
          id?: string
          images?: string[]
          instructions?: string | null
          level?: string | null
          muscle_group?: string | null
          name?: string
          primary_muscles?: string[]
          secondary_muscles?: string[]
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
      habit_logs: {
        Row: {
          created_at: string
          date: string
          done: boolean
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          done?: boolean
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          done?: boolean
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          consolidated_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          rationale: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["habit_status"]
          target_frequency: string | null
          user_id: string
        }
        Insert: {
          consolidated_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rationale?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["habit_status"]
          target_frequency?: string | null
          user_id: string
        }
        Update: {
          consolidated_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rationale?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["habit_status"]
          target_frequency?: string | null
          user_id?: string
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
      notification_preferences: {
        Row: {
          manager_id: string
          notify_outbid_phase1: boolean
          notify_outbid_phase2: boolean
          notify_phase2_start: boolean
          updated_at: string
        }
        Insert: {
          manager_id: string
          notify_outbid_phase1?: boolean
          notify_outbid_phase2?: boolean
          notify_phase2_start?: boolean
          updated_at?: string
        }
        Update: {
          manager_id?: string
          notify_outbid_phase1?: boolean
          notify_outbid_phase2?: boolean
          notify_phase2_start?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: true
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: true
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "partite_casa_manager_fkey"
            columns: ["casa_manager"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partite_casa_manager_fkey"
            columns: ["casa_manager"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partite_giornata_fkey"
            columns: ["giornata"]
            isOneToOne: false
            referencedRelation: "giornate"
            referencedColumns: ["numero"]
          },
          {
            foreignKeyName: "partite_trasferta_manager_fkey"
            columns: ["trasferta_manager"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partite_trasferta_manager_fkey"
            columns: ["trasferta_manager"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          assigned_to: string | null
          created_at: string
          fantacalcio_id: number | null
          id: number
          name: string
          owner_team: string | null
          price: number | null
          quotazione: number | null
          quotazione_mantra: number | null
          real_team: string | null
          roles: string[]
          ruolo: string | null
          status: Database["public"]["Enums"]["player_status"]
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          fantacalcio_id?: number | null
          id?: never
          name: string
          owner_team?: string | null
          price?: number | null
          quotazione?: number | null
          quotazione_mantra?: number | null
          real_team?: string | null
          roles?: string[]
          ruolo?: string | null
          status?: Database["public"]["Enums"]["player_status"]
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          fantacalcio_id?: number | null
          id?: never
          name?: string
          owner_team?: string | null
          price?: number | null
          quotazione?: number | null
          quotazione_mantra?: number | null
          real_team?: string | null
          roles?: string[]
          ruolo?: string | null
          status?: Database["public"]["Enums"]["player_status"]
        }
        Relationships: [
          {
            foreignKeyName: "players_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
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
          id?: number
          numero: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: number
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
        Relationships: [
          {
            foreignKeyName: "podio_votes_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podio_votes_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podio_votes_pos1_fkey"
            columns: ["pos1"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podio_votes_pos1_fkey"
            columns: ["pos1"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podio_votes_pos2_fkey"
            columns: ["pos2"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podio_votes_pos2_fkey"
            columns: ["pos2"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podio_votes_pos3_fkey"
            columns: ["pos3"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podio_votes_pos3_fkey"
            columns: ["pos3"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podio_votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "podio_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          timezone: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          timezone?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          timezone?: string
        }
        Relationships: []
      }
      progress_entries: {
        Row: {
          created_at: string
          date: string
          energy: number | null
          id: string
          measurements: Json
          mood: number | null
          photo_path: string | null
          sleep: number | null
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          measurements?: Json
          mood?: number | null
          photo_path?: string | null
          sleep?: number | null
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          measurements?: Json
          mood?: number | null
          photo_path?: string | null
          sleep?: number | null
          user_id?: string
          weight?: number | null
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
        Relationships: [
          {
            foreignKeyName: "pronostici_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pronostici_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pronostici_partita_id_fkey"
            columns: ["partita_id"]
            isOneToOne: false
            referencedRelation: "partite"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "punteggi_giornata_giornata_fkey"
            columns: ["giornata"]
            isOneToOne: false
            referencedRelation: "giornate"
            referencedColumns: ["numero"]
          },
          {
            foreignKeyName: "punteggi_giornata_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punteggi_giornata_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "push_outbox_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_outbox_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_generale: {
        Row: {
          campionato_pos: number
          campionato_pts: number
          manager_id: string | null
          manager_name: string | null
          pos: number
          royale_pos: number
          royale_pts: number
          team_name: string
          torneo_campione: boolean
          torneo_detail: string
          torneo_pts: number
          totale: number
        }
        Insert: {
          campionato_pos: number
          campionato_pts: number
          manager_id?: string | null
          manager_name?: string | null
          pos: number
          royale_pos: number
          royale_pts: number
          team_name: string
          torneo_campione?: boolean
          torneo_detail: string
          torneo_pts: number
          totale: number
        }
        Update: {
          campionato_pos?: number
          campionato_pts?: number
          manager_id?: string | null
          manager_name?: string | null
          pos?: number
          royale_pos?: number
          royale_pts?: number
          team_name?: string
          torneo_campione?: boolean
          torneo_detail?: string
          torneo_pts?: number
          totale?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranking_generale_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_generale_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      scambi: {
        Row: {
          created_by: string | null
          crediti_a: number
          crediti_b: number
          data: string
          id: number
          manager_a: string | null
          manager_b: string | null
          note: string | null
          squadra_a: string
          squadra_b: string
        }
        Insert: {
          created_by?: string | null
          crediti_a?: number
          crediti_b?: number
          data?: string
          id?: never
          manager_a?: string | null
          manager_b?: string | null
          note?: string | null
          squadra_a: string
          squadra_b: string
        }
        Update: {
          created_by?: string | null
          crediti_a?: number
          crediti_b?: number
          data?: string
          id?: never
          manager_a?: string | null
          manager_b?: string | null
          note?: string | null
          squadra_a?: string
          squadra_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "scambi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scambi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scambi_manager_a_fkey"
            columns: ["manager_a"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scambi_manager_a_fkey"
            columns: ["manager_a"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scambi_manager_b_fkey"
            columns: ["manager_b"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scambi_manager_b_fkey"
            columns: ["manager_b"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      scambio_giocatori: {
        Row: {
          a: string
          da: string
          giocatore: string
          id: number
          player_id: number | null
          scambio_id: number
        }
        Insert: {
          a: string
          da: string
          giocatore: string
          id?: never
          player_id?: number | null
          scambio_id: number
        }
        Update: {
          a?: string
          da?: string
          giocatore?: string
          id?: never
          player_id?: number | null
          scambio_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "scambio_giocatori_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scambio_giocatori_scambio_id_fkey"
            columns: ["scambio_id"]
            isOneToOne: false
            referencedRelation: "scambi"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          created_at: string
          exercise_id: string | null
          id: string
          reps: number | null
          rpe: number | null
          session_id: string
          set_index: number
          weight: number | null
        }
        Insert: {
          created_at?: string
          exercise_id?: string | null
          id?: string
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_index: number
          weight?: number | null
        }
        Update: {
          created_at?: string
          exercise_id?: string | null
          id?: string
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_index?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      statistiche_mercato: {
        Row: {
          created_at: string
          created_by: string | null
          data: string | null
          id: number
          testo: string
          titolo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: string | null
          id?: number
          testo: string
          titolo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string | null
          id?: number
          testo?: string
          titolo?: string
        }
        Relationships: [
          {
            foreignKeyName: "statistiche_mercato_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statistiche_mercato_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_manager_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      storico_partite: {
        Row: {
          casa: string
          created_at: string
          giornata: number
          gol_casa: number
          gol_trasferta: number
          id: number
          punti_casa: number | null
          punti_trasferta: number | null
          stagione: string
          trasferta: string
        }
        Insert: {
          casa: string
          created_at?: string
          giornata: number
          gol_casa: number
          gol_trasferta: number
          id?: number
          punti_casa?: number | null
          punti_trasferta?: number | null
          stagione: string
          trasferta: string
        }
        Update: {
          casa?: string
          created_at?: string
          giornata?: number
          gol_casa?: number
          gol_trasferta?: number
          id?: number
          punti_casa?: number | null
          punti_trasferta?: number | null
          stagione?: string
          trasferta?: string
        }
        Relationships: []
      }
      torneo_overrides: {
        Row: {
          gol_a: number | null
          gol_b: number | null
          match_id: string
          updated_at: string
          winner: string
        }
        Insert: {
          gol_a?: number | null
          gol_b?: number | null
          match_id: string
          updated_at?: string
          winner: string
        }
        Update: {
          gol_a?: number | null
          gol_b?: number | null
          match_id?: string
          updated_at?: string
          winner?: string
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          active_habit_id: string | null
          adherence_summary: Json
          coach_notes: string | null
          created_at: string
          current_training_state: Json
          days_per_week: number | null
          equipment: Json
          experience_level:
            | Database["public"]["Enums"]["experience_level"]
            | null
          goal: Database["public"]["Enums"]["goal_type"] | null
          injuries: string | null
          learned_preferences: Json
          location: Database["public"]["Enums"]["training_location"] | null
          motivation_why: string | null
          nutrition_baseline: string | null
          onboarding_completed: boolean
          past_barriers: string | null
          session_minutes: number | null
          summary: string | null
          updated_at: string
          user_id: string
          whats_not: string | null
          whats_working: string | null
        }
        Insert: {
          active_habit_id?: string | null
          adherence_summary?: Json
          coach_notes?: string | null
          created_at?: string
          current_training_state?: Json
          days_per_week?: number | null
          equipment?: Json
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          goal?: Database["public"]["Enums"]["goal_type"] | null
          injuries?: string | null
          learned_preferences?: Json
          location?: Database["public"]["Enums"]["training_location"] | null
          motivation_why?: string | null
          nutrition_baseline?: string | null
          onboarding_completed?: boolean
          past_barriers?: string | null
          session_minutes?: number | null
          summary?: string | null
          updated_at?: string
          user_id: string
          whats_not?: string | null
          whats_working?: string | null
        }
        Update: {
          active_habit_id?: string | null
          adherence_summary?: Json
          coach_notes?: string | null
          created_at?: string
          current_training_state?: Json
          days_per_week?: number | null
          equipment?: Json
          experience_level?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          goal?: Database["public"]["Enums"]["goal_type"] | null
          injuries?: string | null
          learned_preferences?: Json
          location?: Database["public"]["Enums"]["training_location"] | null
          motivation_why?: string | null
          nutrition_baseline?: string | null
          onboarding_completed?: boolean
          past_barriers?: string | null
          session_minutes?: number | null
          summary?: string | null
          updated_at?: string
          user_id?: string
          whats_not?: string | null
          whats_working?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_active_habit_fk"
            columns: ["active_habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          goal: Database["public"]["Enums"]["goal_type"] | null
          id: string
          is_active: boolean
          payload: Json
          rationale: string | null
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          goal?: Database["public"]["Enums"]["goal_type"] | null
          id?: string
          is_active?: boolean
          payload: Json
          rationale?: string | null
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          goal?: Database["public"]["Enums"]["goal_type"] | null
          id?: string
          is_active?: boolean
          payload?: Json
          rationale?: string | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          created_at: string
          date: string
          day_label: string | null
          id: string
          notes: string | null
          plan_id: string | null
          rpe_session: number | null
          status: Database["public"]["Enums"]["session_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          day_label?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          rpe_session?: number | null
          status?: Database["public"]["Enums"]["session_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          day_label?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          rpe_session?: number | null
          status?: Database["public"]["Enums"]["session_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
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
          roster_free: number | null
          roster_max: number | null
          roster_used: number | null
          team_name: string | null
          username: string | null
        }
        Insert: {
          available?: never
          credits_total?: number | null
          display_name?: string | null
          id?: string | null
          is_admin?: boolean | null
          locked?: never
          roster_free?: never
          roster_max?: never
          roster_used?: never
          team_name?: string | null
          username?: string | null
        }
        Update: {
          available?: never
          credits_total?: number | null
          display_name?: string | null
          id?: string | null
          is_admin?: boolean | null
          locked?: never
          roster_free?: never
          roster_max?: never
          roster_used?: never
          team_name?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _advance_auction: { Args: { p_auction: number }; Returns: undefined }
      _end_auction: { Args: { p_auction: number }; Returns: undefined }
      _expire_autobids: {
        Args: { p_auction: number; p_notify?: boolean }
        Returns: string[]
      }
      _maybe_end_no_challengers: {
        Args: { p_auction: number }
        Returns: undefined
      }
      _notify: {
        Args: {
          p_body: string
          p_manager: string
          p_tag?: string
          p_title: string
          p_url?: string
        }
        Returns: undefined
      }
      _notify_checked: {
        Args: {
          p_body: string
          p_kind: string
          p_manager: string
          p_tag?: string
          p_title: string
          p_url?: string
        }
        Returns: undefined
      }
      _resolve_autobids: { Args: { p_auction: number }; Returns: undefined }
      _revert_auction_effects: {
        Args: { p_auction: number }
        Returns: undefined
      }
      admin_cancel_auction: { Args: { p_auction: number }; Returns: undefined }
      admin_delete_all_auctions: { Args: never; Returns: undefined }
      admin_delete_auction: { Args: { p_auction: number }; Returns: undefined }
      admin_pause_auction: { Args: { p_auction: number }; Returns: undefined }
      admin_resume_auction: { Args: { p_auction: number }; Returns: undefined }
      available_credits: { Args: { p_manager: string }; Returns: number }
      cancel_autobid: { Args: { p_auction: number }; Returns: undefined }
      claim_team: { Args: { p_team_name: string }; Returns: undefined }
      committed_credits: {
        Args: { p_exclude?: number; p_manager: string }
        Returns: number
      }
      esegui_scambio: {
        Args: {
          p_crediti_a?: number
          p_crediti_b?: number
          p_manager_a: string
          p_manager_b: string
          p_note?: string
          p_players_a?: number[]
          p_players_b?: number[]
        }
        Returns: number
      }
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
      max_roster: { Args: never; Returns: number }
      place_bid: {
        Args: { p_amount: number; p_auction: number }
        Returns: undefined
      }
      podio_classifica: {
        Args: { p_round: number }
        Returns: {
          c1: number
          c2: number
          c3: number
          manager_id: string
          nome: string
          punti: number
        }[]
      }
      release_player: { Args: { p_player: number }; Returns: undefined }
      roster_committed: {
        Args: { p_exclude?: number; p_manager: string }
        Returns: number
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
      experience_level:
        | "principiante_assoluto"
        | "principiante"
        | "intermedio_basso"
        | "intermedio"
        | "avanzato"
      goal_type:
        | "dimagrire"
        | "ingrassare"
        | "mantenere"
        | "rimodellare"
        | "forza"
      habit_status: "proposed" | "active" | "consolidated" | "dropped"
      message_role: "user" | "assistant"
      player_status: "available" | "in_auction" | "assigned"
      session_status: "planned" | "done" | "skipped"
      training_location: "gym" | "home" | "both"
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
      auction_status: ["phase1", "phase2", "paused", "ended", "cancelled"],
      experience_level: [
        "principiante_assoluto",
        "principiante",
        "intermedio_basso",
        "intermedio",
        "avanzato",
      ],
      goal_type: [
        "dimagrire",
        "ingrassare",
        "mantenere",
        "rimodellare",
        "forza",
      ],
      habit_status: ["proposed", "active", "consolidated", "dropped"],
      message_role: ["user", "assistant"],
      player_status: ["available", "in_auction", "assigned"],
      session_status: ["planned", "done", "skipped"],
      training_location: ["gym", "home", "both"],
    },
  },
} as const
