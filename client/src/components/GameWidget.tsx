import { ReactNode } from "react";

interface GameWidgetProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function GameWidget({ children, className = "", onClick }: GameWidgetProps) {
  return (
    <div
      className={`bg-card rounded-[10px] shadow-md border border-border p-4 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
