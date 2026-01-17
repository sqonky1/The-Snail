import { ReactNode } from "react";

interface GameWidgetProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function GameWidget({
  children,
  className = "",
  onClick,
}: GameWidgetProps) {
  return (
    <div
      className={`rounded-[2.5rem_1.5rem_4rem_2rem] bg-white/80 border border-white/50 backdrop-blur-lg shadow-xl p-5 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
