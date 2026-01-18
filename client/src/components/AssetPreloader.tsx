import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const ASSETS_TO_PRELOAD = [
  "/user-snail.webp",
  "/enemy-snail.webp",
  "/avatar.webp",
  "/background.png",
  "/garden.webp",
  "/green-flag.webp",
  "/red-flag.webp",
  "/finish-flag.webp",
  "/snail-avatar.svg",
];

interface AssetPreloaderProps {
  children: React.ReactNode;
}

export default function AssetPreloader({ children }: AssetPreloaderProps) {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let loadedCount = 0;
    const totalAssets = ASSETS_TO_PRELOAD.length;

    const promises = ASSETS_TO_PRELOAD.map((src) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          setProgress(Math.round((loadedCount / totalAssets) * 100));
          resolve();
        };
        img.onerror = () => {
          loadedCount++;
          setProgress(Math.round((loadedCount / totalAssets) * 100));
          resolve();
        };
        img.src = src;
      });
    });

    Promise.all(promises).then(() => {
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="text-6xl mb-4">🐌</div>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading assets...</p>
          <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{progress}%</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
