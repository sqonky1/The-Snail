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
    <nav className="fixed left-0 right-0 bottom-0 z-50 flex justify-center pointer-events-none">
      <div className="pointer-events-auto mx-6 mb-2 flex w-full max-w-2xl items-center justify-around rounded-[3rem_1rem_4rem_2rem] border border-white/50 bg-white/70 px-6 py-2 backdrop-blur-xl shadow-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === "notifications" && unreadCount > 0;

          return (
            <Link
              key={tab.id}
              href={tab.path}
              className={`relative flex flex-col items-center gap-1.5 transition-all active:scale-95 ${
                isActive
                  ? "text-[#78350F]"
                  : "text-black/50 hover:text-black/70"
              }`}
            >
              <div
                className={`relative flex items-center justify-center rounded-full px-3 py-2 ${
                  isActive ? "bg-[#78350F]/12" : "bg-transparent"
                }`}
              >
                <Icon
                  className="w-7 h-7"
                  strokeWidth={isActive ? 2.6 : 2.2}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-sm font-gaegu tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
