export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SnailStatus = "moving" | "intercepted" | "arrived";
export type FriendshipStatus = "requested" | "friends";

export interface Database {
  public: {
    Tables: {
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: FriendshipStatus;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: FriendshipStatus;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: FriendshipStatus;
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
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
          friendship_id: string | null;
          path_json: Json;
          start_time: string;
          arrival_time: string;
          status: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          target_id: string;
          friendship_id?: string | null;
          path_json: Json;
          start_time?: string;
          arrival_time: string;
          status?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          target_id?: string;
          friendship_id?: string | null;
          path_json?: Json;
          start_time?: string;
          arrival_time?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "snails_friendship_id_fkey";
            columns: ["friendship_id"];
            referencedRelation: "friendships";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {
      check_and_sync_snails: {
        Args: Record<string, never>;
        Returns: SnailArrivalResult[];
      };
      deploy_snail: {
        Args: {
          p_target_id: string;
          p_friendship_id: string;
          p_path_json: Json;
          p_arrival_time: string;
        };
        Returns: string;
      };
      intercept_snail: {
        Args: {
          p_snail_id: string;
        };
        Returns: InterceptResult;
      };
      process_snail_arrival: {
        Args: {
          p_snail_id: string;
        };
        Returns: SnailArrivalResult;
      };
      get_friendships_with_profiles: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: FriendshipStatus;
          created_at: string;
          responded_at: string | null;
          requester_username: string | null;
          requester_home_location: unknown | null;
          addressee_username: string | null;
          addressee_home_location: unknown | null;
        }[];
      };
      request_friend: {
        Args: {
          p_target_id: string;
        };
        Returns: string | null;
      };
      respond_friend_request: {
        Args: {
          p_friendship_id: string;
          p_accept: boolean;
        };
        Returns: undefined;
      };
      search_profiles: {
        Args: {
          p_query: string;
        };
        Returns: {
          id: string;
          username: string;
        }[];
      };
    };
    Enums: {
      friendship_status: FriendshipStatus;
    };
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

export type Friendship =
  Database["public"]["Tables"]["friendships"]["Row"];
export type FriendshipInsert =
  Database["public"]["Tables"]["friendships"]["Insert"];
export type FriendshipUpdate =
  Database["public"]["Tables"]["friendships"]["Update"];

export type SnailArrivalResult = {
  snail_id: string;
  sender_id: string;
  target_id: string;
  sender_reward_salt: number;
  sender_reward_snails: number;
  target_penalty_salt: number;
} | {
  already_processed: true;
};

export type InterceptResult = {
  snail_id: string;
  interceptor_id: string;
  sender_id: string;
  progress: number;
  salt_reward: number;
  snail_reward: number;
};
