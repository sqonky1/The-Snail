import { Bell, Home, Shell, User, Sprout } from "lucide-react";
import { Link } from "wouter";
import { useNotifications } from "@/hooks/useNotifications";

export type TabType = "map" | "deploy" | "garden" | "notifications" | "profile";

interface BottomNavProps {
  activeTab: TabType;
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const { unreadCount } = useNotifications();

  const tabs = [
    { id: "map" as TabType, icon: Home, label: "Home", path: "/" },
    { id: "deploy" as TabType, icon: Shell, label: "Snails", path: "/deploy" },
    { id: "garden" as TabType, icon: Sprout, label: "Garden", path: "/garden" },
    { id: "notifications" as TabType, icon: Bell, label: "Alerts", path: "/notifications" },
    { id: "profile" as TabType, icon: User, label: "Base", path: "/profile" },
  ];

  return (
    <nav className="fixed left-0 right-0 bottom-0 z-50 bg-card/95 border-t border-border rounded-t-2xl shadow-2xl backdrop-blur-sm">
      <div className="flex w-full max-w-2xl mx-auto items-center justify-around px-4 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === "notifications" && unreadCount > 0;

          return (
            <Link
              key={tab.id}
              href={tab.path}
              className={`relative flex flex-col items-center gap-0.5 transition-all active:scale-95 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`relative flex items-center justify-center rounded-full px-2 py-1.5 ${
                  isActive ? "bg-primary/10" : "bg-transparent"
                }`}
              >
                <Icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2.6 : 2.2}
                />
                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
