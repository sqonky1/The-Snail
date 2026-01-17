export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SnailStatus = "moving" | "intercepted" | "arrived";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          salt_balance: number;
          snail_inventory: number;
          home_location: unknown | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          salt_balance?: number;
          snail_inventory?: number;
          home_location?: unknown | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          salt_balance?: number;
          snail_inventory?: number;
          home_location?: unknown | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      snails: {
        Row: {
          id: string;
          sender_id: string;
          target_id: string;
          path_json: Json;
          start_time: string;
          arrival_time: string;
          status: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          target_id: string;
          path_json: Json;
          start_time?: string;
          arrival_time: string;
          status?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          target_id?: string;
          path_json?: Json;
          start_time?: string;
          arrival_time?: string;
          status?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      check_and_sync_snails: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: {};
  };
}

// Convenience types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Snail = Database["public"]["Tables"]["snails"]["Row"] & {
  path_json: [number, number][];
  status: SnailStatus;
};
export type SnailInsert = Database["public"]["Tables"]["snails"]["Insert"];
export type SnailUpdate = Database["public"]["Tables"]["snails"]["Update"];
