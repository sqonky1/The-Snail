import BottomNav from "@/components/BottomNav";
import GameWidget from "@/components/GameWidget";
import { useNotifications } from "@/hooks/useNotifications";
import { useProfile } from "@/hooks/useProfile";
import type { Notification, NotificationType } from "@/lib/database.types";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

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
}: {
  notification: Notification;
}) {
  const content = getNotificationContent(notification);

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold leading-none flex-1" style={{ fontSize: '26px' }}>
            {content.title}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap leading-none">
            {formatTimeAgo(notification.created_at)}
          </span>
        </div>
        <p className="text-muted-foreground leading-snug" style={{ fontSize: '22px' }}>
          {content.description}
        </p>
        {content.resources.length > 0 && (
          <div className="flex items-center gap-3 pt-0.5">
            {content.resources.map((resource, idx) => (
              <span
                key={idx}
                className={`font-semibold leading-none ${
                  resource.isPositive ? "text-green-600" : "text-red-600"
                }`}
                style={{ fontSize: '22px' }}
              >
                {resource.isPositive ? "+" : "-"}
                {resource.value} {resource.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationTab() {
  const { notifications, loading, markAllAsRead } = useNotifications();
  const { refresh: refreshProfile } = useProfile();

  useEffect(() => {
    if (!loading && notifications.length > 0) {
      const hasUnread = notifications.some((n) => !n.read);
      if (hasUnread) {
        markAllAsRead().then(() => refreshProfile());
      }
    }
  }, [loading, notifications, markAllAsRead, refreshProfile]);

  return (
    <div className="fixed inset-0 flex flex-col">
      <div
        className="fixed inset-0 bg-cover bg-center opacity-40 pointer-events-none"
        style={{ backgroundImage: "url('/background.png')" }}
        aria-hidden="true"
      />
      <div className="relative flex-1 overflow-y-auto pb-24">
        <div className="relative z-10 container max-w-screen-sm mx-auto py-6 space-y-6">
          <GameWidget>
            <h2 className="font-gaegu font-bold text-3xl text-foreground mb-4">
              Notifications
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </div>
            )}
          </GameWidget>
        </div>
      </div>

      <BottomNav activeTab="notifications" />
    </div>
  );
}
