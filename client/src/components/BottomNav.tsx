import { Bell, Home, Shell, User } from "lucide-react";
import { Link } from "wouter";
import { useNotifications } from "@/hooks/useNotifications";

export type TabType = "map" | "deploy" | "notifications" | "profile";

interface BottomNavProps {
  activeTab: TabType;
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const { unreadCount } = useNotifications();

  const tabs = [
    { id: "map" as TabType, icon: Home, label: "Home", path: "/" },
    { id: "deploy" as TabType, icon: Shell, label: "Snails", path: "/deploy" },
    { id: "notifications" as TabType, icon: Bell, label: "Alerts", path: "/notifications" },
    { id: "profile" as TabType, icon: User, label: "Base", path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex items-center justify-around h-16 max-w-screen-sm mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === "notifications" && unreadCount > 0;

          return (
            <Link
              key={tab.id}
              href={tab.path}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6 mb-1" strokeWidth={isActive ? 2.5 : 2} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
