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

    const newData = (data as Notification[]) ?? [];
    
    // Check if there's a new unread notification at the top
    if (newData.length > 0 && newData[0].read === false) {
      const latestNotification = newData[0];
      // Only set as new if it's not already in our list
      setNotifications((prev) => {
        const exists = prev.some((n) => n.id === latestNotification.id);
        if (!exists) {
          setNewNotification(latestNotification);
        }
        return newData;
      });
    } else {
      setNotifications(newData);
    }
    
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

  const markAllAsRead = useCallback(async () => {
    const unreadNotifications = notifications.filter((n) => !n.read);
    
    if (unreadNotifications.length === 0) return;

    await Promise.all(
      unreadNotifications.map((n) =>
        supabase.rpc("mark_notification_read", {
          p_notification_id: n.id,
        })
      )
    );

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    newNotification,
    clearNewNotification,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
