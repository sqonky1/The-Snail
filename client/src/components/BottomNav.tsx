import { Home, Shell, User } from "lucide-react";
import { Link, useLocation } from "wouter";

export type TabType = "map" | "deploy" | "profile";

interface BottomNavProps {
  activeTab: TabType;
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const [location] = useLocation();

  const tabs = [
    { id: "map" as TabType, icon: Home, label: "Home", path: "/" },
    { id: "deploy" as TabType, icon: Shell, label: "Snails", path: "/deploy" },
    { id: "profile" as TabType, icon: User, label: "Base", path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--snail-dark)]/80 backdrop-blur-lg shadow-[0_-10px_30px_rgba(0,0,0,0.35)] z-50 border-t border-white/10">
      <div className="flex items-center justify-around h-16 max-w-screen-sm mx-auto text-white">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={tab.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors font-medium ${
                isActive
                  ? "text-[var(--snail-green)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Icon className="w-6 h-6 mb-1" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-gaegu tracking-wide">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
