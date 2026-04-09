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
          id: string
          image_url: string | null
          is_read: boolean
          message: string | null
          sender_type: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          message?: string | null
          sender_type?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          message?: string | null
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
      support_tickets: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          phone: string
          status: string
          ticket_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          name: string
          phone: string
          status?: string
          ticket_number?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          phone?: string
          status?: string
          ticket_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean
          message: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          message?: string | null
          sender_type?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean
          message?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_sponsor_views: {
        Args: { sponsor_id: string }
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
