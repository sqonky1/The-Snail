import { ReactNode } from "react";

interface GameWidgetProps {
  children: ReactNode;
  className?: string;
}

export default function GameWidget({ children, className = "" }: GameWidgetProps) {
  return (
    <div
      className={`rounded-[2.5rem_1.5rem_4rem_2rem] bg-white/80 border border-white/50 backdrop-blur-lg shadow-xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}
