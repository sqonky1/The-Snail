import { useEffect, useRef, useState } from "react";

interface JoystickProps {
  onMove: (x: number, y: number) => void;
  size?: number;
}

export default function Joystick({ onMove, size = 100 }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const maxDistance = size / 2 - 15;

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    updatePosition(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    updatePosition(clientX, clientY);
  };

  const handleEnd = () => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > maxDistance) {
      const angle = Math.atan2(deltaY, deltaX);
      deltaX = Math.cos(angle) * maxDistance;
      deltaY = Math.sin(angle) * maxDistance;
    }

    setPosition({ x: deltaX, y: deltaY });

    const normalizedX = deltaX / maxDistance;
    const normalizedY = deltaY / maxDistance;
    onMove(normalizedX, normalizedY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      handleEnd();
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      handleEnd();
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="relative bg-background/80 backdrop-blur-sm rounded-full border-2 border-border shadow-lg"
      style={{ width: size, height: size }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.touches.length > 0) {
          handleStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <div
        className="absolute top-1/2 left-1/2 w-8 h-8 bg-primary rounded-full shadow-md transition-transform"
        style={{
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
    </div>
  );
}
