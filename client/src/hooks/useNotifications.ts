import { supabase } from "@/lib/supabase";
import type { Notification } from "@/lib/database.types";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [newNotification, setNewNotification] = useState<Notification | null>(null);

  const clearNewNotification = useCallback(() => {
    setNewNotification(null);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error);
      setLoading(false);
      return;
    }

    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as Notification;
          setNotifications((prev) => [notification, ...prev]);
          setNewNotification(notification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase.rpc("mark_notification_read", {
      p_notification_id: notificationId,
    });

    if (error) throw error;

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    newNotification,
    clearNewNotification,
    loading,
    error,
    markAsRead,
    refresh: fetchNotifications,
  };
}
