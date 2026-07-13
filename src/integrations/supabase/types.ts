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
      account_bans: {
        Row: {
          banned_by: string
          banned_until: string | null
          created_at: string
          id: string
          is_active: boolean
          is_permanent: boolean
          reason: string
          unban_reason: string | null
          unbanned_at: string | null
          updated_at: string
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          banned_by?: string
          banned_until?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          reason?: string
          unban_reason?: string | null
          unbanned_at?: string | null
          updated_at?: string
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          banned_by?: string
          banned_until?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          reason?: string
          unban_reason?: string | null
          unbanned_at?: string | null
          updated_at?: string
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      admin_posts: {
        Row: {
          content: string | null
          created_at: string
          facebook: string | null
          id: string
          image_url: string | null
          instagram: string | null
          is_active: boolean
          link_url: string | null
          tiktok: string | null
          title: string
          twitter: string | null
          updated_at: string
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          facebook?: string | null
          id?: string
          image_url?: string | null
          instagram?: string | null
          is_active?: boolean
          link_url?: string | null
          tiktok?: string | null
          title: string
          twitter?: string | null
          updated_at?: string
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          facebook?: string | null
          id?: string
          image_url?: string | null
          instagram?: string | null
          is_active?: boolean
          link_url?: string | null
          tiktok?: string | null
          title?: string
          twitter?: string | null
          updated_at?: string
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      anon_chat_account_devices: {
        Row: {
          account_id: string
          id: string
          last_login_at: string
          visitor_id: string
        }
        Insert: {
          account_id: string
          id?: string
          last_login_at?: string
          visitor_id: string
        }
        Update: {
          account_id?: string
          id?: string
          last_login_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anon_chat_account_devices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "anon_chat_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      anon_chat_accounts: {
        Row: {
          bio: string | null
          created_at: string
          email: string
          id: string
          password_hash: string
          primary_visitor_id: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email: string
          id?: string
          password_hash: string
          primary_visitor_id?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string
          id?: string
          password_hash?: string
          primary_visitor_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      anon_chat_blocked_matches: {
        Row: {
          blocked_visitor: string
          created_at: string
          id: string
          visitor_id: string
        }
        Insert: {
          blocked_visitor: string
          created_at?: string
          id?: string
          visitor_id: string
        }
        Update: {
          blocked_visitor?: string
          created_at?: string
          id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      anon_chat_call_logs: {
        Row: {
          answered_at: string | null
          created_at: string
          direction: string
          duration_seconds: number
          ended_at: string | null
          id: string
          partner_nickname: string | null
          partner_visitor: string
          session_id: string | null
          started_at: string
          status: string
          visitor_id: string
        }
        Insert: {
          answered_at?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          partner_nickname?: string | null
          partner_visitor: string
          session_id?: string | null
          started_at?: string
          status?: string
          visitor_id: string
        }
        Update: {
          answered_at?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          partner_nickname?: string | null
          partner_visitor?: string
          session_id?: string | null
          started_at?: string
          status?: string
          visitor_id?: string
        }
        Relationships: []
      }
      anon_chat_friend_requests: {
        Row: {
          created_at: string
          from_nickname: string
          from_visitor: string
          id: string
          responded_at: string | null
          session_id: string | null
          status: string
          to_nickname: string | null
          to_visitor: string
        }
        Insert: {
          created_at?: string
          from_nickname: string
          from_visitor: string
          id?: string
          responded_at?: string | null
          session_id?: string | null
          status?: string
          to_nickname?: string | null
          to_visitor: string
        }
        Update: {
          created_at?: string
          from_nickname?: string
          from_visitor?: string
          id?: string
          responded_at?: string | null
          session_id?: string | null
          status?: string
          to_nickname?: string | null
          to_visitor?: string
        }
        Relationships: [
          {
            foreignKeyName: "anon_chat_friend_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anon_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      anon_chat_friends: {
        Row: {
          created_at: string
          friend_nickname: string
          friend_visitor: string
          id: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          friend_nickname: string
          friend_visitor: string
          id?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          friend_nickname?: string
          friend_visitor?: string
          id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      anon_chat_match_history: {
        Row: {
          created_at: string
          id: string
          last_session_at: string
          partner_nickname: string | null
          partner_visitor: string
          session_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_session_at?: string
          partner_nickname?: string | null
          partner_visitor: string
          session_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_session_at?: string
          partner_nickname?: string | null
          partner_visitor?: string
          session_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      anon_chat_messages: {
        Row: {
          audio_duration: number | null
          caption: string | null
          content: string | null
          created_at: string
          deleted_at: string | null
          deleted_for: string[]
          delivered_at: string | null
          id: string
          image_url: string | null
          is_deleted: boolean
          is_read: boolean
          media_name: string | null
          media_size: number | null
          media_type: string | null
          media_url: string | null
          read_at: string | null
          reply_to_id: string | null
          sender_visitor_id: string
          session_id: string
          view_once: boolean
          viewed_at: string | null
        }
        Insert: {
          audio_duration?: number | null
          caption?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          delivered_at?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_read?: boolean
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_visitor_id: string
          session_id: string
          view_once?: boolean
          viewed_at?: string | null
        }
        Update: {
          audio_duration?: number | null
          caption?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          delivered_at?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_read?: boolean
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_visitor_id?: string
          session_id?: string
          view_once?: boolean
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anon_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "anon_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      anon_chat_profiles: {
        Row: {
          avatar_preset: string
          avatar_url: string | null
          bio: string | null
          last_seen_at: string
          nickname: string | null
          show_last_seen: boolean
          updated_at: string
          visitor_id: string
          who_can_call: string
        }
        Insert: {
          avatar_preset?: string
          avatar_url?: string | null
          bio?: string | null
          last_seen_at?: string
          nickname?: string | null
          show_last_seen?: boolean
          updated_at?: string
          visitor_id: string
          who_can_call?: string
        }
        Update: {
          avatar_preset?: string
          avatar_url?: string | null
          bio?: string | null
          last_seen_at?: string
          nickname?: string | null
          show_last_seen?: boolean
          updated_at?: string
          visitor_id?: string
          who_can_call?: string
        }
        Relationships: []
      }
      anon_chat_queue: {
        Row: {
          created_at: string
          id: string
          interest: string | null
          my_gender: string | null
          nickname: string | null
          pref_gender: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest?: string | null
          my_gender?: string | null
          nickname?: string | null
          pref_gender?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interest?: string | null
          my_gender?: string | null
          nickname?: string | null
          pref_gender?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      anon_chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anon_chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "anon_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      anon_chat_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          ended_by: string | null
          gender_a: string | null
          gender_b: string | null
          id: string
          interest: string | null
          nickname_a: string | null
          nickname_b: string | null
          status: string
          visitor_a: string
          visitor_b: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          gender_a?: string | null
          gender_b?: string | null
          id?: string
          interest?: string | null
          nickname_a?: string | null
          nickname_b?: string | null
          status?: string
          visitor_a: string
          visitor_b: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          gender_a?: string | null
          gender_b?: string | null
          id?: string
          interest?: string | null
          nickname_a?: string | null
          nickname_b?: string | null
          status?: string
          visitor_a?: string
          visitor_b?: string
        }
        Relationships: []
      }
      anon_chat_typing: {
        Row: {
          is_typing: boolean
          sender_visitor_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          is_typing?: boolean
          sender_visitor_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          is_typing?: boolean
          sender_visitor_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          key_name: string
          last_used_at: string | null
          permissions: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          key_name?: string
          last_used_at?: string | null
          permissions?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          key_name?: string
          last_used_at?: string | null
          permissions?: string
        }
        Relationships: []
      }
      artists: {
        Row: {
          bio: string | null
          created_at: string
          genre: string | null
          id: string
          name: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          name: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      auto_flash_sale_purchases: {
        Row: {
          cost_paid: number | null
          created_at: string
          id: string
          payment_method: string | null
          reward_type: string | null
          reward_value: number | null
          sale_id: string
          visitor_id: string
        }
        Insert: {
          cost_paid?: number | null
          created_at?: string
          id?: string
          payment_method?: string | null
          reward_type?: string | null
          reward_value?: number | null
          sale_id: string
          visitor_id: string
        }
        Update: {
          cost_paid?: number | null
          created_at?: string
          id?: string
          payment_method?: string | null
          reward_type?: string | null
          reward_value?: number | null
          sale_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_flash_sale_purchases_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "auto_flash_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_flash_sales: {
        Row: {
          content_type: string
          cost_coins: number | null
          cost_gems: number | null
          created_at: string
          description: string | null
          discount_percent: number
          ends_at: string
          flash_price: number | null
          icon: string | null
          id: string
          is_active: boolean
          original_price: number | null
          reward_type: string | null
          reward_value: number | null
          sale_date: string
          session_slot: string
          sold_count: number
          starts_at: string
          target_id: string | null
          target_kind: string | null
          title: string
          total_stock: number
        }
        Insert: {
          content_type: string
          cost_coins?: number | null
          cost_gems?: number | null
          created_at?: string
          description?: string | null
          discount_percent?: number
          ends_at: string
          flash_price?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          original_price?: number | null
          reward_type?: string | null
          reward_value?: number | null
          sale_date: string
          session_slot: string
          sold_count?: number
          starts_at: string
          target_id?: string | null
          target_kind?: string | null
          title: string
          total_stock?: number
        }
        Update: {
          content_type?: string
          cost_coins?: number | null
          cost_gems?: number | null
          created_at?: string
          description?: string | null
          discount_percent?: number
          ends_at?: string
          flash_price?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          original_price?: number | null
          reward_type?: string | null
          reward_value?: number | null
          sale_date?: string
          session_slot?: string
          sold_count?: number
          starts_at?: string
          target_id?: string | null
          target_kind?: string | null
          title?: string
          total_stock?: number
        }
        Relationships: []
      }
      balance_login_history: {
        Row: {
          browser: string | null
          device_info: string | null
          id: string
          ip_address: string | null
          logged_in_at: string
          user_balance_id: string
          visitor_id: string
        }
        Insert: {
          browser?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_balance_id: string
          visitor_id: string
        }
        Update: {
          browser?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_balance_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_login_history_user_balance_id_fkey"
            columns: ["user_balance_id"]
            isOneToOne: false
            referencedRelation: "user_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_login_history_user_balance_id_fkey"
            columns: ["user_balance_id"]
            isOneToOne: false
            referencedRelation: "user_balances_public"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_name_changes: {
        Row: {
          changed_at: string
          id: string
          new_username: string
          old_username: string | null
          visitor_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_username: string
          old_username?: string | null
          visitor_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_username?: string
          old_username?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      balance_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          token_id: string | null
          trx_id: string | null
          type: string
          visitor_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          token_id?: string | null
          trx_id?: string | null
          type?: string
          visitor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          token_id?: string | null
          trx_id?: string | null
          type?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_transactions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_wa_reset_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          max_attempts: number
          purpose: string
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          is_used?: boolean
          max_attempts?: number
          purpose: string
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          max_attempts?: number
          purpose?: string
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_wa_reset_codes_user_balance_id_fkey"
            columns: ["user_balance_id"]
            isOneToOne: false
            referencedRelation: "user_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_wa_reset_codes_user_balance_id_fkey"
            columns: ["user_balance_id"]
            isOneToOne: false
            referencedRelation: "user_balances_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_packages: {
        Row: {
          created_at: string
          credits: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          storage_mb: number
          streak_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          storage_mb?: number
          streak_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          storage_mb?: number
          streak_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_violations: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          visitor_id?: string
        }
        Relationships: []
      }
      comment_restrictions: {
        Row: {
          created_at: string
          id: string
          last_reason: string | null
          restricted_until: string | null
          updated_at: string
          violation_count: number
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_reason?: string | null
          restricted_until?: string | null
          updated_at?: string
          violation_count?: number
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_reason?: string | null
          restricted_until?: string | null
          updated_at?: string
          violation_count?: number
          visitor_id?: string
        }
        Relationships: []
      }
      confess_free_trial: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      confess_number_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          max_numbers: number
          price: number
          trx_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          max_numbers?: number
          price?: number
          trx_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          max_numbers?: number
          price?: number
          trx_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      confess_public_wall: {
        Row: {
          confession_id: string | null
          created_at: string
          id: string
          is_hidden: boolean
          masked_phone: string
          message: string
          mood_tag: string | null
          reaction_counts: Json
          sender_name: string | null
          total_reactions: number
          visitor_id: string
        }
        Insert: {
          confession_id?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          masked_phone: string
          message: string
          mood_tag?: string | null
          reaction_counts?: Json
          sender_name?: string | null
          total_reactions?: number
          visitor_id: string
        }
        Update: {
          confession_id?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          masked_phone?: string
          message?: string
          mood_tag?: string | null
          reaction_counts?: Json
          sender_name?: string | null
          total_reactions?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confess_public_wall_confession_id_fkey"
            columns: ["confession_id"]
            isOneToOne: false
            referencedRelation: "confessions"
            referencedColumns: ["id"]
          },
        ]
      }
      confess_reveal_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          requester_phone: string
          requester_user_balance_id: string | null
          requester_visitor_id: string | null
          responded_at: string | null
          revealed_name: string | null
          revealed_visitor_id: string | null
          sender_user_balance_id: string | null
          sender_visitor_id: string
          status: string
          thread_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          requester_phone: string
          requester_user_balance_id?: string | null
          requester_visitor_id?: string | null
          responded_at?: string | null
          revealed_name?: string | null
          revealed_visitor_id?: string | null
          sender_user_balance_id?: string | null
          sender_visitor_id: string
          status?: string
          thread_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          requester_phone?: string
          requester_user_balance_id?: string | null
          requester_visitor_id?: string | null
          responded_at?: string | null
          revealed_name?: string | null
          revealed_visitor_id?: string | null
          sender_user_balance_id?: string | null
          sender_visitor_id?: string
          status?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confess_reveal_requests_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "confess_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      confess_reward_claims: {
        Row: {
          created_at: string
          gems: number
          id: string
          milestone: number
          visitor_id: string
          wall_id: string
        }
        Insert: {
          created_at?: string
          gems: number
          id?: string
          milestone: number
          visitor_id: string
          wall_id: string
        }
        Update: {
          created_at?: string
          gems?: number
          id?: string
          milestone?: number
          visitor_id?: string
          wall_id?: string
        }
        Relationships: []
      }
      confess_roulette_daily: {
        Row: {
          id: string
          post_date: string
          posts_count: number
          visitor_id: string
        }
        Insert: {
          id?: string
          post_date: string
          posts_count?: number
          visitor_id: string
        }
        Update: {
          id?: string
          post_date?: string
          posts_count?: number
          visitor_id?: string
        }
        Relationships: []
      }
      confess_roulette_posts: {
        Row: {
          created_at: string
          id: string
          is_hidden: boolean
          like_count: number
          message: string
          mood_tag: string | null
          pass_count: number
          sender_name: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          like_count?: number
          message: string
          mood_tag?: string | null
          pass_count?: number
          sender_name?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          like_count?: number
          message?: string
          mood_tag?: string | null
          pass_count?: number
          sender_name?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      confess_roulette_seen: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction: string | null
          viewer_visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction?: string | null
          viewer_visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction?: string | null
          viewer_visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confess_roulette_seen_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "confess_roulette_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      confess_scheduled: {
        Row: {
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          media_mime: string | null
          media_name: string | null
          media_size: number | null
          media_type: string | null
          media_url: string | null
          message: string
          mood_tag: string | null
          price_charged: number
          result_confession_id: string | null
          scheduled_at: string
          sender_name: string | null
          share_to_wall: boolean
          status: string
          target_phones: string[]
          trx_id: string | null
          user_balance_id: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          media_mime?: string | null
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          message: string
          mood_tag?: string | null
          price_charged?: number
          result_confession_id?: string | null
          scheduled_at: string
          sender_name?: string | null
          share_to_wall?: boolean
          status?: string
          target_phones: string[]
          trx_id?: string | null
          user_balance_id: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          media_mime?: string | null
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          message?: string
          mood_tag?: string | null
          price_charged?: number
          result_confession_id?: string | null
          scheduled_at?: string
          sender_name?: string | null
          share_to_wall?: boolean
          status?: string
          target_phones?: string[]
          trx_id?: string | null
          user_balance_id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      confess_thread_messages: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          direction: string
          edited_at: string | null
          error: string | null
          id: string
          is_free: boolean
          is_voice: boolean
          media_mime: string | null
          media_name: string | null
          media_size: number | null
          media_type: string | null
          media_url: string | null
          mood_tag: string | null
          reaction: string | null
          reaction_by: string | null
          reaction_updated_at: string | null
          reaction_wa_sent_at: string | null
          read_at: string | null
          sent_at: string | null
          status: string
          target_id: string | null
          text: string
          thread_id: string
          trx_id: string | null
          wa_display_name: string | null
          wa_edit_sent_at: string | null
          wa_message_id: string | null
          wa_profile_pic_url: string | null
          wa_reaction: string | null
          wa_revoked_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          direction: string
          edited_at?: string | null
          error?: string | null
          id?: string
          is_free?: boolean
          is_voice?: boolean
          media_mime?: string | null
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          mood_tag?: string | null
          reaction?: string | null
          reaction_by?: string | null
          reaction_updated_at?: string | null
          reaction_wa_sent_at?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          target_id?: string | null
          text?: string
          thread_id: string
          trx_id?: string | null
          wa_display_name?: string | null
          wa_edit_sent_at?: string | null
          wa_message_id?: string | null
          wa_profile_pic_url?: string | null
          wa_reaction?: string | null
          wa_revoked_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          direction?: string
          edited_at?: string | null
          error?: string | null
          id?: string
          is_free?: boolean
          is_voice?: boolean
          media_mime?: string | null
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          mood_tag?: string | null
          reaction?: string | null
          reaction_by?: string | null
          reaction_updated_at?: string | null
          reaction_wa_sent_at?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          target_id?: string | null
          text?: string
          thread_id?: string
          trx_id?: string | null
          wa_display_name?: string | null
          wa_edit_sent_at?: string | null
          wa_message_id?: string | null
          wa_profile_pic_url?: string | null
          wa_reaction?: string | null
          wa_revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "confess_thread_messages_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "confession_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confess_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "confess_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      confess_threads: {
        Row: {
          chat_stopped: boolean
          created_at: string
          free_until: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          last_paid_at: string
          sender_name: string | null
          target_avatar_updated_at: string | null
          target_avatar_url: string | null
          target_phone: string
          unread_count: number
          updated_at: string
          user_balance_id: string | null
          visitor_id: string
          wa_display_name: string | null
          wa_last_seen_at: string | null
          wa_presence: string | null
          wa_profile_pic_url: string | null
        }
        Insert: {
          chat_stopped?: boolean
          created_at?: string
          free_until?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_paid_at?: string
          sender_name?: string | null
          target_avatar_updated_at?: string | null
          target_avatar_url?: string | null
          target_phone: string
          unread_count?: number
          updated_at?: string
          user_balance_id?: string | null
          visitor_id: string
          wa_display_name?: string | null
          wa_last_seen_at?: string | null
          wa_presence?: string | null
          wa_profile_pic_url?: string | null
        }
        Update: {
          chat_stopped?: boolean
          created_at?: string
          free_until?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_paid_at?: string
          sender_name?: string | null
          target_avatar_updated_at?: string | null
          target_avatar_url?: string | null
          target_phone?: string
          unread_count?: number
          updated_at?: string
          user_balance_id?: string | null
          visitor_id?: string
          wa_display_name?: string | null
          wa_last_seen_at?: string | null
          wa_presence?: string | null
          wa_profile_pic_url?: string | null
        }
        Relationships: []
      }
      confess_voucher_redemptions: {
        Row: {
          discount_percent: number
          final_price: number
          id: string
          original_price: number
          redeemed_at: string
          user_balance_id: string | null
          visitor_id: string
          voucher_code: string
          voucher_id: string
        }
        Insert: {
          discount_percent: number
          final_price: number
          id?: string
          original_price: number
          redeemed_at?: string
          user_balance_id?: string | null
          visitor_id: string
          voucher_code: string
          voucher_id: string
        }
        Update: {
          discount_percent?: number
          final_price?: number
          id?: string
          original_price?: number
          redeemed_at?: string
          user_balance_id?: string | null
          visitor_id?: string
          voucher_code?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confess_voucher_redemptions_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "confess_vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      confess_vouchers: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          discount_percent: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          note: string | null
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          discount_percent: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          note?: string | null
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          note?: string | null
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      confess_wall_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          visitor_id: string
          wall_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          visitor_id: string
          wall_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          visitor_id?: string
          wall_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confess_wall_reactions_wall_id_fkey"
            columns: ["wall_id"]
            isOneToOne: false
            referencedRelation: "confess_public_wall"
            referencedColumns: ["id"]
          },
        ]
      }
      confession_replies: {
        Row: {
          confession_id: string
          created_at: string
          from_phone: string
          id: string
          reply_text: string
          target_id: string | null
        }
        Insert: {
          confession_id: string
          created_at?: string
          from_phone: string
          id?: string
          reply_text: string
          target_id?: string | null
        }
        Update: {
          confession_id?: string
          created_at?: string
          from_phone?: string
          id?: string
          reply_text?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "confession_replies_confession_id_fkey"
            columns: ["confession_id"]
            isOneToOne: false
            referencedRelation: "confessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confession_replies_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "confession_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      confession_targets: {
        Row: {
          confession_id: string
          created_at: string
          error: string | null
          id: string
          phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          confession_id: string
          created_at?: string
          error?: string | null
          id?: string
          phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          confession_id?: string
          created_at?: string
          error?: string | null
          id?: string
          phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "confession_targets_confession_id_fkey"
            columns: ["confession_id"]
            isOneToOne: false
            referencedRelation: "confessions"
            referencedColumns: ["id"]
          },
        ]
      }
      confessions: {
        Row: {
          created_at: string
          id: string
          media_mime: string | null
          media_name: string | null
          media_size: number | null
          media_type: string | null
          media_url: string | null
          message: string
          num_targets: number
          sender_name: string | null
          sender_visitor_id: string
          status: string
          total_price: number
          trx_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_mime?: string | null
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          message: string
          num_targets: number
          sender_name?: string | null
          sender_visitor_id: string
          status?: string
          total_price: number
          trx_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_mime?: string | null
          media_name?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          message?: string
          num_targets?: number
          sender_name?: string | null
          sender_visitor_id?: string
          status?: string
          total_price?: number
          trx_id?: string
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          created_at: string
          credits: number
          id: string
          is_active: boolean
          is_unlimited: boolean
          label: string
          price: number
          sort_order: number
          unlimited_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          is_unlimited?: boolean
          label?: string
          price?: number
          sort_order?: number
          unlimited_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          is_unlimited?: boolean
          label?: string
          price?: number
          sort_order?: number
          unlimited_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_challenge_progress: {
        Row: {
          challenge_date: string
          challenge_id: string
          claimed_at: string | null
          created_at: string
          current_value: number
          id: string
          is_completed: boolean
          updated_at: string
          visitor_id: string
        }
        Insert: {
          challenge_date?: string
          challenge_id: string
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          is_completed?: boolean
          updated_at?: string
          visitor_id: string
        }
        Update: {
          challenge_date?: string
          challenge_id?: string
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          is_completed?: boolean
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenges: {
        Row: {
          challenge_type: string
          created_at: string
          description: string
          difficulty: string
          icon: string
          id: string
          is_active: boolean
          reward_coins: number
          reward_gems: number
          reward_saldo_in: number
          sort_order: number
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          challenge_type: string
          created_at?: string
          description?: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          reward_coins?: number
          reward_gems?: number
          reward_saldo_in?: number
          sort_order?: number
          target_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          description?: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          reward_coins?: number
          reward_gems?: number
          reward_saldo_in?: number
          sort_order?: number
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_free_spin_claims: {
        Row: {
          created_at: string
          id: string
          reward_label: string | null
          reward_type: string | null
          reward_value: number | null
          segment_id: string | null
          spin_date: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reward_label?: string | null
          reward_type?: string | null
          reward_value?: number | null
          segment_id?: string | null
          spin_date: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reward_label?: string | null
          reward_type?: string | null
          reward_value?: number | null
          segment_id?: string | null
          spin_date?: string
          visitor_id?: string
        }
        Relationships: []
      }
      daily_free_spin_segments: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label: string
          reward_type: string
          reward_value: number
          sort_order: number
          weight: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          reward_type: string
          reward_value?: number
          sort_order?: number
          weight?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          reward_type?: string
          reward_value?: number
          sort_order?: number
          weight?: number
        }
        Relationships: []
      }
      daily_gift_box_claims: {
        Row: {
          claimed_at: string
          day_number: number
          id: string
          reward_label: string
          reward_type: string
          reward_value: number
          streak_day: number
          visitor_id: string
          week_start: string
        }
        Insert: {
          claimed_at?: string
          day_number: number
          id?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          streak_day?: number
          visitor_id: string
          week_start: string
        }
        Update: {
          claimed_at?: string
          day_number?: number
          id?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          streak_day?: number
          visitor_id?: string
          week_start?: string
        }
        Relationships: []
      }
      daily_gift_box_rewards: {
        Row: {
          created_at: string
          day_number: number
          icon: string
          id: string
          is_premium: boolean
          reward_label: string
          reward_type: string
          reward_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          icon?: string
          id?: string
          is_premium?: boolean
          reward_label?: string
          reward_type: string
          reward_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          icon?: string
          id?: string
          is_premium?: boolean
          reward_label?: string
          reward_type?: string
          reward_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_streaks: {
        Row: {
          achievements: string[]
          created_at: string
          current_multiplier: number
          current_streak: number
          free_scratch_date: string | null
          freeze_count: number
          freeze_used_at: string | null
          id: string
          last_claim_date: string
          longest_streak: number
          scratch_stats: Json
          streak_coins: number
          total_bonus_points: number
          total_claims: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          achievements?: string[]
          created_at?: string
          current_multiplier?: number
          current_streak?: number
          free_scratch_date?: string | null
          freeze_count?: number
          freeze_used_at?: string | null
          id?: string
          last_claim_date?: string
          longest_streak?: number
          scratch_stats?: Json
          streak_coins?: number
          total_bonus_points?: number
          total_claims?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          achievements?: string[]
          created_at?: string
          current_multiplier?: number
          current_streak?: number
          free_scratch_date?: string | null
          freeze_count?: number
          freeze_used_at?: string | null
          id?: string
          last_claim_date?: string
          longest_streak?: number
          scratch_stats?: Json
          streak_coins?: number
          total_bonus_points?: number
          total_claims?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          cancel_reason: string | null
          created_at: string
          id: string
          payment_method: string
          status: string
          trx_id: string
          updated_at: string
          username: string
          visitor_id: string
        }
        Insert: {
          amount?: number
          cancel_reason?: string | null
          created_at?: string
          id?: string
          payment_method?: string
          status?: string
          trx_id?: string
          updated_at?: string
          username?: string
          visitor_id: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          created_at?: string
          id?: string
          payment_method?: string
          status?: string
          trx_id?: string
          updated_at?: string
          username?: string
          visitor_id?: string
        }
        Relationships: []
      }
      diamond_royale_history: {
        Row: {
          cost_gems: number
          created_at: string
          id: string
          is_pity_break: boolean
          rarity: string
          reward_kind: string
          reward_label: string
          reward_value: number
          spin_type: string
          visitor_id: string
        }
        Insert: {
          cost_gems?: number
          created_at?: string
          id?: string
          is_pity_break?: boolean
          rarity?: string
          reward_kind: string
          reward_label: string
          reward_value?: number
          spin_type?: string
          visitor_id: string
        }
        Update: {
          cost_gems?: number
          created_at?: string
          id?: string
          is_pity_break?: boolean
          rarity?: string
          reward_kind?: string
          reward_label?: string
          reward_value?: number
          spin_type?: string
          visitor_id?: string
        }
        Relationships: []
      }
      diamond_royale_state: {
        Row: {
          created_at: string
          id: string
          pity_counter: number
          rare_pity_counter: number
          total_legendary: number
          total_spins: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pity_counter?: number
          rare_pity_counter?: number
          total_legendary?: number
          total_spins?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pity_counter?: number
          rare_pity_counter?: number
          total_legendary?: number
          total_spins?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      discount_limit_upgrades: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          tier: string
          updated_at: string
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          tier: string
          updated_at?: string
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          tier?: string
          updated_at?: string
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      discount_spin_state: {
        Row: {
          bought_since_spin: boolean
          claimed_milestones: number[]
          claims: Json
          created_at: string
          current_discount: number
          id: string
          purchased_items: string[]
          refresh_count: number
          side_seed: number
          spin_date: string
          spins_used: number
          total_bought: number
          total_saved: number
          updated_at: string
          visitor_id: string
          won_discounts: number[]
        }
        Insert: {
          bought_since_spin?: boolean
          claimed_milestones?: number[]
          claims?: Json
          created_at?: string
          current_discount?: number
          id?: string
          purchased_items?: string[]
          refresh_count?: number
          side_seed?: number
          spin_date?: string
          spins_used?: number
          total_bought?: number
          total_saved?: number
          updated_at?: string
          visitor_id: string
          won_discounts?: number[]
        }
        Update: {
          bought_since_spin?: boolean
          claimed_milestones?: number[]
          claims?: Json
          created_at?: string
          current_discount?: number
          id?: string
          purchased_items?: string[]
          refresh_count?: number
          side_seed?: number
          spin_date?: string
          spins_used?: number
          total_bought?: number
          total_saved?: number
          updated_at?: string
          visitor_id?: string
          won_discounts?: number[]
        }
        Relationships: []
      }
      discount_vouchers: {
        Row: {
          activated_at: string | null
          active_expires_at: string | null
          code: string
          created_at: string
          discount_amount: number
          duration_hours: number | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          source: string | null
          used_count: number
          user_balance_id: string | null
          visitor_id: string | null
        }
        Insert: {
          activated_at?: string | null
          active_expires_at?: string | null
          code: string
          created_at?: string
          discount_amount?: number
          duration_hours?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          source?: string | null
          used_count?: number
          user_balance_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          activated_at?: string | null
          active_expires_at?: string | null
          code?: string
          created_at?: string
          discount_amount?: number
          duration_hours?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          source?: string | null
          used_count?: number
          user_balance_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      discount_wheel_limit_upgrade: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_permanent: boolean
          updated_at: string
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          updated_at?: string
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          updated_at?: string
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      event_shop_achievement_items: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          price_coins: number
          reward_label: string
          reward_type: string
          reward_value: number
          sort_order: number
          unlock_requirement: string
          unlock_threshold: number
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          price_coins?: number
          reward_label?: string
          reward_type: string
          reward_value?: number
          sort_order?: number
          unlock_requirement?: string
          unlock_threshold?: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          price_coins?: number
          reward_label?: string
          reward_type?: string
          reward_value?: number
          sort_order?: number
          unlock_requirement?: string
          unlock_threshold?: number
        }
        Relationships: []
      }
      event_shop_achievement_purchases: {
        Row: {
          cost_paid: number
          created_at: string
          id: string
          item_id: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          cost_paid: number
          created_at?: string
          id?: string
          item_id: string
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          cost_paid?: number
          created_at?: string
          id?: string
          item_id?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_shop_achievement_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "event_shop_achievement_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shop_activity_feed: {
        Row: {
          action_type: string
          created_at: string
          display_name: string
          id: string
          item_icon: string
          item_name: string
          rarity: string
          visitor_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          display_name?: string
          id?: string
          item_icon?: string
          item_name?: string
          rarity?: string
          visitor_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          display_name?: string
          id?: string
          item_icon?: string
          item_name?: string
          rarity?: string
          visitor_id?: string
        }
        Relationships: []
      }
      event_shop_bundle_purchases: {
        Row: {
          bundle_id: string
          contents_snapshot: Json
          cost_paid: number
          created_at: string
          id: string
          payment_method: string
          visitor_id: string
          week_start: string
        }
        Insert: {
          bundle_id: string
          contents_snapshot?: Json
          cost_paid: number
          created_at?: string
          id?: string
          payment_method?: string
          visitor_id: string
          week_start: string
        }
        Update: {
          bundle_id?: string
          contents_snapshot?: Json
          cost_paid?: number
          created_at?: string
          id?: string
          payment_method?: string
          visitor_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_shop_bundle_purchases_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "event_shop_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shop_bundles: {
        Row: {
          contents: Json
          cost_gems: number
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          original_price: number
          price_coins: number
          sort_order: number
          updated_at: string
          weekly_limit: number
        }
        Insert: {
          contents?: Json
          cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          original_price?: number
          price_coins?: number
          sort_order?: number
          updated_at?: string
          weekly_limit?: number
        }
        Update: {
          contents?: Json
          cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          original_price?: number
          price_coins?: number
          sort_order?: number
          updated_at?: string
          weekly_limit?: number
        }
        Relationships: []
      }
      event_shop_daily_active: {
        Row: {
          created_at: string
          discount_pct: number
          id: string
          item_id: string
          rotation_date: string
          slot_order: number
        }
        Insert: {
          created_at?: string
          discount_pct?: number
          id?: string
          item_id: string
          rotation_date: string
          slot_order?: number
        }
        Update: {
          created_at?: string
          discount_pct?: number
          id?: string
          item_id?: string
          rotation_date?: string
          slot_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_shop_daily_active_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "event_shop_daily_rotation"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shop_daily_purchases: {
        Row: {
          cost_paid: number
          created_at: string
          id: string
          item_id: string
          payment_method: string
          purchase_date: string
          visitor_id: string
        }
        Insert: {
          cost_paid: number
          created_at?: string
          id?: string
          item_id: string
          payment_method?: string
          purchase_date: string
          visitor_id: string
        }
        Update: {
          cost_paid?: number
          created_at?: string
          id?: string
          item_id?: string
          payment_method?: string
          purchase_date?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_shop_daily_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "event_shop_daily_rotation"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shop_daily_rotation: {
        Row: {
          base_price_coins: number
          cost_gems: number
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          rarity_weight: number
          reward_label: string
          reward_type: string
          reward_value: number
          updated_at: string
        }
        Insert: {
          base_price_coins?: number
          cost_gems?: number
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          rarity_weight?: number
          reward_label?: string
          reward_type: string
          reward_value?: number
          updated_at?: string
        }
        Update: {
          base_price_coins?: number
          cost_gems?: number
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          rarity_weight?: number
          reward_label?: string
          reward_type?: string
          reward_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_shop_flash_deals: {
        Row: {
          created_at: string
          description: string
          ends_at: string
          flash_price: number
          icon: string
          id: string
          is_active: boolean
          name: string
          original_price: number
          reward_label: string
          reward_type: string
          reward_value: number
          sold_count: number
          sort_order: number
          starts_at: string
          total_stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          ends_at?: string
          flash_price?: number
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          original_price?: number
          reward_label?: string
          reward_type: string
          reward_value?: number
          sold_count?: number
          sort_order?: number
          starts_at?: string
          total_stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string
          flash_price?: number
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          original_price?: number
          reward_label?: string
          reward_type?: string
          reward_value?: number
          sold_count?: number
          sort_order?: number
          starts_at?: string
          total_stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_shop_flash_purchases: {
        Row: {
          cost_paid: number
          created_at: string
          deal_id: string
          id: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          cost_paid: number
          created_at?: string
          deal_id: string
          id?: string
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          cost_paid?: number
          created_at?: string
          deal_id?: string
          id?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_shop_flash_purchases_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "event_shop_flash_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shop_gacha_history: {
        Row: {
          cost_paid: number
          created_at: string
          id: string
          item_id: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          cost_paid: number
          created_at?: string
          id?: string
          item_id: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          cost_paid?: number
          created_at?: string
          id?: string
          item_id?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_shop_gacha_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "event_shop_gacha_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shop_gacha_items: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          weight: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          rarity?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          weight?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          weight?: number
        }
        Relationships: []
      }
      event_shop_login_calendar: {
        Row: {
          claimed_at: string
          cycle_start: string
          day_number: number
          id: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          claimed_at?: string
          cycle_start: string
          day_number: number
          id?: string
          reward_label: string
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          claimed_at?: string
          cycle_start?: string
          day_number?: number
          id?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: []
      }
      event_shop_mystery_boxes: {
        Row: {
          cost_gems: number
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          price_coins: number
          rarity_pool: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          price_coins?: number
          rarity_pool?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          price_coins?: number
          rarity_pool?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_shop_mystery_openings: {
        Row: {
          box_id: string
          cost_paid: number
          created_at: string
          id: string
          payment_method: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          box_id: string
          cost_paid: number
          created_at?: string
          id?: string
          payment_method?: string
          rarity: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          box_id?: string
          cost_paid?: number
          created_at?: string
          id?: string
          payment_method?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_shop_mystery_openings_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "event_shop_mystery_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shop_top_spenders: {
        Row: {
          id: string
          purchase_count: number
          total_spent: number
          updated_at: string
          visitor_id: string
          week_start: string
        }
        Insert: {
          id?: string
          purchase_count?: number
          total_spent?: number
          updated_at?: string
          visitor_id: string
          week_start: string
        }
        Update: {
          id?: string
          purchase_count?: number
          total_spent?: number
          updated_at?: string
          visitor_id?: string
          week_start?: string
        }
        Relationships: []
      }
      event_shop_vip_pass: {
        Row: {
          activated_at: string
          created_at: string
          expires_at: string
          free_box_last_claim: string | null
          id: string
          total_purchases: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          expires_at?: string
          free_box_last_claim?: string | null
          id?: string
          total_purchases?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          expires_at?: string
          free_box_last_claim?: string | null
          id?: string
          total_purchases?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      event_shop_wishlist: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_kind: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_kind: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_kind?: string
          visitor_id?: string
        }
        Relationships: []
      }
      faded_wheel_state: {
        Row: {
          claimed_indexes: number[]
          created_at: string
          current_round: number
          grid_prizes: Json
          id: string
          pending_claims: Json
          spins_in_round: number
          total_spins_lifetime: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          claimed_indexes?: number[]
          created_at?: string
          current_round?: number
          grid_prizes?: Json
          id?: string
          pending_claims?: Json
          spins_in_round?: number
          total_spins_lifetime?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          claimed_indexes?: number[]
          created_at?: string
          current_round?: number
          grid_prizes?: Json
          id?: string
          pending_claims?: Json
          spins_in_round?: number
          total_spins_lifetime?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      flash_deal_redemptions: {
        Row: {
          cost_paid: number
          created_at: string
          deal_id: string
          id: string
          payment_method: string
          redemption_date: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          cost_paid: number
          created_at?: string
          deal_id: string
          id?: string
          payment_method?: string
          redemption_date?: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Update: {
          cost_paid?: number
          created_at?: string
          deal_id?: string
          id?: string
          payment_method?: string
          redemption_date?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_deal_redemptions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "streak_flash_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_sales: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          discount_amount: number
          discount_percent: number
          ends_at: string
          id: string
          is_active: boolean
          notify_sent: boolean
          product_id: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number
          discount_percent?: number
          ends_at: string
          id?: string
          is_active?: boolean
          notify_sent?: boolean
          product_id?: string | null
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number
          discount_percent?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          notify_sent?: boolean
          product_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      galau_messages: {
        Row: {
          created_at: string
          deleted_for: string[]
          delivered_at: string | null
          id: string
          media_mime: string | null
          media_size: number | null
          media_type: string | null
          media_url: string | null
          read_at: string | null
          sender_visitor_id: string
          session_id: string
          text: string | null
        }
        Insert: {
          created_at?: string
          deleted_for?: string[]
          delivered_at?: string | null
          id?: string
          media_mime?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          sender_visitor_id: string
          session_id: string
          text?: string | null
        }
        Update: {
          created_at?: string
          deleted_for?: string[]
          delivered_at?: string | null
          id?: string
          media_mime?: string | null
          media_size?: number | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          sender_visitor_id?: string
          session_id?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "galau_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "galau_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      galau_profiles: {
        Row: {
          avatar_preset: string
          created_at: string
          last_seen_at: string
          nickname: string | null
          total_sessions: number
          visitor_id: string
        }
        Insert: {
          avatar_preset?: string
          created_at?: string
          last_seen_at?: string
          nickname?: string | null
          total_sessions?: number
          visitor_id: string
        }
        Update: {
          avatar_preset?: string
          created_at?: string
          last_seen_at?: string
          nickname?: string | null
          total_sessions?: number
          visitor_id?: string
        }
        Relationships: []
      }
      galau_queue: {
        Row: {
          joined_at: string
          mood: string
          nickname: string | null
          visitor_id: string
        }
        Insert: {
          joined_at?: string
          mood?: string
          nickname?: string | null
          visitor_id: string
        }
        Update: {
          joined_at?: string
          mood?: string
          nickname?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      galau_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          ended_by: string | null
          id: string
          mood_a: string | null
          mood_b: string | null
          nickname_a: string | null
          nickname_b: string | null
          status: string
          visitor_a: string
          visitor_b: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          mood_a?: string | null
          mood_b?: string | null
          nickname_a?: string | null
          nickname_b?: string | null
          status?: string
          visitor_a: string
          visitor_b: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          mood_a?: string | null
          mood_b?: string | null
          nickname_a?: string | null
          nickname_b?: string | null
          status?: string
          visitor_a?: string
          visitor_b?: string
        }
        Relationships: []
      }
      game_achievements: {
        Row: {
          achievement_key: string
          id: string
          unlocked_at: string
          visitor_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          unlocked_at?: string
          visitor_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          unlocked_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      game_balance: {
        Row: {
          amount: number
          created_at: string
          id: string
          total_earned: number
          total_spent: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      game_balance_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          visitor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          visitor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          visitor_id?: string
        }
        Relationships: []
      }
      game_clan_members: {
        Row: {
          clan_id: string
          contributed_xp: number
          display_name: string
          id: string
          joined_at: string
          role: string
          visitor_id: string
        }
        Insert: {
          clan_id: string
          contributed_xp?: number
          display_name?: string
          id?: string
          joined_at?: string
          role?: string
          visitor_id: string
        }
        Update: {
          clan_id?: string
          contributed_xp?: number
          display_name?: string
          id?: string
          joined_at?: string
          role?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "game_clans"
            referencedColumns: ["id"]
          },
        ]
      }
      game_clans: {
        Row: {
          created_at: string
          id: string
          join_code: string | null
          leader_name: string
          leader_visitor_id: string
          level: number
          max_members: number
          member_count: number
          motto: string
          name: string
          tag: string
          total_xp: number
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string | null
          leader_name?: string
          leader_visitor_id: string
          level?: number
          max_members?: number
          member_count?: number
          motto?: string
          name: string
          tag: string
          total_xp?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string | null
          leader_name?: string
          leader_visitor_id?: string
          level?: number
          max_members?: number
          member_count?: number
          motto?: string
          name?: string
          tag?: string
          total_xp?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      game_discount_vouchers: {
        Row: {
          code: string
          created_at: string
          discount_amount: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_amount?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_amount?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Relationships: []
      }
      game_follows: {
        Row: {
          created_at: string
          follower_visitor_id: string
          following_visitor_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_visitor_id: string
          following_visitor_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_visitor_id?: string
          following_visitor_id?: string
          id?: string
        }
        Relationships: []
      }
      game_levels: {
        Row: {
          created_at: string
          id: string
          level: number
          total_points: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: number
          total_points?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          total_points?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      game_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          display_name: string
          email: string | null
          gems: number
          id: string
          is_guest: boolean
          password_hash: string | null
          phone: string | null
          updated_at: string
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          email?: string | null
          gems?: number
          id?: string
          is_guest?: boolean
          password_hash?: string | null
          phone?: string | null
          updated_at?: string
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          email?: string | null
          gems?: number
          id?: string
          is_guest?: boolean
          password_hash?: string | null
          phone?: string | null
          updated_at?: string
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_profiles_user_balance_id_fkey"
            columns: ["user_balance_id"]
            isOneToOne: false
            referencedRelation: "user_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_profiles_user_balance_id_fkey"
            columns: ["user_balance_id"]
            isOneToOne: false
            referencedRelation: "user_balances_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_pvp_rooms: {
        Row: {
          best_of: number
          created_at: string
          current_round: number
          id: string
          player1_choice: string | null
          player1_name: string
          player1_score: number
          player1_visitor_id: string
          player2_choice: string | null
          player2_name: string | null
          player2_score: number
          player2_visitor_id: string | null
          room_code: string | null
          round_deadline_at: string | null
          round_started_at: string | null
          status: string
          updated_at: string
          visibility: string
          winner_visitor_id: string | null
        }
        Insert: {
          best_of?: number
          created_at?: string
          current_round?: number
          id?: string
          player1_choice?: string | null
          player1_name?: string
          player1_score?: number
          player1_visitor_id: string
          player2_choice?: string | null
          player2_name?: string | null
          player2_score?: number
          player2_visitor_id?: string | null
          room_code?: string | null
          round_deadline_at?: string | null
          round_started_at?: string | null
          status?: string
          updated_at?: string
          visibility?: string
          winner_visitor_id?: string | null
        }
        Update: {
          best_of?: number
          created_at?: string
          current_round?: number
          id?: string
          player1_choice?: string | null
          player1_name?: string
          player1_score?: number
          player1_visitor_id?: string
          player2_choice?: string | null
          player2_name?: string | null
          player2_score?: number
          player2_visitor_id?: string | null
          room_code?: string | null
          round_deadline_at?: string | null
          round_started_at?: string | null
          status?: string
          updated_at?: string
          visibility?: string
          winner_visitor_id?: string | null
        }
        Relationships: []
      }
      game_season_pass: {
        Row: {
          claimed_tiers: number[]
          created_at: string
          id: string
          is_premium: boolean
          premium_purchased_at: string | null
          premium_source: string | null
          season_key: string
          total_xp: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          claimed_tiers?: number[]
          created_at?: string
          id?: string
          is_premium?: boolean
          premium_purchased_at?: string | null
          premium_source?: string | null
          season_key?: string
          total_xp?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          claimed_tiers?: number[]
          created_at?: string
          id?: string
          is_premium?: boolean
          premium_purchased_at?: string | null
          premium_source?: string | null
          season_key?: string
          total_xp?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      game_stats: {
        Row: {
          created_at: string
          game_type: string
          id: string
          losses: number
          points: number
          total_questions: number
          updated_at: string
          visitor_id: string
          wins: number
        }
        Insert: {
          created_at?: string
          game_type: string
          id?: string
          losses?: number
          points?: number
          total_questions?: number
          updated_at?: string
          visitor_id: string
          wins?: number
        }
        Update: {
          created_at?: string
          game_type?: string
          id?: string
          losses?: number
          points?: number
          total_questions?: number
          updated_at?: string
          visitor_id?: string
          wins?: number
        }
        Relationships: []
      }
      gem_packages: {
        Row: {
          bonus_game_credits: number
          bonus_gems: number
          bonus_streak_coins: number
          created_at: string
          gems: number
          icon: string
          id: string
          is_active: boolean
          is_first_purchase_only: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus_game_credits?: number
          bonus_gems?: number
          bonus_streak_coins?: number
          created_at?: string
          gems?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_first_purchase_only?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus_game_credits?: number
          bonus_gems?: number
          bonus_streak_coins?: number
          created_at?: string
          gems?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_first_purchase_only?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gem_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          type: string
          visitor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: string
          visitor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: string
          visitor_id?: string
        }
        Relationships: []
      }
      liked_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liked_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      liked_songs: {
        Row: {
          created_at: string
          id: string
          song_id: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          song_id: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          song_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liked_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "playlist_songs"
            referencedColumns: ["id"]
          },
        ]
      }
      liked_sponsors: {
        Row: {
          created_at: string
          id: string
          sponsor_id: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sponsor_id: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sponsor_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liked_sponsors_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      luck_normal_pack_discount_usage: {
        Row: {
          account_key: string
          created_at: string
          day_wib: string
          id: string
          pack_count: number
          updated_at: string
          used_count: number
          user_balance_id: string | null
          visitor_id: string | null
        }
        Insert: {
          account_key: string
          created_at?: string
          day_wib: string
          id?: string
          pack_count: number
          updated_at?: string
          used_count?: number
          user_balance_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          account_key?: string
          created_at?: string
          day_wib?: string
          id?: string
          pack_count?: number
          updated_at?: string
          used_count?: number
          user_balance_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      luck_royale_nyawa_history: {
        Row: {
          cost_amount: number
          cost_currency: string
          created_at: string
          id: string
          rarity: string
          reward_kind: string
          reward_label: string
          reward_value: number
          spin_type: string
          visitor_id: string
        }
        Insert: {
          cost_amount: number
          cost_currency: string
          created_at?: string
          id?: string
          rarity?: string
          reward_kind: string
          reward_label: string
          reward_value?: number
          spin_type: string
          visitor_id: string
        }
        Update: {
          cost_amount?: number
          cost_currency?: string
          created_at?: string
          id?: string
          rarity?: string
          reward_kind?: string
          reward_label?: string
          reward_value?: number
          spin_type?: string
          visitor_id?: string
        }
        Relationships: []
      }
      luck_spin_ticket_log: {
        Row: {
          account_key: string
          created_at: string
          delta: number
          id: string
          meta: Json | null
          reason: string
          ticket_type: string
          visitor_id: string | null
        }
        Insert: {
          account_key: string
          created_at?: string
          delta: number
          id?: string
          meta?: Json | null
          reason: string
          ticket_type: string
          visitor_id?: string | null
        }
        Update: {
          account_key?: string
          created_at?: string
          delta?: number
          id?: string
          meta?: Json | null
          reason?: string
          ticket_type?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      luck_spin_tickets: {
        Row: {
          account_key: string
          balance: number
          created_at: string
          id: string
          ticket_type: string
          total_purchased: number
          total_used: number
          updated_at: string
          user_balance_id: string | null
          visitor_id: string | null
        }
        Insert: {
          account_key: string
          balance?: number
          created_at?: string
          id?: string
          ticket_type: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
          user_balance_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          account_key?: string
          balance?: number
          created_at?: string
          id?: string
          ticket_type?: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
          user_balance_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      lucky_draw_history: {
        Row: {
          created_at: string
          id: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
          voucher_code: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          rarity?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          visitor_id: string
          voucher_code?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
          voucher_code?: string | null
        }
        Relationships: []
      }
      lucky_draw_promo_claims: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          promo_code: string
          visitor_id: string
        }
        Insert: {
          claim_date: string
          created_at?: string
          id?: string
          promo_code: string
          visitor_id: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          promo_code?: string
          visitor_id?: string
        }
        Relationships: []
      }
      lucky_draw_ticket_packages: {
        Row: {
          cost_amount: number
          cost_currency: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tickets: number
          updated_at: string
        }
        Insert: {
          cost_amount?: number
          cost_currency?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tickets?: number
          updated_at?: string
        }
        Update: {
          cost_amount?: number
          cost_currency?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tickets?: number
          updated_at?: string
        }
        Relationships: []
      }
      lucky_draw_tickets: {
        Row: {
          id: string
          ticket_count: number
          total_purchased: number
          total_used: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          id?: string
          ticket_count?: number
          total_purchased?: number
          total_used?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          id?: string
          ticket_count?: number
          total_purchased?: number
          total_used?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      match3_scores: {
        Row: {
          combo_max: number
          created_at: string
          id: string
          moves: number
          payout_label: string
          payout_type: string | null
          payout_value: number
          score: number
          visitor_id: string
          voucher_code: string | null
        }
        Insert: {
          combo_max?: number
          created_at?: string
          id?: string
          moves?: number
          payout_label?: string
          payout_type?: string | null
          payout_value?: number
          score?: number
          visitor_id: string
          voucher_code?: string | null
        }
        Update: {
          combo_max?: number
          created_at?: string
          id?: string
          moves?: number
          payout_label?: string
          payout_type?: string | null
          payout_value?: number
          score?: number
          visitor_id?: string
          voucher_code?: string | null
        }
        Relationships: []
      }
      mine_sweeper_history: {
        Row: {
          bet_credits: number
          created_at: string
          id: string
          mines_count: number
          multiplier: number
          payout_label: string
          payout_type: string
          payout_value: number
          status: string
          tiles_revealed: number
          visitor_id: string
        }
        Insert: {
          bet_credits?: number
          created_at?: string
          id?: string
          mines_count?: number
          multiplier?: number
          payout_label?: string
          payout_type?: string
          payout_value?: number
          status?: string
          tiles_revealed?: number
          visitor_id: string
        }
        Update: {
          bet_credits?: number
          created_at?: string
          id?: string
          mines_count?: number
          multiplier?: number
          payout_label?: string
          payout_type?: string
          payout_value?: number
          status?: string
          tiles_revealed?: number
          visitor_id?: string
        }
        Relationships: []
      }
      mine_sweeper_sessions: {
        Row: {
          bet: number
          created_at: string
          mine_positions: number[]
          mines: number
          revealed: number[]
          status: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          bet: number
          created_at?: string
          mine_positions: number[]
          mines: number
          revealed?: number[]
          status?: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          bet?: number
          created_at?: string
          mine_positions?: number[]
          mines?: number
          revealed?: number[]
          status?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      monthly_quest_progress: {
        Row: {
          claimed_at: string | null
          created_at: string
          current_value: number
          id: string
          is_completed: boolean
          month_start: string
          quest_id: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          is_completed?: boolean
          month_start: string
          quest_id: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          is_completed?: boolean
          month_start?: string
          quest_id?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      monthly_quests: {
        Row: {
          created_at: string
          description: string
          difficulty: string
          icon: string
          id: string
          is_active: boolean
          quest_type: string
          reward_coins: number
          reward_gems: number
          reward_saldo_in: number
          reward_xp: number
          sort_order: number
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          quest_type: string
          reward_coins?: number
          reward_gems?: number
          reward_saldo_in?: number
          reward_xp?: number
          sort_order?: number
          target_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          quest_type?: string
          reward_coins?: number
          reward_gems?: number
          reward_saldo_in?: number
          reward_xp?: number
          sort_order?: number
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      music_daily_quests: {
        Row: {
          created_at: string
          current_value: number
          id: string
          is_claimed: boolean
          is_completed: boolean
          quest_date: string
          quest_type: string
          reward_coins: number
          target_value: number
          visitor_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          is_claimed?: boolean
          is_completed?: boolean
          quest_date?: string
          quest_type: string
          reward_coins?: number
          target_value: number
          visitor_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          is_claimed?: boolean
          is_completed?: boolean
          quest_date?: string
          quest_type?: string
          reward_coins?: number
          target_value?: number
          visitor_id?: string
        }
        Relationships: []
      }
      music_discount_vouchers: {
        Row: {
          code: string
          created_at: string
          discount_amount: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_amount?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_amount?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Relationships: []
      }
      music_listener_xp: {
        Row: {
          level: string
          total_seconds: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          level?: string
          total_seconds?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          level?: string
          total_seconds?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      music_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          updated_at: string
          username: string
          visitor_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          username: string
          visitor_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          username?: string
          visitor_id?: string
        }
        Relationships: []
      }
      music_storage_vouchers: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          storage_mb: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          storage_mb?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          storage_mb?: number
          used_count?: number
        }
        Relationships: []
      }
      mystery_box_claims: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          payment_method: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          claim_date?: string
          created_at?: string
          id?: string
          payment_method?: string
          rarity?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          payment_method?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: []
      }
      mystery_box_drop_claims: {
        Row: {
          created_at: string
          drop_id: string
          id: string
          rarity: string | null
          reward_label: string | null
          reward_type: string | null
          reward_value: number | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          drop_id: string
          id?: string
          rarity?: string | null
          reward_label?: string | null
          reward_type?: string | null
          reward_value?: number | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          drop_id?: string
          id?: string
          rarity?: string | null
          reward_label?: string | null
          reward_type?: string | null
          reward_value?: number | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mystery_box_drop_claims_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "mystery_box_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      mystery_box_drops: {
        Row: {
          created_at: string
          drop_date: string
          ends_at: string
          id: string
          is_active: boolean
          opened_count: number
          rarity_pool: Json
          slot_index: number
          starts_at: string
          total_stock: number
        }
        Insert: {
          created_at?: string
          drop_date: string
          ends_at: string
          id?: string
          is_active?: boolean
          opened_count?: number
          rarity_pool?: Json
          slot_index: number
          starts_at: string
          total_stock?: number
        }
        Update: {
          created_at?: string
          drop_date?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          opened_count?: number
          rarity_pool?: Json
          slot_index?: number
          starts_at?: string
          total_stock?: number
        }
        Relationships: []
      }
      mystery_boxes: {
        Row: {
          created_at: string
          id: string
          is_opened: boolean
          max_reward: number
          min_reward: number
          opened_at: string | null
          reward_amount: number | null
          source: string | null
          tier: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_opened?: boolean
          max_reward?: number
          min_reward?: number
          opened_at?: string | null
          reward_amount?: number | null
          source?: string | null
          tier?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_opened?: boolean
          max_reward?: number
          min_reward?: number
          opened_at?: string | null
          reward_amount?: number | null
          source?: string | null
          tier?: string
          visitor_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          related_id: string | null
          title: string
          type: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          related_id?: string | null
          title: string
          type?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          related_id?: string | null
          title?: string
          type?: string
          visitor_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          token: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          token: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          token?: string
          visitor_id?: string
        }
        Relationships: []
      }
      pin_attempts: {
        Row: {
          action: string
          attempted_at: string
          id: string
          ip_address: string | null
          succeeded: boolean
          visitor_id: string
        }
        Insert: {
          action: string
          attempted_at?: string
          id?: string
          ip_address?: string | null
          succeeded?: boolean
          visitor_id: string
        }
        Update: {
          action?: string
          attempted_at?: string
          id?: string
          ip_address?: string | null
          succeeded?: boolean
          visitor_id?: string
        }
        Relationships: []
      }
      pin_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          token: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          token: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          token?: string
          visitor_id?: string
        }
        Relationships: []
      }
      playlist_items: {
        Row: {
          created_at: string
          id: string
          item_order: number
          playlist_id: string
          song_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_order?: number
          playlist_id: string
          song_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_order?: number
          playlist_id?: string
          song_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "playlist_songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_songs: {
        Row: {
          artist: string
          artist_id: string | null
          cover_url: string | null
          created_at: string
          duration: number | null
          file_size: number | null
          file_url: string
          id: string
          release_date: string | null
          title: string
        }
        Insert: {
          artist?: string
          artist_id?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number | null
          file_size?: number | null
          file_url: string
          id?: string
          release_date?: string | null
          title: string
        }
        Update: {
          artist?: string
          artist_id?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number | null
          file_size?: number | null
          file_url?: string
          id?: string
          release_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          name: string
          playlist_type: string
          visitor_id: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name: string
          playlist_type?: string
          visitor_id?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name?: string
          playlist_type?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      premium_quest_plans: {
        Row: {
          code: string
          created_at: string
          description: string
          duration_seconds: number | null
          id: string
          is_active: boolean
          is_permanent: boolean
          is_promo: boolean
          name: string
          price_balance: number
          price_saldo_in: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          is_promo?: boolean
          name: string
          price_balance?: number
          price_saldo_in?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          is_promo?: boolean
          name?: string
          price_balance?: number
          price_saldo_in?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      premium_quest_progress: {
        Row: {
          claimed_at: string | null
          created_at: string
          current_value: number
          id: string
          is_completed: boolean
          period: string
          period_start: string
          quest_id: string
          updated_at: string
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          is_completed?: boolean
          period: string
          period_start: string
          quest_id: string
          updated_at?: string
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          is_completed?: boolean
          period?: string
          period_start?: string
          quest_id?: string
          updated_at?: string
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_quest_progress_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "premium_quests"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_quest_subscriptions: {
        Row: {
          admin_note: string | null
          created_at: string
          device_key: string | null
          duration_seconds: number | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          is_permanent: boolean
          plan_id: string | null
          plan_name: string
          price_paid_balance: number
          price_paid_saldo_in: number
          source: string
          starts_at: string
          updated_at: string
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          device_key?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          is_permanent?: boolean
          plan_id?: string | null
          plan_name: string
          price_paid_balance?: number
          price_paid_saldo_in?: number
          source?: string
          starts_at?: string
          updated_at?: string
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          device_key?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          is_permanent?: boolean
          plan_id?: string | null
          plan_name?: string
          price_paid_balance?: number
          price_paid_saldo_in?: number
          source?: string
          starts_at?: string
          updated_at?: string
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_quest_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "premium_quest_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_quest_trials: {
        Row: {
          claimed_at: string
          device_key: string
          id: string
          ip_address: string | null
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          claimed_at?: string
          device_key: string
          id?: string
          ip_address?: string | null
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          claimed_at?: string
          device_key?: string
          id?: string
          ip_address?: string | null
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      premium_quests: {
        Row: {
          created_at: string
          description: string
          difficulty: string
          ends_at: string | null
          filter_group: string
          icon: string
          id: string
          is_active: boolean
          is_premium_only: boolean
          is_pro_legend: boolean
          min_purchase_amount: number
          period: string
          quest_type: string
          reward_coins: number
          reward_gems: number
          reward_saldo_in: number
          sort_order: number
          starts_at: string | null
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          difficulty?: string
          ends_at?: string | null
          filter_group?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_premium_only?: boolean
          is_pro_legend?: boolean
          min_purchase_amount?: number
          period?: string
          quest_type: string
          reward_coins?: number
          reward_gems?: number
          reward_saldo_in?: number
          sort_order?: number
          starts_at?: string | null
          target_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: string
          ends_at?: string | null
          filter_group?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_premium_only?: boolean
          is_pro_legend?: boolean
          min_purchase_amount?: number
          period?: string
          quest_type?: string
          reward_coins?: number
          reward_gems?: number
          reward_saldo_in?: number
          sort_order?: number
          starts_at?: string | null
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      premium_spin_daily_milestones: {
        Row: {
          claimed_milestones: number[]
          created_at: string
          day_wib: string
          id: string
          spin_count: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          claimed_milestones?: number[]
          created_at?: string
          day_wib: string
          id?: string
          spin_count?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          claimed_milestones?: number[]
          created_at?: string
          day_wib?: string
          id?: string
          spin_count?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      product_chat_messages: {
        Row: {
          chat_id: string
          created_at: string
          deleted_at: string | null
          deleted_for: string[]
          id: string
          image_url: string | null
          is_deleted: boolean
          is_read: boolean
          message: string | null
          reply_to_id: string | null
          sender_type: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_read?: boolean
          message?: string | null
          reply_to_id?: string | null
          sender_type?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_read?: boolean
          message?: string | null
          reply_to_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "product_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "product_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      product_chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          sender_type: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          sender_type?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          sender_type?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "product_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      product_chat_typing: {
        Row: {
          chat_id: string
          is_typing: boolean
          sender_type: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          is_typing?: boolean
          sender_type: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          is_typing?: boolean
          sender_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_chat_typing_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "product_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      product_chats: {
        Row: {
          created_at: string
          id: string
          product_id: string
          status: string
          visitor_id: string
          visitor_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          status?: string
          visitor_id: string
          visitor_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          status?: string
          visitor_id?: string
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_chats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fields: {
        Row: {
          created_at: string
          field_name: string
          field_order: number
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          field_name: string
          field_order?: number
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          field_name?: string
          field_order?: number
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_fields_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_order: number
          image_url: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_order?: number
          image_url: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_order?: number
          image_url?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_wishlist: {
        Row: {
          created_at: string
          id: string
          last_price: number
          last_stock: number
          notify_price_drop: boolean
          notify_restock: boolean
          product_id: string
          target_price: number | null
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_price?: number
          last_stock?: number
          notify_price_drop?: boolean
          notify_restock?: boolean
          product_id: string
          target_price?: number | null
          updated_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_price?: number
          last_stock?: number
          notify_price_drop?: boolean
          notify_restock?: boolean
          product_id?: string
          target_price?: number | null
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          has_warranty: boolean
          id: string
          image_url: string | null
          price: number
          sold_count: number
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          has_warranty?: boolean
          id?: string
          image_url?: string | null
          price?: number
          sold_count?: number
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          has_warranty?: boolean
          id?: string
          image_url?: string | null
          price?: number
          sold_count?: number
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      public_songs: {
        Row: {
          admin_note: string | null
          ai_check_result: string | null
          artist: string
          cover_url: string | null
          created_at: string
          description: string | null
          duration: number | null
          file_size: number | null
          file_url: string
          id: string
          status: string
          title: string
          updated_at: string
          visibility: string
          visitor_id: string
        }
        Insert: {
          admin_note?: string | null
          ai_check_result?: string | null
          artist?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          file_size?: number | null
          file_url: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          visibility?: string
          visitor_id: string
        }
        Update: {
          admin_note?: string | null
          ai_check_result?: string | null
          artist?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration?: number | null
          file_size?: number | null
          file_url?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
          visitor_id?: string
        }
        Relationships: []
      }
      quest_song_completions: {
        Row: {
          completion_date: string
          created_at: string
          id: string
          seconds_played: number
          song_id: string
          visitor_id: string
        }
        Insert: {
          completion_date?: string
          created_at?: string
          id?: string
          seconds_played?: number
          song_id: string
          visitor_id: string
        }
        Update: {
          completion_date?: string
          created_at?: string
          id?: string
          seconds_played?: number
          song_id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      ruangku_luckybox_claims: {
        Row: {
          claim_date: string
          claimed_at: string
          id: string
          reward_label: string | null
          reward_type: string
          reward_value: number
          source: string
          visitor_id: string
        }
        Insert: {
          claim_date: string
          claimed_at?: string
          id?: string
          reward_label?: string | null
          reward_type?: string
          reward_value?: number
          source?: string
          visitor_id: string
        }
        Update: {
          claim_date?: string
          claimed_at?: string
          id?: string
          reward_label?: string | null
          reward_type?: string
          reward_value?: number
          source?: string
          visitor_id?: string
        }
        Relationships: []
      }
      ruangku_mission_claims: {
        Row: {
          claimed_at: string
          id: string
          mission_key: string
          reward_value: number
          visitor_id: string
          week_start: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          mission_key: string
          reward_value?: number
          visitor_id: string
          week_start: string
        }
        Update: {
          claimed_at?: string
          id?: string
          mission_key?: string
          reward_value?: number
          visitor_id?: string
          week_start?: string
        }
        Relationships: []
      }
      scratch_card_claims: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
          voucher_code: string | null
        }
        Insert: {
          claim_date?: string
          created_at?: string
          id?: string
          rarity?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          visitor_id: string
          voucher_code?: string | null
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
          voucher_code?: string | null
        }
        Relationships: []
      }
      scratch_off_cards: {
        Row: {
          created_at: string
          id: string
          is_scratched: boolean
          reward_amount: number | null
          scratched_at: string | null
          source: string | null
          tier: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_scratched?: boolean
          reward_amount?: number | null
          scratched_at?: string | null
          source?: string | null
          tier?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_scratched?: boolean
          reward_amount?: number | null
          scratched_at?: string | null
          source?: string | null
          tier?: string
          visitor_id?: string
        }
        Relationships: []
      }
      server_luck_boosters: {
        Row: {
          active_tier: number
          active_until: string | null
          created_at: string
          highest_tier_owned: number
          id: string
          total_purchases: number
          total_spent: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          active_tier?: number
          active_until?: string | null
          created_at?: string
          highest_tier_owned?: number
          id?: string
          total_purchases?: number
          total_spent?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          active_tier?: number
          active_until?: string | null
          created_at?: string
          highest_tier_owned?: number
          id?: string
          total_purchases?: number
          total_spent?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      server_luck_history: {
        Row: {
          created_at: string
          duration_hours: number
          id: string
          payment_source: string
          price: number
          tier: number
          visitor_id: string
        }
        Insert: {
          created_at?: string
          duration_hours: number
          id?: string
          payment_source?: string
          price: number
          tier: number
          visitor_id: string
        }
        Update: {
          created_at?: string
          duration_hours?: number
          id?: string
          payment_source?: string
          price?: number
          tier?: number
          visitor_id?: string
        }
        Relationships: []
      }
      slot_machine_history: {
        Row: {
          cost_credits: number
          created_at: string
          id: string
          payout_label: string
          payout_type: string
          payout_value: number
          reels: string[]
          visitor_id: string
          voucher_code: string | null
        }
        Insert: {
          cost_credits?: number
          created_at?: string
          id?: string
          payout_label?: string
          payout_type?: string
          payout_value?: number
          reels: string[]
          visitor_id: string
          voucher_code?: string | null
        }
        Update: {
          cost_credits?: number
          created_at?: string
          id?: string
          payout_label?: string
          payout_type?: string
          payout_value?: number
          reels?: string[]
          visitor_id?: string
          voucher_code?: string | null
        }
        Relationships: []
      }
      social_links: {
        Row: {
          color_from: string
          color_to: string
          created_at: string
          icon_url: string | null
          id: string
          is_active: boolean
          label: string
          platform: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          color_from?: string
          color_to?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          label: string
          platform: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          color_from?: string
          color_to?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          label?: string
          platform?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      song_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          id: string
          visitor_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji?: string
          id?: string
          visitor_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "song_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      song_comments: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          edited: boolean
          id: string
          message: string
          song_id: string
          song_type: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          edited?: boolean
          id?: string
          message: string
          song_id: string
          song_type?: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          edited?: boolean
          id?: string
          message?: string
          song_id?: string
          song_type?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      song_listening_log: {
        Row: {
          id: string
          listened_at: string
          seconds: number
          song_artist: string | null
          song_id: string
          song_title: string | null
          song_type: string
          visitor_id: string
        }
        Insert: {
          id?: string
          listened_at?: string
          seconds?: number
          song_artist?: string | null
          song_id: string
          song_title?: string | null
          song_type?: string
          visitor_id: string
        }
        Update: {
          id?: string
          listened_at?: string
          seconds?: number
          song_artist?: string | null
          song_id?: string
          song_title?: string | null
          song_type?: string
          visitor_id?: string
        }
        Relationships: []
      }
      song_lyrics: {
        Row: {
          created_at: string
          id: string
          line_order: number
          song_id: string
          text: string
          time_seconds: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_order?: number
          song_id: string
          text?: string
          time_seconds?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_order?: number
          song_id?: string
          text?: string
          time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "song_lyrics_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "playlist_songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          song_id: string
          song_type: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          song_id: string
          song_type?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          song_id?: string
          song_type?: string
          visitor_id?: string
        }
        Relationships: []
      }
      spin_wheel_history: {
        Row: {
          cost_coins: number
          created_at: string
          id: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          spin_date: string
          visitor_id: string
        }
        Insert: {
          cost_coins?: number
          created_at?: string
          id?: string
          rarity?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          spin_date?: string
          visitor_id: string
        }
        Update: {
          cost_coins?: number
          created_at?: string
          id?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          spin_date?: string
          visitor_id?: string
        }
        Relationships: []
      }
      sponsor_history: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          details: string | null
          id: string
          new_expires_at: string | null
          old_expires_at: string | null
          sponsor_id: string
        }
        Insert: {
          action?: string
          amount?: number | null
          created_at?: string
          details?: string | null
          id?: string
          new_expires_at?: string | null
          old_expires_at?: string | null
          sponsor_id: string
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          details?: string | null
          id?: string
          new_expires_at?: string | null
          old_expires_at?: string | null
          sponsor_id?: string
        }
        Relationships: []
      }
      sponsor_images: {
        Row: {
          created_at: string
          id: string
          image_order: number
          image_url: string
          sponsor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_order?: number
          image_url: string
          sponsor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_order?: number
          image_url?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_images_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          category: string
          created_at: string
          custom_note: string | null
          description: string | null
          duration_type: string
          duration_value: number
          expires_at: string | null
          facebook: string | null
          has_warranty: boolean
          id: string
          image_url: string | null
          instagram: string | null
          is_active: boolean
          price: number
          seller_contact: string
          seller_name: string
          sponsor_number: number
          starts_at: string
          stock: number
          threads: string | null
          tiktok: string | null
          title: string
          twitter: string | null
          updated_at: string
          view_count: number
          wa_number: string | null
          warranty_duration_type: string
          warranty_duration_value: number
        }
        Insert: {
          category?: string
          created_at?: string
          custom_note?: string | null
          description?: string | null
          duration_type?: string
          duration_value?: number
          expires_at?: string | null
          facebook?: string | null
          has_warranty?: boolean
          id?: string
          image_url?: string | null
          instagram?: string | null
          is_active?: boolean
          price?: number
          seller_contact?: string
          seller_name?: string
          sponsor_number?: number
          starts_at?: string
          stock?: number
          threads?: string | null
          tiktok?: string | null
          title: string
          twitter?: string | null
          updated_at?: string
          view_count?: number
          wa_number?: string | null
          warranty_duration_type?: string
          warranty_duration_value?: number
        }
        Update: {
          category?: string
          created_at?: string
          custom_note?: string | null
          description?: string | null
          duration_type?: string
          duration_value?: number
          expires_at?: string | null
          facebook?: string | null
          has_warranty?: boolean
          id?: string
          image_url?: string | null
          instagram?: string | null
          is_active?: boolean
          price?: number
          seller_contact?: string
          seller_name?: string
          sponsor_number?: number
          starts_at?: string
          stock?: number
          threads?: string | null
          tiktok?: string | null
          title?: string
          twitter?: string | null
          updated_at?: string
          view_count?: number
          wa_number?: string | null
          warranty_duration_type?: string
          warranty_duration_value?: number
        }
        Relationships: []
      }
      storage_packages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          storage_mb: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          storage_mb?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          storage_mb?: number
          updated_at?: string
        }
        Relationships: []
      }
      store_flash_sales: {
        Row: {
          created_at: string
          discount_percent: number | null
          ends_at: string
          flash_price: number | null
          id: string
          is_active: boolean
          mode: Database["public"]["Enums"]["flash_sale_mode"]
          product_id: string
          quota: number
          sold: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number | null
          ends_at: string
          flash_price?: number | null
          id?: string
          is_active?: boolean
          mode?: Database["public"]["Enums"]["flash_sale_mode"]
          product_id: string
          quota?: number
          sold?: number
          starts_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percent?: number | null
          ends_at?: string
          flash_price?: number | null
          id?: string
          is_active?: boolean
          mode?: Database["public"]["Enums"]["flash_sale_mode"]
          product_id?: string
          quota?: number
          sold?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_flash_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_followers: {
        Row: {
          created_at: string
          id: string
          user_balance_id: string
          username: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          user_balance_id: string
          username?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          user_balance_id?: string
          username?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      store_premium_plans: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      store_premium_subscriptions: {
        Row: {
          created_at: string
          duration_days: number
          expires_at: string
          id: string
          is_active: boolean
          lock_reason: string | null
          locked_until: string | null
          plan_id: string | null
          plan_name: string
          price_paid: number
          starts_at: string
          user_balance_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          duration_days: number
          expires_at: string
          id?: string
          is_active?: boolean
          lock_reason?: string | null
          locked_until?: string | null
          plan_id?: string | null
          plan_name: string
          price_paid: number
          starts_at?: string
          user_balance_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          lock_reason?: string | null
          locked_until?: string | null
          plan_id?: string | null
          plan_name?: string
          price_paid?: number
          starts_at?: string
          user_balance_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_premium_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "store_premium_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      store_premium_voucher_claims: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          user_balance_id: string | null
          visitor_id: string
          voucher_code: string
        }
        Insert: {
          claim_date: string
          created_at?: string
          id?: string
          user_balance_id?: string | null
          visitor_id: string
          voucher_code: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          user_balance_id?: string | null
          visitor_id?: string
          voucher_code?: string
        }
        Relationships: []
      }
      store_referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          total_reward: number
          user_balance_id: string
          uses_count: number
          visitor_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          total_reward?: number
          user_balance_id: string
          uses_count?: number
          visitor_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          total_reward?: number
          user_balance_id?: string
          uses_count?: number
          visitor_id?: string
        }
        Relationships: []
      }
      store_referral_uses: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_balance_id: string
          referred_visitor_id: string
          referrer_balance_id: string
          reward_amount: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_balance_id: string
          referred_visitor_id: string
          referrer_balance_id: string
          reward_amount?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_balance_id?: string
          referred_visitor_id?: string
          referrer_balance_id?: string
          reward_amount?: number
        }
        Relationships: []
      }
      streak_active_boosters: {
        Row: {
          booster_type: string
          created_at: string
          expires_at: string
          id: string
          metadata: Json
          visitor_id: string
        }
        Insert: {
          booster_type: string
          created_at?: string
          expires_at: string
          id?: string
          metadata?: Json
          visitor_id: string
        }
        Update: {
          booster_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          visitor_id?: string
        }
        Relationships: []
      }
      streak_auction_bids: {
        Row: {
          auction_id: string
          bid_amount: number
          created_at: string
          currency: string
          display_name: string
          id: string
          is_winner: boolean
          refunded: boolean
          visitor_id: string
        }
        Insert: {
          auction_id: string
          bid_amount: number
          created_at?: string
          currency?: string
          display_name?: string
          id?: string
          is_winner?: boolean
          refunded?: boolean
          visitor_id: string
        }
        Update: {
          auction_id?: string
          bid_amount?: number
          created_at?: string
          currency?: string
          display_name?: string
          id?: string
          is_winner?: boolean
          refunded?: boolean
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "streak_auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_auctions: {
        Row: {
          bid_currency: string
          created_at: string
          current_bid: number
          current_winner_name: string | null
          current_winner_visitor_id: string | null
          description: string
          ends_at: string
          icon: string
          id: string
          is_active: boolean
          min_increment: number
          name: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          starting_bid: number
          starts_at: string
          status: string
          total_bids: number
          updated_at: string
        }
        Insert: {
          bid_currency?: string
          created_at?: string
          current_bid?: number
          current_winner_name?: string | null
          current_winner_visitor_id?: string | null
          description?: string
          ends_at: string
          icon?: string
          id?: string
          is_active?: boolean
          min_increment?: number
          name: string
          rarity?: string
          reward_label?: string
          reward_type: string
          reward_value: number
          starting_bid?: number
          starts_at?: string
          status?: string
          total_bids?: number
          updated_at?: string
        }
        Update: {
          bid_currency?: string
          created_at?: string
          current_bid?: number
          current_winner_name?: string | null
          current_winner_visitor_id?: string | null
          description?: string
          ends_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          min_increment?: number
          name?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          starting_bid?: number
          starts_at?: string
          status?: string
          total_bids?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_auto_saver_subs: {
        Row: {
          auto_freeze_per_week: number
          created_at: string
          duration_days: number
          expires_at: string
          freezes_used_this_week: number
          id: string
          is_active: boolean
          price_idr: number
          restore_per_week: number
          restores_used_this_week: number
          tier: string
          visitor_id: string
          week_reset_at: string
        }
        Insert: {
          auto_freeze_per_week?: number
          created_at?: string
          duration_days: number
          expires_at: string
          freezes_used_this_week?: number
          id?: string
          is_active?: boolean
          price_idr: number
          restore_per_week?: number
          restores_used_this_week?: number
          tier: string
          visitor_id: string
          week_reset_at?: string
        }
        Update: {
          auto_freeze_per_week?: number
          created_at?: string
          duration_days?: number
          expires_at?: string
          freezes_used_this_week?: number
          id?: string
          is_active?: boolean
          price_idr?: number
          restore_per_week?: number
          restores_used_this_week?: number
          tier?: string
          visitor_id?: string
          week_reset_at?: string
        }
        Relationships: []
      }
      streak_avatar_stages: {
        Row: {
          color_from: string
          color_to: string
          created_at: string
          emoji: string
          id: string
          is_active: boolean
          min_streak: number
          stage_name: string
        }
        Insert: {
          color_from?: string
          color_to?: string
          created_at?: string
          emoji?: string
          id?: string
          is_active?: boolean
          min_streak: number
          stage_name: string
        }
        Update: {
          color_from?: string
          color_to?: string
          created_at?: string
          emoji?: string
          id?: string
          is_active?: boolean
          min_streak?: number
          stage_name?: string
        }
        Relationships: []
      }
      streak_battle_pass_progress: {
        Row: {
          claimed_free_tiers: number[]
          claimed_premium_tiers: number[]
          created_at: string
          id: string
          is_premium: boolean
          premium_payment_method: string
          premium_purchased_at: string | null
          season_id: string
          total_spent_coins: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          claimed_free_tiers?: number[]
          claimed_premium_tiers?: number[]
          created_at?: string
          id?: string
          is_premium?: boolean
          premium_payment_method?: string
          premium_purchased_at?: string | null
          season_id: string
          total_spent_coins?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          claimed_free_tiers?: number[]
          claimed_premium_tiers?: number[]
          created_at?: string
          id?: string
          is_premium?: boolean
          premium_payment_method?: string
          premium_purchased_at?: string | null
          season_id?: string
          total_spent_coins?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_battle_pass_progress_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "streak_battle_pass_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_battle_pass_seasons: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          id: string
          is_active: boolean
          name: string
          premium_cost_coins: number
          premium_cost_gems: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          name: string
          premium_cost_coins?: number
          premium_cost_gems?: number
          starts_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          premium_cost_coins?: number
          premium_cost_gems?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      streak_battle_pass_tiers: {
        Row: {
          created_at: string
          free_reward_icon: string
          free_reward_label: string
          free_reward_type: string
          free_reward_value: number
          id: string
          premium_reward_icon: string
          premium_reward_label: string
          premium_reward_type: string
          premium_reward_value: number
          required_spent_coins: number
          season_id: string
          tier_number: number
        }
        Insert: {
          created_at?: string
          free_reward_icon?: string
          free_reward_label?: string
          free_reward_type?: string
          free_reward_value?: number
          id?: string
          premium_reward_icon?: string
          premium_reward_label?: string
          premium_reward_type?: string
          premium_reward_value?: number
          required_spent_coins?: number
          season_id: string
          tier_number: number
        }
        Update: {
          created_at?: string
          free_reward_icon?: string
          free_reward_label?: string
          free_reward_type?: string
          free_reward_value?: number
          id?: string
          premium_reward_icon?: string
          premium_reward_label?: string
          premium_reward_type?: string
          premium_reward_value?: number
          required_spent_coins?: number
          season_id?: string
          tier_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "streak_battle_pass_tiers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "streak_battle_pass_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_battles: {
        Row: {
          bet_gems: number
          challenger_id: string
          challenger_score: number
          created_at: string
          expires_at: string
          id: string
          opponent_id: string | null
          opponent_score: number
          prize_gems: number
          resolved_at: string | null
          status: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          bet_gems?: number
          challenger_id: string
          challenger_score?: number
          created_at?: string
          expires_at?: string
          id?: string
          opponent_id?: string | null
          opponent_score?: number
          prize_gems?: number
          resolved_at?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          bet_gems?: number
          challenger_id?: string
          challenger_score?: number
          created_at?: string
          expires_at?: string
          id?: string
          opponent_id?: string | null
          opponent_score?: number
          prize_gems?: number
          resolved_at?: string | null
          status?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      streak_boost_squad_subs: {
        Row: {
          created_at: string
          duration_days: number
          expires_at: string
          id: string
          is_active: boolean
          multiplier: number
          price_idr: number
          tier: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          duration_days: number
          expires_at: string
          id?: string
          is_active?: boolean
          multiplier?: number
          price_idr: number
          tier: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          multiplier?: number
          price_idr?: number
          tier?: string
          visitor_id?: string
        }
        Relationships: []
      }
      streak_boss_raid_attacks: {
        Row: {
          attack_count: number
          coins_spent: number
          created_at: string
          damage_dealt: number
          display_name: string
          id: string
          raid_id: string
          total_damage: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          attack_count?: number
          coins_spent?: number
          created_at?: string
          damage_dealt?: number
          display_name?: string
          id?: string
          raid_id: string
          total_damage?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          attack_count?: number
          coins_spent?: number
          created_at?: string
          damage_dealt?: number
          display_name?: string
          id?: string
          raid_id?: string
          total_damage?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_boss_raid_attacks_raid_id_fkey"
            columns: ["raid_id"]
            isOneToOne: false
            referencedRelation: "streak_boss_raids"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_boss_raid_rewards: {
        Row: {
          claimed_at: string
          contribution_pct: number | null
          id: string
          raid_id: string
          rank_position: number | null
          reward_coins: number
          visitor_id: string
        }
        Insert: {
          claimed_at?: string
          contribution_pct?: number | null
          id?: string
          raid_id: string
          rank_position?: number | null
          reward_coins?: number
          visitor_id: string
        }
        Update: {
          claimed_at?: string
          contribution_pct?: number | null
          id?: string
          raid_id?: string
          rank_position?: number | null
          reward_coins?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_boss_raid_rewards_raid_id_fkey"
            columns: ["raid_id"]
            isOneToOne: false
            referencedRelation: "streak_boss_raids"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_boss_raids: {
        Row: {
          attack_cost_coins: number
          boss_description: string
          boss_emoji: string
          boss_image_url: string | null
          boss_name: string
          created_at: string
          current_hp: number
          damage_per_attack: number
          ends_at: string
          id: string
          is_active: boolean
          participation_reward: number
          starts_at: string
          status: string
          total_hp: number
          updated_at: string
          victory_reward_pool: number
        }
        Insert: {
          attack_cost_coins?: number
          boss_description?: string
          boss_emoji?: string
          boss_image_url?: string | null
          boss_name: string
          created_at?: string
          current_hp?: number
          damage_per_attack?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          participation_reward?: number
          starts_at?: string
          status?: string
          total_hp?: number
          updated_at?: string
          victory_reward_pool?: number
        }
        Update: {
          attack_cost_coins?: number
          boss_description?: string
          boss_emoji?: string
          boss_image_url?: string | null
          boss_name?: string
          created_at?: string
          current_hp?: number
          damage_per_attack?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          participation_reward?: number
          starts_at?: string
          status?: string
          total_hp?: number
          updated_at?: string
          victory_reward_pool?: number
        }
        Relationships: []
      }
      streak_coin_packages: {
        Row: {
          coins: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          coins?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          coins?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_community_boss_attacks: {
        Row: {
          boss_id: string
          cost_paid: number
          created_at: string
          damage_dealt: number
          id: string
          is_killing_blow: boolean
          visitor_id: string
        }
        Insert: {
          boss_id: string
          cost_paid?: number
          created_at?: string
          damage_dealt?: number
          id?: string
          is_killing_blow?: boolean
          visitor_id: string
        }
        Update: {
          boss_id?: string
          cost_paid?: number
          created_at?: string
          damage_dealt?: number
          id?: string
          is_killing_blow?: boolean
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_community_boss_attacks_boss_id_fkey"
            columns: ["boss_id"]
            isOneToOne: false
            referencedRelation: "streak_community_bosses"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_community_bosses: {
        Row: {
          attack_cost_coins: number
          attack_damage_max: number
          attack_damage_min: number
          created_at: string
          current_hp: number
          description: string
          ends_at: string
          icon: string
          id: string
          is_active: boolean
          is_defeated: boolean
          max_hp: number
          name: string
          reward_coins: number
          reward_gems: number
          reward_label: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          attack_cost_coins?: number
          attack_damage_max?: number
          attack_damage_min?: number
          created_at?: string
          current_hp?: number
          description?: string
          ends_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_defeated?: boolean
          max_hp?: number
          name: string
          reward_coins?: number
          reward_gems?: number
          reward_label?: string
          starts_at?: string
          updated_at?: string
        }
        Update: {
          attack_cost_coins?: number
          attack_damage_max?: number
          attack_damage_min?: number
          created_at?: string
          current_hp?: number
          description?: string
          ends_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_defeated?: boolean
          max_hp?: number
          name?: string
          reward_coins?: number
          reward_gems?: number
          reward_label?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      streak_daily_mystery_boxes: {
        Row: {
          cost_coins: number
          cost_gems: number
          created_at: string
          daily_limit: number
          description: string
          icon: string
          id: string
          is_active: boolean
          is_free: boolean
          name: string
          rarity: string
          reward_pool: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          daily_limit?: number
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_free?: boolean
          name: string
          rarity?: string
          reward_pool?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          daily_limit?: number
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_free?: boolean
          name?: string
          rarity?: string
          reward_pool?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_daily_mystery_claims: {
        Row: {
          box_id: string
          claim_date: string
          cost_paid: number
          created_at: string
          id: string
          payment_method: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          box_id: string
          claim_date?: string
          cost_paid?: number
          created_at?: string
          id?: string
          payment_method?: string
          rarity?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          box_id?: string
          claim_date?: string
          cost_paid?: number
          created_at?: string
          id?: string
          payment_method?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_daily_mystery_claims_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "streak_daily_mystery_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_diamond_elite_subs: {
        Row: {
          cashback_percent: number
          created_at: string
          duration_days: number
          expires_at: string
          id: string
          is_active: boolean
          price_idr: number
          tier: string
          total_cashback_earned: number
          visitor_id: string
        }
        Insert: {
          cashback_percent?: number
          created_at?: string
          duration_days?: number
          expires_at: string
          id?: string
          is_active?: boolean
          price_idr: number
          tier?: string
          total_cashback_earned?: number
          visitor_id: string
        }
        Update: {
          cashback_percent?: number
          created_at?: string
          duration_days?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          price_idr?: number
          tier?: string
          total_cashback_earned?: number
          visitor_id?: string
        }
        Relationships: []
      }
      streak_discount_vouchers: {
        Row: {
          code: string
          created_at: string
          discount_amount: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_amount?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_amount?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Relationships: []
      }
      streak_event_calendar: {
        Row: {
          bonus_value: number
          color_theme: string
          created_at: string
          day_of_week: number
          event_description: string
          event_icon: string
          event_name: string
          event_type: string
          id: string
          is_active: boolean
          multiplier: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus_value?: number
          color_theme?: string
          created_at?: string
          day_of_week: number
          event_description?: string
          event_icon?: string
          event_name: string
          event_type?: string
          id?: string
          is_active?: boolean
          multiplier?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus_value?: number
          color_theme?: string
          created_at?: string
          day_of_week?: number
          event_description?: string
          event_icon?: string
          event_name?: string
          event_type?: string
          id?: string
          is_active?: boolean
          multiplier?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_flash_deals: {
        Row: {
          badge: string | null
          cost_gems: number
          created_at: string
          daily_limit: number
          description: string
          discount_pct: number
          gradient: string
          icon: string
          id: string
          is_active: boolean
          name: string
          original_cost: number
          requires_premium: boolean
          reward_type: string
          reward_value: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          badge?: string | null
          cost_gems?: number
          created_at?: string
          daily_limit?: number
          description?: string
          discount_pct?: number
          gradient?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          original_cost?: number
          requires_premium?: boolean
          reward_type: string
          reward_value?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          badge?: string | null
          cost_gems?: number
          created_at?: string
          daily_limit?: number
          description?: string
          discount_pct?: number
          gradient?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          original_cost?: number
          requires_premium?: boolean
          reward_type?: string
          reward_value?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_flash_sale_purchases: {
        Row: {
          amount_paid: number
          created_at: string
          currency: string
          deal_id: string
          id: string
          purchase_date: string
          reward_payload: Json
          visitor_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          currency: string
          deal_id: string
          id?: string
          purchase_date?: string
          reward_payload?: Json
          visitor_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          currency?: string
          deal_id?: string
          id?: string
          purchase_date?: string
          reward_payload?: Json
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_flash_sale_purchases_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "streak_flash_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_flash_sales: {
        Row: {
          created_at: string
          description: string | null
          discount_pct: number | null
          ends_at: string | null
          gradient: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          item_type: string
          name: string
          original_price: number | null
          per_user_daily_limit: number | null
          price_balance: number | null
          price_coins: number | null
          price_gems: number | null
          rarity: string | null
          remaining_stock: number | null
          reward_payload: Json
          sort_order: number | null
          starts_at: string
          total_stock: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_pct?: number | null
          ends_at?: string | null
          gradient?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          item_type: string
          name: string
          original_price?: number | null
          per_user_daily_limit?: number | null
          price_balance?: number | null
          price_coins?: number | null
          price_gems?: number | null
          rarity?: string | null
          remaining_stock?: number | null
          reward_payload?: Json
          sort_order?: number | null
          starts_at?: string
          total_stock?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_pct?: number | null
          ends_at?: string | null
          gradient?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          item_type?: string
          name?: string
          original_price?: number | null
          per_user_daily_limit?: number | null
          price_balance?: number | null
          price_coins?: number | null
          price_gems?: number | null
          rarity?: string | null
          remaining_stock?: number | null
          reward_payload?: Json
          sort_order?: number | null
          starts_at?: string
          total_stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      streak_group_buy_items: {
        Row: {
          base_cost_coins: number
          base_cost_gems: number
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          reward_label: string
          reward_type: string
          reward_value: number
          sort_order: number
          tier1_buyers: number
          tier1_discount_pct: number
          tier2_buyers: number
          tier2_discount_pct: number
          tier3_buyers: number
          tier3_discount_pct: number
          updated_at: string
        }
        Insert: {
          base_cost_coins?: number
          base_cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          sort_order?: number
          tier1_buyers?: number
          tier1_discount_pct?: number
          tier2_buyers?: number
          tier2_discount_pct?: number
          tier3_buyers?: number
          tier3_discount_pct?: number
          updated_at?: string
        }
        Update: {
          base_cost_coins?: number
          base_cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          sort_order?: number
          tier1_buyers?: number
          tier1_discount_pct?: number
          tier2_buyers?: number
          tier2_discount_pct?: number
          tier3_buyers?: number
          tier3_discount_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_group_buy_purchases: {
        Row: {
          cost_paid: number
          created_at: string
          discount_pct_applied: number
          id: string
          item_id: string
          payment_method: string
          purchase_date: string
          visitor_id: string
        }
        Insert: {
          cost_paid: number
          created_at?: string
          discount_pct_applied?: number
          id?: string
          item_id: string
          payment_method?: string
          purchase_date?: string
          visitor_id: string
        }
        Update: {
          cost_paid?: number
          created_at?: string
          discount_pct_applied?: number
          id?: string
          item_id?: string
          payment_method?: string
          purchase_date?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_group_buy_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "streak_group_buy_items"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_limited_skins: {
        Row: {
          cost_coins: number
          cost_gems: number
          created_at: string
          description: string
          emoji_fallback: string
          ends_at: string
          id: string
          image_url: string
          is_active: boolean
          name: string
          rarity: string
          skin_type: string
          sold_count: number
          sort_order: number
          starts_at: string
          total_stock: number
          updated_at: string
        }
        Insert: {
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          description?: string
          emoji_fallback?: string
          ends_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          name: string
          rarity?: string
          skin_type?: string
          sold_count?: number
          sort_order?: number
          starts_at?: string
          total_stock?: number
          updated_at?: string
        }
        Update: {
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          description?: string
          emoji_fallback?: string
          ends_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          rarity?: string
          skin_type?: string
          sold_count?: number
          sort_order?: number
          starts_at?: string
          total_stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_loyalty_progress: {
        Row: {
          created_at: string
          current_tier_key: string
          id: string
          last_monthly_claim_month: string | null
          lifetime_spent_coins: number
          total_monthly_claims: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          current_tier_key?: string
          id?: string
          last_monthly_claim_month?: string | null
          lifetime_spent_coins?: number
          total_monthly_claims?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          current_tier_key?: string
          id?: string
          last_monthly_claim_month?: string | null
          lifetime_spent_coins?: number
          total_monthly_claims?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      streak_loyalty_tiers: {
        Row: {
          color: string
          created_at: string
          discount_pct: number
          icon: string
          id: string
          monthly_coins_reward: number
          monthly_freeze_reward: number
          monthly_gems_reward: number
          perks: Json
          required_lifetime_spent: number
          tier_key: string
          tier_name: string
          tier_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          discount_pct?: number
          icon?: string
          id?: string
          monthly_coins_reward?: number
          monthly_freeze_reward?: number
          monthly_gems_reward?: number
          perks?: Json
          required_lifetime_spent?: number
          tier_key: string
          tier_name: string
          tier_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          discount_pct?: number
          icon?: string
          id?: string
          monthly_coins_reward?: number
          monthly_freeze_reward?: number
          monthly_gems_reward?: number
          perks?: Json
          required_lifetime_spent?: number
          tier_key?: string
          tier_name?: string
          tier_order?: number
        }
        Relationships: []
      }
      streak_lucky_box_claims: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          rewards: Json
          sub_id: string
          visitor_id: string
        }
        Insert: {
          claim_date: string
          created_at?: string
          id?: string
          rewards?: Json
          sub_id: string
          visitor_id: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          rewards?: Json
          sub_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_lucky_box_claims_sub_id_fkey"
            columns: ["sub_id"]
            isOneToOne: false
            referencedRelation: "streak_lucky_box_subs"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_lucky_box_subs: {
        Row: {
          created_at: string
          duration_days: number
          effective_from: string | null
          expires_at: string
          id: string
          is_active: boolean
          price_idr: number
          tier: string
          total_days_claimed: number
          visitor_id: string
        }
        Insert: {
          created_at?: string
          duration_days: number
          effective_from?: string | null
          expires_at: string
          id?: string
          is_active?: boolean
          price_idr: number
          tier: string
          total_days_claimed?: number
          visitor_id: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          effective_from?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          price_idr?: number
          tier?: string
          total_days_claimed?: number
          visitor_id?: string
        }
        Relationships: []
      }
      streak_membership_daily_claims: {
        Row: {
          claim_date: string
          coins_awarded: number
          created_at: string
          id: string
          membership_id: string | null
          plan_id: string | null
          plan_name: string | null
          visitor_id: string
        }
        Insert: {
          claim_date: string
          coins_awarded?: number
          created_at?: string
          id?: string
          membership_id?: string | null
          plan_id?: string | null
          plan_name?: string | null
          visitor_id: string
        }
        Update: {
          claim_date?: string
          coins_awarded?: number
          created_at?: string
          id?: string
          membership_id?: string | null
          plan_id?: string | null
          plan_name?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      streak_membership_daily_gem_claims: {
        Row: {
          claim_date: string
          created_at: string
          gems_awarded: number
          id: string
          membership_id: string | null
          plan_id: string | null
          plan_name: string | null
          visitor_id: string
        }
        Insert: {
          claim_date: string
          created_at?: string
          gems_awarded?: number
          id?: string
          membership_id?: string | null
          plan_id?: string | null
          plan_name?: string | null
          visitor_id: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          gems_awarded?: number
          id?: string
          membership_id?: string | null
          plan_id?: string | null
          plan_name?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      streak_membership_plans: {
        Row: {
          badge_color: string
          bonus_daily_gems: number
          bonus_freeze_count: number
          bonus_gems: number
          bonus_multiplier: number
          bonus_streak_coins: number
          category: string
          created_at: string
          daily_reward_coins: number
          description: string
          duration_days: number
          icon: string
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          price_coins: number
          price_gems: number
          price_idr: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          badge_color?: string
          bonus_daily_gems?: number
          bonus_freeze_count?: number
          bonus_gems?: number
          bonus_multiplier?: number
          bonus_streak_coins?: number
          category?: string
          created_at?: string
          daily_reward_coins?: number
          description?: string
          duration_days?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          price_coins?: number
          price_gems?: number
          price_idr?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          badge_color?: string
          bonus_daily_gems?: number
          bonus_freeze_count?: number
          bonus_gems?: number
          bonus_multiplier?: number
          bonus_streak_coins?: number
          category?: string
          created_at?: string
          daily_reward_coins?: number
          description?: string
          duration_days?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price_coins?: number
          price_gems?: number
          price_idr?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_milestone_claims: {
        Row: {
          claimed_at: string
          id: string
          milestone_id: string
          visitor_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          milestone_id: string
          visitor_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          milestone_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_milestone_claims_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "streak_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_milestones: {
        Row: {
          badge_icon: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          milestone_days: number
          reward_type: string
          reward_value: number
          title: string
          updated_at: string
        }
        Insert: {
          badge_icon?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          milestone_days: number
          reward_type?: string
          reward_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          badge_icon?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          milestone_days?: number
          reward_type?: string
          reward_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      streak_mini_event_progress: {
        Row: {
          claimed_at: string | null
          created_at: string
          current_value: number
          event_id: string
          id: string
          is_claimed: boolean
          updated_at: string
          visitor_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          event_id: string
          id?: string
          is_claimed?: boolean
          updated_at?: string
          visitor_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          event_id?: string
          id?: string
          is_claimed?: boolean
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_mini_event_progress_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "streak_mini_events"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_mini_events: {
        Row: {
          created_at: string
          description: string
          ends_at: string
          event_type: string
          icon: string
          id: string
          is_active: boolean
          name: string
          reward_coins: number
          reward_gems: number
          reward_label: string
          sort_order: number
          starts_at: string
          target_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          ends_at?: string
          event_type?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          reward_coins?: number
          reward_gems?: number
          reward_label?: string
          sort_order?: number
          starts_at?: string
          target_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string
          event_type?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          reward_coins?: number
          reward_gems?: number
          reward_label?: string
          sort_order?: number
          starts_at?: string
          target_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_mystery_boxes: {
        Row: {
          cost_balance: number
          cost_coins: number
          cost_gems: number
          created_at: string
          daily_limit: number
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          rarity: string
          reward_pool: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          cost_balance?: number
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          daily_limit?: number
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          rarity?: string
          reward_pool?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cost_balance?: number
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          daily_limit?: number
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          rarity?: string
          reward_pool?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_mystery_openings: {
        Row: {
          box_id: string
          cost_paid: number
          created_at: string
          id: string
          opened_date: string
          payment_method: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
          voucher_code: string | null
        }
        Insert: {
          box_id: string
          cost_paid: number
          created_at?: string
          id?: string
          opened_date?: string
          payment_method: string
          rarity?: string
          reward_label?: string
          reward_type: string
          reward_value: number
          visitor_id: string
          voucher_code?: string | null
        }
        Update: {
          box_id?: string
          cost_paid?: number
          created_at?: string
          id?: string
          opened_date?: string
          payment_method?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
          voucher_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streak_mystery_openings_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "streak_mystery_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_packages: {
        Row: {
          created_at: string
          days: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_pass_progress: {
        Row: {
          claimed_free_tiers: number[]
          claimed_premium_tiers: number[]
          created_at: string
          id: string
          is_premium: boolean
          premium_purchased_at: string | null
          season_id: string
          total_xp: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          claimed_free_tiers?: number[]
          claimed_premium_tiers?: number[]
          created_at?: string
          id?: string
          is_premium?: boolean
          premium_purchased_at?: string | null
          season_id: string
          total_xp?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          claimed_free_tiers?: number[]
          claimed_premium_tiers?: number[]
          created_at?: string
          id?: string
          is_premium?: boolean
          premium_purchased_at?: string | null
          season_id?: string
          total_xp?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_pass_progress_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "streak_pass_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_pass_seasons: {
        Row: {
          created_at: string
          description: string
          ends_at: string
          id: string
          is_active: boolean
          name: string
          premium_price: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          ends_at: string
          id?: string
          is_active?: boolean
          name: string
          premium_price?: number
          starts_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          premium_price?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      streak_pass_tiers: {
        Row: {
          created_at: string
          free_reward_icon: string | null
          free_reward_label: string | null
          free_reward_type: string | null
          free_reward_value: number | null
          id: string
          premium_reward_icon: string | null
          premium_reward_label: string | null
          premium_reward_type: string | null
          premium_reward_value: number | null
          season_id: string
          tier_level: number
          xp_required: number
        }
        Insert: {
          created_at?: string
          free_reward_icon?: string | null
          free_reward_label?: string | null
          free_reward_type?: string | null
          free_reward_value?: number | null
          id?: string
          premium_reward_icon?: string | null
          premium_reward_label?: string | null
          premium_reward_type?: string | null
          premium_reward_value?: number | null
          season_id: string
          tier_level: number
          xp_required?: number
        }
        Update: {
          created_at?: string
          free_reward_icon?: string | null
          free_reward_label?: string | null
          free_reward_type?: string | null
          free_reward_value?: number | null
          id?: string
          premium_reward_icon?: string | null
          premium_reward_label?: string | null
          premium_reward_type?: string | null
          premium_reward_value?: number | null
          season_id?: string
          tier_level?: number
          xp_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "streak_pass_tiers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "streak_pass_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_power_hour_claims: {
        Row: {
          bonus_coins: number
          claim_date: string
          created_at: string
          hour_claimed: number
          hour_target: number
          id: string
          success: boolean
          visitor_id: string
        }
        Insert: {
          bonus_coins?: number
          claim_date: string
          created_at?: string
          hour_claimed: number
          hour_target: number
          id?: string
          success?: boolean
          visitor_id: string
        }
        Update: {
          bonus_coins?: number
          claim_date?: string
          created_at?: string
          hour_claimed?: number
          hour_target?: number
          id?: string
          success?: boolean
          visitor_id?: string
        }
        Relationships: []
      }
      streak_power_hour_schedule: {
        Row: {
          created_at: string
          hour_start: number
          id: string
          schedule_date: string
        }
        Insert: {
          created_at?: string
          hour_start: number
          id?: string
          schedule_date: string
        }
        Update: {
          created_at?: string
          hour_start?: number
          id?: string
          schedule_date?: string
        }
        Relationships: []
      }
      streak_power_pack_claims: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          is_instant: boolean
          items_awarded: Json
          pack_id: string | null
          subscription_id: string | null
          visitor_id: string
        }
        Insert: {
          claim_date?: string
          created_at?: string
          id?: string
          is_instant?: boolean
          items_awarded?: Json
          pack_id?: string | null
          subscription_id?: string | null
          visitor_id: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          is_instant?: boolean
          items_awarded?: Json
          pack_id?: string | null
          subscription_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_power_pack_claims_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "streak_power_pack_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_power_pack_inventory: {
        Row: {
          id: string
          item_code: string
          quantity: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          id?: string
          item_code: string
          quantity?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          id?: string
          item_code?: string
          quantity?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      streak_power_pack_items: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          rarity: string
          sort_order: number
          updated_at: string
          weight: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          rarity?: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          rarity?: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      streak_power_pack_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          pack_id: string
          pack_name: string
          starts_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          is_active?: boolean
          pack_id: string
          pack_name: string
          starts_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          pack_id?: string
          pack_name?: string
          starts_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_power_pack_subscriptions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "streak_power_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_power_packs: {
        Row: {
          badge_color: string
          created_at: string
          daily_item_max: number
          daily_item_min: number
          description: string | null
          duration_days: number
          icon: string
          id: string
          instant_full_pack: boolean
          instant_item_count: number
          is_active: boolean
          is_featured: boolean
          name: string
          price_idr: number
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          badge_color?: string
          created_at?: string
          daily_item_max?: number
          daily_item_min?: number
          description?: string | null
          duration_days?: number
          icon?: string
          id?: string
          instant_full_pack?: boolean
          instant_item_count?: number
          is_active?: boolean
          is_featured?: boolean
          name: string
          price_idr?: number
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          badge_color?: string
          created_at?: string
          daily_item_max?: number
          daily_item_min?: number
          description?: string | null
          duration_days?: number
          icon?: string
          id?: string
          instant_full_pack?: boolean
          instant_item_count?: number
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price_idr?: number
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      streak_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          updated_at: string
          username: string
          visitor_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          username: string
          visitor_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          username?: string
          visitor_id?: string
        }
        Relationships: []
      }
      streak_referral_codes: {
        Row: {
          created_at: string
          display_name: string
          id: string
          referral_code: string
          total_coins_earned: number
          total_gems_earned: number
          total_referred: number
          visitor_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          referral_code: string
          total_coins_earned?: number
          total_gems_earned?: number
          total_referred?: number
          visitor_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          referral_code?: string
          total_coins_earned?: number
          total_gems_earned?: number
          total_referred?: number
          visitor_id?: string
        }
        Relationships: []
      }
      streak_referral_uses: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_visitor_id: string
          referrer_visitor_id: string
          reward_coins_to_referred: number
          reward_coins_to_referrer: number
          reward_gems_to_referred: number
          reward_gems_to_referrer: number
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_visitor_id: string
          referrer_visitor_id: string
          reward_coins_to_referred?: number
          reward_coins_to_referrer?: number
          reward_gems_to_referred?: number
          reward_gems_to_referrer?: number
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_visitor_id?: string
          referrer_visitor_id?: string
          reward_coins_to_referred?: number
          reward_coins_to_referrer?: number
          reward_gems_to_referred?: number
          reward_gems_to_referrer?: number
        }
        Relationships: []
      }
      streak_reminders: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          last_notified_date: string | null
          notify_browser: boolean
          preferred_hour: number
          preferred_minute: number
          smart_mode: boolean
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_notified_date?: string | null
          notify_browser?: boolean
          preferred_hour?: number
          preferred_minute?: number
          smart_mode?: boolean
          updated_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_notified_date?: string | null
          notify_browser?: boolean
          preferred_hour?: number
          preferred_minute?: number
          smart_mode?: boolean
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      streak_rewards_log: {
        Row: {
          claim_date: string
          created_at: string
          id: string
          rarity: string
          reward_emoji: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          claim_date?: string
          created_at?: string
          id?: string
          rarity?: string
          reward_emoji?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          claim_date?: string
          created_at?: string
          id?: string
          rarity?: string
          reward_emoji?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: []
      }
      streak_rotating_shop_active: {
        Row: {
          created_at: string
          daily_limit: number
          discount_pct: number
          id: string
          item_id: string
          rotation_date: string
          slot_order: number
        }
        Insert: {
          created_at?: string
          daily_limit?: number
          discount_pct?: number
          id?: string
          item_id: string
          rotation_date?: string
          slot_order?: number
        }
        Update: {
          created_at?: string
          daily_limit?: number
          discount_pct?: number
          id?: string
          item_id?: string
          rotation_date?: string
          slot_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "streak_rotating_shop_active_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "streak_rotating_shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_rotating_shop_items: {
        Row: {
          base_cost_coins: number
          base_cost_gems: number
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          rarity: string
          reward_label: string
          reward_type: string
          reward_value: number
          updated_at: string
        }
        Insert: {
          base_cost_coins?: number
          base_cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          rarity?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          updated_at?: string
        }
        Update: {
          base_cost_coins?: number
          base_cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_rotating_shop_purchases: {
        Row: {
          active_id: string
          cost_paid: number
          created_at: string
          id: string
          item_id: string
          payment_method: string
          purchase_date: string
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          active_id: string
          cost_paid?: number
          created_at?: string
          id?: string
          item_id: string
          payment_method?: string
          purchase_date?: string
          reward_label?: string
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          active_id?: string
          cost_paid?: number
          created_at?: string
          id?: string
          item_id?: string
          payment_method?: string
          purchase_date?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_rotating_shop_purchases_active_id_fkey"
            columns: ["active_id"]
            isOneToOne: false
            referencedRelation: "streak_rotating_shop_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streak_rotating_shop_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "streak_rotating_shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_shop_items: {
        Row: {
          cost_coins: number
          cost_gems: number
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          reward_type: string
          reward_value: number
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          reward_type: string
          reward_value?: number
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          reward_type?: string
          reward_value?: number
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_shop_redemptions: {
        Row: {
          cost_coins: number
          created_at: string
          id: string
          item_id: string
          reward_code: string | null
          reward_type: string
          reward_value: number
          visitor_id: string
        }
        Insert: {
          cost_coins?: number
          created_at?: string
          id?: string
          item_id: string
          reward_code?: string | null
          reward_type: string
          reward_value?: number
          visitor_id: string
        }
        Update: {
          cost_coins?: number
          created_at?: string
          id?: string
          item_id?: string
          reward_code?: string | null
          reward_type?: string
          reward_value?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_shop_redemptions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "streak_shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_skin_purchases: {
        Row: {
          cost_paid: number
          created_at: string
          id: string
          is_equipped: boolean
          payment_method: string
          skin_id: string
          visitor_id: string
        }
        Insert: {
          cost_paid: number
          created_at?: string
          id?: string
          is_equipped?: boolean
          payment_method?: string
          skin_id: string
          visitor_id: string
        }
        Update: {
          cost_paid?: number
          created_at?: string
          id?: string
          is_equipped?: boolean
          payment_method?: string
          skin_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_skin_purchases_skin_id_fkey"
            columns: ["skin_id"]
            isOneToOne: false
            referencedRelation: "streak_limited_skins"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          plan_days: number
          plan_name: string
          price_paid: number
          starts_at: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          is_active?: boolean
          plan_days: number
          plan_name: string
          price_paid?: number
          starts_at?: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          plan_days?: number
          plan_name?: string
          price_paid?: number
          starts_at?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      streak_tradein_history: {
        Row: {
          created_at: string
          id: string
          input_amount: number
          input_type: string
          output_amount: number
          output_type: string
          recipe_id: string
          trade_date: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_amount: number
          input_type: string
          output_amount: number
          output_type: string
          recipe_id: string
          trade_date?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_amount?: number
          input_type?: string
          output_amount?: number
          output_type?: string
          recipe_id?: string
          trade_date?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_tradein_history_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "streak_tradein_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_tradein_recipes: {
        Row: {
          created_at: string
          daily_limit: number
          description: string
          icon: string
          id: string
          input_amount: number
          input_type: string
          is_active: boolean
          name: string
          output_amount: number
          output_label: string
          output_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_limit?: number
          description?: string
          icon?: string
          id?: string
          input_amount?: number
          input_type: string
          is_active?: boolean
          name: string
          output_amount?: number
          output_label?: string
          output_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_limit?: number
          description?: string
          icon?: string
          id?: string
          input_amount?: number
          input_type?: string
          is_active?: boolean
          name?: string
          output_amount?: number
          output_label?: string
          output_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_user_memberships: {
        Row: {
          amount_paid: number
          bonus_multiplier: number
          created_at: string
          duration_days: number
          expires_at: string
          id: string
          is_active: boolean
          payment_method: string
          plan_id: string | null
          plan_name: string
          starts_at: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          amount_paid?: number
          bonus_multiplier?: number
          created_at?: string
          duration_days: number
          expires_at: string
          id?: string
          is_active?: boolean
          payment_method: string
          plan_id?: string | null
          plan_name: string
          starts_at?: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          amount_paid?: number
          bonus_multiplier?: number
          created_at?: string
          duration_days?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          payment_method?: string
          plan_id?: string | null
          plan_name?: string
          starts_at?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_user_memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "streak_membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_voucher_claims: {
        Row: {
          claimed_at: string
          id: string
          reward_amount: number
          reward_type: string
          user_balance_id: string | null
          visitor_id: string
          voucher_code: string
          voucher_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          reward_amount: number
          reward_type: string
          user_balance_id?: string | null
          visitor_id: string
          voucher_code: string
          voucher_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          reward_amount?: number
          reward_type?: string
          user_balance_id?: string | null
          visitor_id?: string
          voucher_code?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_voucher_claims_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "streak_vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_vouchers: {
        Row: {
          code: string
          created_at: string
          current_claims: number
          description: string | null
          expires_at: string
          id: string
          is_active: boolean
          max_claims: number
          name: string
          reward_amount: number
          reward_type: string
          starts_at: string
          target_user_balance_ids: string[]
          target_visitor_ids: string[]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          current_claims?: number
          description?: string | null
          expires_at: string
          id?: string
          is_active?: boolean
          max_claims?: number
          name: string
          reward_amount: number
          reward_type: string
          starts_at?: string
          target_user_balance_ids?: string[]
          target_visitor_ids?: string[]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_claims?: number
          description?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          max_claims?: number
          name?: string
          reward_amount?: number
          reward_type?: string
          starts_at?: string
          target_user_balance_ids?: string[]
          target_visitor_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      streak_wheel_pity: {
        Row: {
          free_spin_used_date: string | null
          free_spin_used_per_tier: Json
          spins_since_jackpot: number
          total_jackpots: number
          total_spins: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          free_spin_used_date?: string | null
          free_spin_used_per_tier?: Json
          spins_since_jackpot?: number
          total_jackpots?: number
          total_spins?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          free_spin_used_date?: string | null
          free_spin_used_per_tier?: Json
          spins_since_jackpot?: number
          total_jackpots?: number
          total_spins?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      streak_wheel_segments: {
        Row: {
          color_class: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          is_jackpot: boolean
          label: string
          reward_type: string
          reward_value: number
          sort_order: number
          tier: string
          updated_at: string
          weight: number
        }
        Insert: {
          color_class?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_jackpot?: boolean
          label: string
          reward_type: string
          reward_value?: number
          sort_order?: number
          tier?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          color_class?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_jackpot?: boolean
          label?: string
          reward_type?: string
          reward_value?: number
          sort_order?: number
          tier?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      streak_wheel_spins: {
        Row: {
          cost_paid: number
          created_at: string
          display_name: string
          id: string
          is_jackpot: boolean
          is_pity: boolean
          payment_method: string
          reward_label: string
          reward_type: string
          reward_value: number
          segment_id: string | null
          visitor_id: string
        }
        Insert: {
          cost_paid?: number
          created_at?: string
          display_name?: string
          id?: string
          is_jackpot?: boolean
          is_pity?: boolean
          payment_method?: string
          reward_label: string
          reward_type: string
          reward_value?: number
          segment_id?: string | null
          visitor_id: string
        }
        Update: {
          cost_paid?: number
          created_at?: string
          display_name?: string
          id?: string
          is_jackpot?: boolean
          is_pity?: boolean
          payment_method?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
          segment_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_wheel_spins_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "streak_wheel_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_wheel_tier_config: {
        Row: {
          color_class: string
          cost_balance: number
          cost_coins: number
          cost_gems: number
          created_at: string
          description: string
          free_daily: boolean
          icon: string
          id: string
          is_active: boolean
          pity_threshold: number
          sort_order: number
          tier_key: string
          tier_name: string
          updated_at: string
        }
        Insert: {
          color_class?: string
          cost_balance?: number
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          description?: string
          free_daily?: boolean
          icon?: string
          id?: string
          is_active?: boolean
          pity_threshold?: number
          sort_order?: number
          tier_key: string
          tier_name: string
          updated_at?: string
        }
        Update: {
          color_class?: string
          cost_balance?: number
          cost_coins?: number
          cost_gems?: number
          created_at?: string
          description?: string
          free_daily?: boolean
          icon?: string
          id?: string
          is_active?: boolean
          pity_threshold?: number
          sort_order?: number
          tier_key?: string
          tier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          name: string
          phone: string
          screenshot_url: string | null
          status: string
          ticket_number: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          name: string
          phone: string
          screenshot_url?: string | null
          status?: string
          ticket_number?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          phone?: string
          screenshot_url?: string | null
          status?: string
          ticket_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_bot_config: {
        Row: {
          bot_token: string
          bot_username: string
          created_at: string
          enabled: boolean
          id: string
          owner_id: string
          updated_at: string
          webhook_secret: string
          welcome_message: string
        }
        Insert: {
          bot_token?: string
          bot_username?: string
          created_at?: string
          enabled?: boolean
          id?: string
          owner_id?: string
          updated_at?: string
          webhook_secret?: string
          welcome_message?: string
        }
        Update: {
          bot_token?: string
          bot_username?: string
          created_at?: string
          enabled?: boolean
          id?: string
          owner_id?: string
          updated_at?: string
          webhook_secret?: string
          welcome_message?: string
        }
        Relationships: []
      }
      telegram_chats: {
        Row: {
          chat_id: string
          created_at: string
          first_name: string
          id: string
          last_message: string
          last_message_at: string
          status: string
          unread_count: number
          updated_at: string
          username: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          first_name?: string
          id?: string
          last_message?: string
          last_message_at?: string
          status?: string
          unread_count?: number
          updated_at?: string
          username?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          first_name?: string
          id?: string
          last_message?: string
          last_message_at?: string
          status?: string
          unread_count?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: string
          created_at: string
          direction: string
          id: string
          telegram_message_id: number | null
          text: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          direction?: string
          id?: string
          telegram_message_id?: number | null
          text?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          direction?: string
          id?: string
          telegram_message_id?: number | null
          text?: string
        }
        Relationships: []
      }
      ticket_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          sender_type: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          sender_type?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          sender_type?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_for: string[]
          id: string
          image_url: string | null
          is_deleted: boolean
          is_read: boolean
          message: string | null
          reply_to_id: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_read?: boolean
          message?: string | null
          reply_to_id?: string | null
          sender_type?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_read?: boolean
          message?: string | null
          reply_to_id?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_typing: {
        Row: {
          is_typing: boolean
          sender_type: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          is_typing?: boolean
          sender_type: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          is_typing?: boolean
          sender_type?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_typing_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      token_claims: {
        Row: {
          browser: string | null
          claimed_at: string
          device_info: string | null
          id: string
          token_id: string
        }
        Insert: {
          browser?: string | null
          claimed_at?: string
          device_info?: string | null
          id?: string
          token_id: string
        }
        Update: {
          browser?: string | null
          claimed_at?: string
          device_info?: string | null
          id?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_claims_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_fields: {
        Row: {
          created_at: string
          field_name: string
          field_value: string
          id: string
          token_id: string
        }
        Insert: {
          created_at?: string
          field_name: string
          field_value?: string
          id?: string
          token_id: string
        }
        Update: {
          created_at?: string
          field_name?: string
          field_value?: string
          id?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_fields_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          is_claimed: boolean
          product_id: string
          token_code: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          product_id: string
          token_code: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          product_id?: string
          token_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_entries: {
        Row: {
          id: string
          total_points: number
          total_wins: number
          tournament_id: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          id?: string
          total_points?: number
          total_wins?: number
          tournament_id: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          id?: string
          total_points?: number
          total_wins?: number
          tournament_id?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          description: string
          ends_at: string
          id: string
          is_active: boolean
          is_settled: boolean
          name: string
          prize_first: number
          prize_second: number
          prize_third: number
          starts_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          is_settled?: boolean
          name?: string
          prize_first?: number
          prize_second?: number
          prize_third?: number
          starts_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          is_settled?: boolean
          name?: string
          prize_first?: number
          prize_second?: number
          prize_third?: number
          starts_at?: string
        }
        Relationships: []
      }
      user_balances: {
        Row: {
          avatar_url: string | null
          balance: number
          bonus_balance: number
          created_at: string
          device_bound_at: string
          email: string | null
          id: string
          last_seen_at: string | null
          login_code: string | null
          name_change_count: number
          name_change_period: string | null
          password_hash: string | null
          phone: string
          totp_backup_codes: string[]
          totp_enabled: boolean
          totp_secret: string | null
          updated_at: string
          username: string
          visitor_id: string
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          bonus_balance?: number
          created_at?: string
          device_bound_at?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
          login_code?: string | null
          name_change_count?: number
          name_change_period?: string | null
          password_hash?: string | null
          phone?: string
          totp_backup_codes?: string[]
          totp_enabled?: boolean
          totp_secret?: string | null
          updated_at?: string
          username: string
          visitor_id: string
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          bonus_balance?: number
          created_at?: string
          device_bound_at?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
          login_code?: string | null
          name_change_count?: number
          name_change_period?: string | null
          password_hash?: string | null
          phone?: string
          totp_backup_codes?: string[]
          totp_enabled?: boolean
          totp_secret?: string | null
          updated_at?: string
          username?: string
          visitor_id?: string
        }
        Relationships: []
      }
      user_chat_settings: {
        Row: {
          last_seen_at: string
          show_last_seen: boolean
          updated_at: string
          visitor_id: string
        }
        Insert: {
          last_seen_at?: string
          show_last_seen?: boolean
          updated_at?: string
          visitor_id: string
        }
        Update: {
          last_seen_at?: string
          show_last_seen?: boolean
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      user_cosmetics: {
        Row: {
          acquired_at: string
          cosmetic_id: string
          cosmetic_name: string
          cosmetic_type: string
          id: string
          is_equipped: boolean
          source: string | null
          visitor_id: string
        }
        Insert: {
          acquired_at?: string
          cosmetic_id: string
          cosmetic_name: string
          cosmetic_type: string
          id?: string
          is_equipped?: boolean
          source?: string | null
          visitor_id: string
        }
        Update: {
          acquired_at?: string
          cosmetic_id?: string
          cosmetic_name?: string
          cosmetic_type?: string
          id?: string
          is_equipped?: boolean
          source?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          follower_visitor_id: string
          following_visitor_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_visitor_id: string
          following_visitor_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_visitor_id?: string
          following_visitor_id?: string
          id?: string
        }
        Relationships: []
      }
      user_game_credits: {
        Row: {
          created_at: string
          credits: number
          id: string
          unlimited_until: string | null
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          unlimited_until?: string | null
          updated_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          unlimited_until?: string | null
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      user_music_storage: {
        Row: {
          expires_at: string | null
          id: string
          redeemed_at: string
          storage_mb: number
          visitor_id: string
          voucher_code: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          redeemed_at?: string
          storage_mb?: number
          visitor_id: string
          voucher_code: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          redeemed_at?: string
          storage_mb?: number
          visitor_id?: string
          voucher_code?: string
        }
        Relationships: []
      }
      user_pins: {
        Row: {
          created_at: string
          id: string
          pin_hash: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      user_power_ups: {
        Row: {
          auto_hint: number
          created_at: string
          double_xp_until: string | null
          extra_life: number
          id: string
          time_freeze: number
          updated_at: string
          visitor_id: string
        }
        Insert: {
          auto_hint?: number
          created_at?: string
          double_xp_until?: string | null
          extra_life?: number
          id?: string
          time_freeze?: number
          updated_at?: string
          visitor_id: string
        }
        Update: {
          auto_hint?: number
          created_at?: string
          double_xp_until?: string | null
          extra_life?: number
          id?: string
          time_freeze?: number
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      user_wa_notif_numbers: {
        Row: {
          created_at: string
          id: string
          is_paid: boolean
          label: string | null
          notify_deposit: boolean
          notify_login: boolean
          notify_purchase: boolean
          paid_until: string | null
          slot_index: number
          updated_at: string
          visitor_id: string
          wa_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_paid?: boolean
          label?: string | null
          notify_deposit?: boolean
          notify_login?: boolean
          notify_purchase?: boolean
          paid_until?: string | null
          slot_index?: number
          updated_at?: string
          visitor_id: string
          wa_number: string
        }
        Update: {
          created_at?: string
          id?: string
          is_paid?: boolean
          label?: string | null
          notify_deposit?: boolean
          notify_login?: boolean
          notify_purchase?: boolean
          paid_until?: string | null
          slot_index?: number
          updated_at?: string
          visitor_id?: string
          wa_number?: string
        }
        Relationships: []
      }
      user_wa_notif_prefs: {
        Row: {
          created_at: string
          id: string
          notify_deposit: boolean
          notify_login: boolean
          notify_purchase: boolean
          updated_at: string
          visitor_id: string
          wa_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_deposit?: boolean
          notify_login?: boolean
          notify_purchase?: boolean
          updated_at?: string
          visitor_id: string
          wa_number?: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_deposit?: boolean
          notify_login?: boolean
          notify_purchase?: boolean
          updated_at?: string
          visitor_id?: string
          wa_number?: string
        }
        Relationships: []
      }
      wa_bot_packages: {
        Row: {
          created_at: string
          duration_hours: number
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_hours?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_hours?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      wa_bot_subscriptions: {
        Row: {
          bot_name: string
          created_at: string
          expires_at: string | null
          id: string
          package_id: string | null
          price_paid: number
          qr_code_url: string | null
          session_id: string | null
          starts_at: string | null
          status: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          bot_name?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id?: string | null
          price_paid?: number
          qr_code_url?: string | null
          session_id?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          bot_name?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          package_id?: string | null
          price_paid?: number
          qr_code_url?: string | null
          session_id?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_bot_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "wa_bot_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_notification_configs: {
        Row: {
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          template: string
          updated_at: string
          wa_number: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          template?: string
          updated_at?: string
          wa_number?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          template?: string
          updated_at?: string
          wa_number?: string
        }
        Relationships: []
      }
      wa_outbox: {
        Row: {
          created_at: string
          error: string | null
          id: string
          message: string
          phone: string
          related_id: string | null
          sent_at: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          message: string
          phone: string
          related_id?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          phone?: string
          related_id?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      wa_peer_phone_mappings: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          peer_jid: string
          phone: string
          source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          peer_jid: string
          phone: string
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          peer_jid?: string
          phone?: string
          source?: string | null
        }
        Relationships: []
      }
      wa_slot_payments: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          id: string
          method: string
          paid_at: string
          slot_index: number
          status: string
          trx_id: string | null
          visitor_id: string
          wa_number: string
        }
        Insert: {
          amount?: number
          created_at?: string
          expires_at: string
          id?: string
          method?: string
          paid_at?: string
          slot_index: number
          status?: string
          trx_id?: string | null
          visitor_id: string
          wa_number: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          method?: string
          paid_at?: string
          slot_index?: number
          status?: string
          trx_id?: string | null
          visitor_id?: string
          wa_number?: string
        }
        Relationships: []
      }
      weekly_challenge_progress: {
        Row: {
          challenge_id: string
          claimed_at: string | null
          current_value: number
          id: string
          is_completed: boolean
          updated_at: string
          visitor_id: string
        }
        Insert: {
          challenge_id: string
          claimed_at?: string | null
          current_value?: number
          id?: string
          is_completed?: boolean
          updated_at?: string
          visitor_id: string
        }
        Update: {
          challenge_id?: string
          claimed_at?: string | null
          current_value?: number
          id?: string
          is_completed?: boolean
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "weekly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_challenges: {
        Row: {
          challenge_type: string
          created_at: string
          description: string
          ends_at: string
          id: string
          is_active: boolean
          reward_coins: number
          reward_label: string
          starts_at: string
          target_value: number
          title: string
        }
        Insert: {
          challenge_type: string
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          reward_coins?: number
          reward_label?: string
          starts_at?: string
          target_value?: number
          title: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          reward_coins?: number
          reward_label?: string
          starts_at?: string
          target_value?: number
          title?: string
        }
        Relationships: []
      }
      weekly_leaderboard_claims: {
        Row: {
          claimed_at: string
          id: string
          rank_position: number
          reward_label: string
          reward_type: string
          reward_value: number
          visitor_id: string
          voucher_code: string | null
          week_start: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          rank_position: number
          reward_label?: string
          reward_type: string
          reward_value?: number
          visitor_id: string
          voucher_code?: string | null
          week_start: string
        }
        Update: {
          claimed_at?: string
          id?: string
          rank_position?: number
          reward_label?: string
          reward_type?: string
          reward_value?: number
          visitor_id?: string
          voucher_code?: string | null
          week_start?: string
        }
        Relationships: []
      }
      weekly_leaderboard_rewards: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          rank_position: number
          reward_label: string
          reward_type: string
          reward_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          rank_position: number
          reward_label?: string
          reward_type?: string
          reward_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          rank_position?: number
          reward_label?: string
          reward_type?: string
          reward_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      weekly_quest_progress: {
        Row: {
          claimed_at: string | null
          created_at: string
          current_value: number
          id: string
          is_completed: boolean
          quest_id: string
          updated_at: string
          visitor_id: string
          week_start: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          is_completed?: boolean
          quest_id: string
          updated_at?: string
          visitor_id: string
          week_start: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          current_value?: number
          id?: string
          is_completed?: boolean
          quest_id?: string
          updated_at?: string
          visitor_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_quest_progress_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "weekly_quests"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_quests: {
        Row: {
          created_at: string
          description: string
          difficulty: string
          icon: string
          id: string
          is_active: boolean
          quest_type: string
          reward_coins: number
          reward_gems: number
          reward_saldo_in: number
          reward_xp: number
          sort_order: number
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          quest_type: string
          reward_coins?: number
          reward_gems?: number
          reward_saldo_in?: number
          reward_xp?: number
          sort_order?: number
          target_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: string
          icon?: string
          id?: string
          is_active?: boolean
          quest_type?: string
          reward_coins?: number
          reward_gems?: number
          reward_saldo_in?: number
          reward_xp?: number
          sort_order?: number
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      weekly_spin_event_settings: {
        Row: {
          admin_note: string
          banner_color: string
          banner_description: string
          banner_title: string
          cost_coins: number
          cost_gems: number
          cost_idr: number
          created_at: string
          event_days: number
          event_ends_at: string | null
          event_starts_at: string | null
          free_spin_per_week: number
          id: string
          is_active: boolean
          max_spin_per_week: number
          updated_at: string
        }
        Insert: {
          admin_note?: string
          banner_color?: string
          banner_description?: string
          banner_title?: string
          cost_coins?: number
          cost_gems?: number
          cost_idr?: number
          created_at?: string
          event_days?: number
          event_ends_at?: string | null
          event_starts_at?: string | null
          free_spin_per_week?: number
          id?: string
          is_active?: boolean
          max_spin_per_week?: number
          updated_at?: string
        }
        Update: {
          admin_note?: string
          banner_color?: string
          banner_description?: string
          banner_title?: string
          cost_coins?: number
          cost_gems?: number
          cost_idr?: number
          created_at?: string
          event_days?: number
          event_ends_at?: string | null
          event_starts_at?: string | null
          free_spin_per_week?: number
          id?: string
          is_active?: boolean
          max_spin_per_week?: number
          updated_at?: string
        }
        Relationships: []
      }
      weekly_spin_wheel_segments: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          label: string
          rarity: string
          reward_type: string
          reward_value: number
          sort_order: number
          updated_at: string
          weight: number
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          rarity?: string
          reward_type?: string
          reward_value?: number
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          rarity?: string
          reward_type?: string
          reward_value?: number
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      wholesale_prices: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          min_quantity: number
          price_per_item: number
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type?: string
          id?: string
          min_quantity?: number
          price_per_item?: number
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          min_quantity?: number
          price_per_item?: number
        }
        Relationships: []
      }
    }
    Views: {
      game_profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          description: string | null
          display_name: string | null
          id: string | null
          is_guest: boolean | null
          updated_at: string | null
          visitor_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string | null
          is_guest?: boolean | null
          updated_at?: string | null
          visitor_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string | null
          is_guest?: boolean | null
          updated_at?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      streak_leaderboard: {
        Row: {
          avatar_url: string | null
          current_streak: number | null
          display_name: string | null
          id: string | null
          longest_streak: number | null
          total_bonus_points: number | null
          total_claims: number | null
          visitor_id: string | null
        }
        Relationships: []
      }
      streak_profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          description: string | null
          id: string | null
          updated_at: string | null
          username: string | null
          visitor_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          updated_at?: string | null
          username?: string | null
          visitor_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          updated_at?: string | null
          username?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      user_balances_public: {
        Row: {
          balance: number | null
          bonus_balance: number | null
          created_at: string | null
          email: string | null
          id: string | null
          phone: string | null
          updated_at: string | null
          username: string | null
          visitor_id: string | null
        }
        Insert: {
          balance?: number | null
          bonus_balance?: number | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          phone?: string | null
          updated_at?: string | null
          username?: string | null
          visitor_id?: string | null
        }
        Update: {
          balance?: number | null
          bonus_balance?: number | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          phone?: string | null
          updated_at?: string | null
          username?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_account_credits: {
        Args: { p_amount: number; p_visitor_id: string }
        Returns: number
      }
      add_account_gems: {
        Args: { p_amount: number; p_visitor_id: string }
        Returns: number
      }
      add_bonus_balance: {
        Args: { p_amount: number; p_visitor_id: string }
        Returns: number
      }
      add_topup_bonus_to_saldo_in: {
        Args: { p_amount: number; p_visitor_id: string }
        Returns: number
      }
      anon_chat_end_session: {
        Args: { p_session: string; p_visitor: string }
        Returns: undefined
      }
      anon_chat_find_or_queue: {
        Args: {
          p_interest: string
          p_my_gender: string
          p_nickname: string
          p_pref_gender: string
          p_visitor: string
        }
        Returns: {
          partner_gender: string
          partner_nickname: string
          queued: boolean
          session_id: string
        }[]
      }
      anon_chat_leave_queue: { Args: { p_visitor: string }; Returns: undefined }
      anon_chat_log_match: {
        Args: {
          p_partner: string
          p_partner_nick: string
          p_session: string
          p_visitor: string
        }
        Returns: undefined
      }
      anon_chat_mark_delivered: {
        Args: { p_session: string; p_visitor: string }
        Returns: undefined
      }
      anon_chat_mark_read: {
        Args: { p_session: string; p_visitor: string }
        Returns: undefined
      }
      anon_chat_respond_friend_request: {
        Args: {
          p_accept: boolean
          p_my_nickname: string
          p_request_id: string
          p_visitor: string
        }
        Returns: undefined
      }
      anon_chat_send_friend_request: {
        Args: {
          p_from_nickname: string
          p_from_visitor: string
          p_session_id: string
          p_to_nickname: string
          p_to_visitor: string
        }
        Returns: {
          already_friend: boolean
          already_pending: boolean
          request_id: string
        }[]
      }
      anon_chat_start_friend_session: {
        Args: {
          p_friend_visitor: string
          p_my_gender: string
          p_my_nickname: string
          p_visitor: string
        }
        Returns: {
          partner_gender: string
          partner_nickname: string
          session_id: string
        }[]
      }
      auto_cancel_expired_deposits: { Args: never; Returns: number }
      bump_music_quest_event: {
        Args: { p_quest_type: string; p_visitor_id: string }
        Returns: undefined
      }
      bump_music_share_quest: {
        Args: { p_visitor_id: string }
        Returns: undefined
      }
      claim_daily_premium_voucher: {
        Args: { p_visitor_id: string }
        Returns: {
          expires_at: string
          message: string
          success: boolean
          voucher_code: string
        }[]
      }
      claim_music_quest: {
        Args: { p_quest_id: string; p_visitor_id: string }
        Returns: {
          coins_added: number
          message: string
          success: boolean
        }[]
      }
      consume_balance_with_bonus: {
        Args: { p_amount: number; p_visitor_id: string }
        Returns: {
          new_balance: number
          new_bonus_balance: number
          used_bonus: number
          used_main: number
        }[]
      }
      consume_main_balance_only: {
        Args: { p_amount: number; p_balance_id: string }
        Returns: number
      }
      create_notification: {
        Args: {
          p_message: string
          p_related_id?: string
          p_title: string
          p_type?: string
          p_visitor_id: string
        }
        Returns: string
      }
      ensure_music_daily_quests: {
        Args: { p_visitor_id: string }
        Returns: {
          created_at: string
          current_value: number
          id: string
          is_claimed: boolean
          is_completed: boolean
          quest_date: string
          quest_type: string
          reward_coins: number
          target_value: number
          visitor_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "music_daily_quests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      galau_end_session: {
        Args: { p_session: string; p_visitor: string }
        Returns: undefined
      }
      galau_find_match: {
        Args: { p_mood: string; p_nickname: string; p_visitor: string }
        Returns: {
          partner_mood: string
          partner_nickname: string
          partner_visitor: string
          session_id: string
        }[]
      }
      generate_follow_voucher: {
        Args: { p_visitor_id: string }
        Returns: {
          already_claimed: boolean
          code: string
          discount_amount: number
          expires_at: string
        }[]
      }
      get_account_ban_info: {
        Args: { p_visitor_id: string }
        Returns: {
          banned_by: string
          banned_until: string
          created_at: string
          id: string
          is_permanent: boolean
          reason: string
        }[]
      }
      get_account_credits: { Args: { p_visitor_id: string }; Returns: number }
      get_account_gems: { Args: { p_visitor_id: string }; Returns: number }
      get_account_music_xp: {
        Args: { p_visitor_id: string }
        Returns: {
          level: string
          total_seconds: number
        }[]
      }
      get_account_status: { Args: { p_visitor_id: string }; Returns: Json }
      get_active_user_balance_id: {
        Args: { p_visitor_id: string }
        Returns: string
      }
      get_admin_response_rate: {
        Args: never
        Returns: {
          rate: number
          replied_chats: number
          total_chats: number
        }[]
      }
      get_music_wrapped: {
        Args: { p_days?: number; p_visitor_id: string }
        Returns: {
          top_artist: string
          top_artist_seconds: number
          top_song_artist: string
          top_song_seconds: number
          top_song_title: string
          total_seconds: number
          unique_songs: number
        }[]
      }
      get_my_notifications: {
        Args: { p_limit?: number; p_visitor_id: string }
        Returns: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          related_id: string | null
          title: string
          type: string
          visitor_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_premium_quest_info: {
        Args: { p_visitor_id: string }
        Returns: {
          can_trial: boolean
          expires_at: string
          is_active: boolean
          is_permanent: boolean
          plan_name: string
          seconds_left: number
        }[]
      }
      get_song_top_fans: {
        Args: { p_limit?: number; p_song_id: string; p_song_type?: string }
        Returns: {
          display_name: string
          rank: number
          total_seconds: number
          visitor_id: string
        }[]
      }
      get_song_top_fans_account: {
        Args: { p_limit?: number; p_song_id: string; p_song_type?: string }
        Returns: {
          account_key: string
          display_name: string
          rank: number
          total_seconds: number
          visitor_id: string
        }[]
      }
      get_store_premium_info: {
        Args: { p_visitor_id: string }
        Returns: {
          days_left: number
          expires_at: string
          is_locked: boolean
          is_premium: boolean
          lock_reason: string
          locked_until: string
          plan_name: string
        }[]
      }
      increment_sponsor_views: {
        Args: { sponsor_id: string }
        Returns: undefined
      }
      is_account_banned: { Args: { p_visitor_id: string }; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      is_premium_quest_active: {
        Args: { p_visitor_id: string }
        Returns: boolean
      }
      is_registered_balance_visitor: {
        Args: { p_visitor_id: string }
        Returns: boolean
      }
      is_store_premium: { Args: { p_visitor_id: string }; Returns: boolean }
      log_song_listen: {
        Args: {
          p_seconds: number
          p_song_artist: string
          p_song_id: string
          p_song_title: string
          p_song_type: string
          p_visitor_id: string
        }
        Returns: undefined
      }
      mark_notifications_read: {
        Args: { p_ids: string[]; p_visitor_id: string }
        Returns: undefined
      }
      premium_quest_period_start: {
        Args: { p_period: string }
        Returns: string
      }
      recalc_product_stock: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      refund_main_balance_only: {
        Args: { p_amount: number; p_balance_id: string }
        Returns: number
      }
      register_comment_violation: {
        Args: { p_reason: string; p_visitor_id: string }
        Returns: {
          restricted_until: string
          violation_count: number
        }[]
      }
      report_chat_violation: {
        Args: { p_detail: string; p_kind: string; p_visitor_id: string }
        Returns: number
      }
      seed_premium_quest_defaults: { Args: never; Returns: undefined }
      touch_anon_chat_profile:
        | {
            Args: {
              p_avatar_preset?: string
              p_avatar_url?: string
              p_nickname?: string
              p_show_last_seen?: boolean
              p_visitor_id: string
            }
            Returns: {
              avatar_preset: string
              avatar_url: string | null
              bio: string | null
              last_seen_at: string
              nickname: string | null
              show_last_seen: boolean
              updated_at: string
              visitor_id: string
              who_can_call: string
            }
            SetofOptions: {
              from: "*"
              to: "anon_chat_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_avatar_preset?: string
              p_avatar_url?: string
              p_nickname?: string
              p_show_last_seen?: boolean
              p_visitor_id: string
              p_who_can_call?: string
            }
            Returns: {
              avatar_preset: string
              avatar_url: string | null
              bio: string | null
              last_seen_at: string
              nickname: string | null
              show_last_seen: boolean
              updated_at: string
              visitor_id: string
              who_can_call: string
            }
            SetofOptions: {
              from: "*"
              to: "anon_chat_profiles"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      touch_user_presence: {
        Args: { p_visitor_id: string }
        Returns: undefined
      }
    }
    Enums: {
      flash_sale_mode: "discount_percent" | "fixed_price"
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
      flash_sale_mode: ["discount_percent", "fixed_price"],
    },
  },
} as const
