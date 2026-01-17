import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import { useNotifications } from "@/hooks/useNotifications";
import { useProfile } from "@/hooks/useProfile";
import type { Notification, NotificationType } from "@/lib/database.types";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface NotificationData {
  target_username?: string;
  sender_username?: string;
  interceptor_username?: string;
  salt_reward?: number;
  salt_penalty?: number;
  snail_reward?: number;
  progress?: number;
}

interface ResourceChange {
  label: string;
  value: number;
  isPositive: boolean;
}

function getNotificationContent(notification: Notification): {
  title: string;
  description: string;
  icon: string;
  isPositive: boolean;
  resources: ResourceChange[];
} {
  const data = notification.data as NotificationData;

  switch (notification.type as NotificationType) {
    case "arrival_success":
      return {
        title: "Invasion Successful!",
        description: `Your snail invaded ${data.target_username}'s base`,
        icon: "🎉",
        isPositive: true,
        resources: [
          { label: "🧂", value: data.salt_reward ?? 0, isPositive: true },
          { label: "🐌", value: data.snail_reward ?? 0, isPositive: true },
        ],
      };
    case "arrival_invaded":
      return {
        title: "Base Invaded!",
        description: `${data.sender_username}'s snail reached your base`,
        icon: "🚨",
        isPositive: false,
        resources: [
          { label: "🧂", value: data.salt_penalty ?? 0, isPositive: false },
        ],
      };
    case "intercept":
      return {
        title: "Snail Intercepted!",
        description: `You captured ${data.sender_username}'s snail at ${Math.round((data.progress ?? 0) * 100)}%`,
        icon: "🎯",
        isPositive: true,
        resources: [
          { label: "🧂", value: data.salt_reward ?? 0, isPositive: true },
          { label: "🐌", value: data.snail_reward ?? 0, isPositive: true },
        ],
      };
    case "snail_intercepted":
      return {
        title: "Snail Intercepted!",
        description: `${data.interceptor_username} intercepted your snail at ${Math.round((data.progress ?? 0) * 100)}%`,
        icon: "💔",
        isPositive: false,
        resources: [
          { label: "🐌", value: 1, isPositive: false },
        ],
      };
    default:
      return {
        title: "Notification",
        description: "Something happened",
        icon: "📬",
        isPositive: true,
        resources: [],
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

  const handleClick = async () => {
    if (notification.read || marking) return;
    setMarking(true);
    try {
      await onMarkRead(notification.id);
    } finally {
      setMarking(false);
    }
  };

  return (
    <GameWidget
      className={`${!notification.read ? "border-primary/50 bg-primary/5 cursor-pointer" : ""} ${marking ? "opacity-50" : ""}`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            content.isPositive ? "bg-green-100" : "bg-red-100"
          }`}
        >
          <span className="text-xl">{content.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{content.title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {content.description}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTimeAgo(notification.created_at)}
          </span>
          <div className="flex flex-col items-end mt-1">
            {content.resources.map((resource, idx) => (
              <span
                key={idx}
                className={`text-sm font-medium ${
                  resource.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {resource.isPositive ? "+" : "-"}
                {resource.value} {resource.label}
              </span>
            ))}
          </div>
        </div>
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
