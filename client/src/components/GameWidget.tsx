import { ReactNode } from "react";

interface GameWidgetProps {
  children: ReactNode;
  className?: string;
}

export default function GameWidget({ children, className = "" }: GameWidgetProps) {
  return (
    <div
      className={`bg-card rounded-[10px] shadow-md border border-border p-4 ${className}`}
    >
      {children}
    </div>
  );
}
