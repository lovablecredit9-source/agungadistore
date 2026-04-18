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
          id: string
          is_active: boolean
          reward_coins: number
          sort_order: number
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          challenge_type: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          reward_coins?: number
          sort_order?: number
          target_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          challenge_type?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          reward_coins?: number
          sort_order?: number
          target_value?: number
          title?: string
          updated_at?: string
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
          freeze_count: number
          freeze_used_at: string | null
          id: string
          last_claim_date: string
          longest_streak: number
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
          freeze_count?: number
          freeze_used_at?: string | null
          id?: string
          last_claim_date?: string
          longest_streak?: number
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
          freeze_count?: number
          freeze_used_at?: string | null
          id?: string
          last_claim_date?: string
          longest_streak?: number
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
      discount_vouchers: {
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
          bonus_gems: number
          created_at: string
          gems: number
          icon: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus_gems?: number
          created_at?: string
          gems?: number
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus_gems?: number
          created_at?: string
          gems?: number
          icon?: string
          id?: string
          is_active?: boolean
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
          rarity?: string
          reward_label?: string
          reward_type?: string
          reward_value?: number
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
      product_chat_messages: {
        Row: {
          chat_id: string
          created_at: string
          deleted_at: string | null
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
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          has_warranty: boolean
          id: string
          image_url: string | null
          price: number
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
      streak_shop_items: {
        Row: {
          cost_coins: number
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
          balance: number
          created_at: string
          email: string | null
          id: string
          password_hash: string | null
          phone: string
          updated_at: string
          username: string
          visitor_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          email?: string | null
          id?: string
          password_hash?: string | null
          phone?: string
          updated_at?: string
          username: string
          visitor_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          email?: string | null
          id?: string
          password_hash?: string | null
          phone?: string
          updated_at?: string
          username?: string
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
          icon: string
          id: string
          is_active: boolean
          quest_type: string
          reward_coins: number
          reward_xp: number
          sort_order: number
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          quest_type: string
          reward_coins?: number
          reward_xp?: number
          sort_order?: number
          target_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          quest_type?: string
          reward_coins?: number
          reward_xp?: number
          sort_order?: number
          target_value?: number
          title?: string
          updated_at?: string
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
      get_account_gems: { Args: { p_visitor_id: string }; Returns: number }
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
      increment_sponsor_views: {
        Args: { sponsor_id: string }
        Returns: undefined
      }
      is_admin_user: { Args: never; Returns: boolean }
      mark_notifications_read: {
        Args: { p_ids: string[]; p_visitor_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
