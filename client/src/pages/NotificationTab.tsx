import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useProfile } from "@/hooks/useProfile";
import type { Notification, NotificationType } from "@/lib/database.types";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

interface NotificationData {
  target_username?: string;
  sender_username?: string;
  salt_reward?: number;
  salt_penalty?: number;
  snail_reward?: number;
  progress?: number;
}

function getNotificationContent(notification: Notification): {
  title: string;
  description: string;
  icon: string;
  isPositive: boolean;
} {
  const data = notification.data as NotificationData;

  switch (notification.type as NotificationType) {
    case "arrival_success":
      return {
        title: "Invasion Successful!",
        description: `Your snail invaded @${data.target_username}'s base. +${data.salt_reward} salt, +${data.snail_reward} snail`,
        icon: "🎉",
        isPositive: true,
      };
    case "arrival_invaded":
      return {
        title: "Base Invaded!",
        description: `@${data.sender_username}'s snail reached your base. -${data.salt_penalty} salt`,
        icon: "🚨",
        isPositive: false,
      };
    case "intercept":
      return {
        title: "Snail Intercepted!",
        description: `You captured @${data.sender_username}'s snail at ${Math.round((data.progress ?? 0) * 100)}%. +${data.salt_reward} salt, +${data.snail_reward} snail`,
        icon: "🎯",
        isPositive: true,
      };
    default:
      return {
        title: "Notification",
        description: "Something happened",
        icon: "📬",
        isPositive: true,
      };
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => Promise<void>;
}) {
  const [marking, setMarking] = useState(false);
  const content = getNotificationContent(notification);

  const handleMarkRead = async () => {
    setMarking(true);
    try {
      await onMarkRead(notification.id);
    } finally {
      setMarking(false);
    }
  };

  return (
    <GameWidget
      className={`${!notification.read ? "border-primary/50 bg-primary/5" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            content.isPositive ? "bg-green-100" : "bg-red-100"
          }`}
        >
          <span className="text-xl">{content.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-foreground">{content.title}</p>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTimeAgo(notification.created_at)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {content.description}
          </p>
        </div>
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleMarkRead}
            disabled={marking}
          >
            {marking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </GameWidget>
  );
}

export default function NotificationTab() {
  const { notifications, loading, markAsRead } = useNotifications();
  const { refresh: refreshProfile } = useProfile();

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    await refreshProfile();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-screen-sm mx-auto py-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Notifications</h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav activeTab="notifications" />
    </div>
  );
}
