import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface InterceptModalProps {
  open: boolean;
  senderUsername: string;
  onIntercept: () => Promise<void>;
  onClose: () => void;
}

export default function InterceptModal({
  open,
  senderUsername,
  onIntercept,
  onClose,
}: InterceptModalProps) {
  const [intercepting, setIntercepting] = useState(false);

  const handleIntercept = async () => {
    setIntercepting(true);
    try {
      await onIntercept();
      onClose();
    } catch (error) {
      console.error("Failed to intercept snail:", error);
    } finally {
      setIntercepting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Snail in Range!
          </DialogTitle>
          <DialogDescription>
            You can intercept {senderUsername}'s snail before it reaches your base.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={intercepting}>
            Ignore
          </Button>
          <Button onClick={handleIntercept} className="flex-1" disabled={intercepting}>
            {intercepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Intercepting...
              </>
            ) : (
              "Intercept"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
