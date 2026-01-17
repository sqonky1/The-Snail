import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EconomyEvent } from "@/hooks/useSnails";
import { useAuth } from "@/_core/hooks/useAuth";

interface EconomyEventModalProps {
  event: EconomyEvent | null;
  onClose: () => void;
}

export default function EconomyEventModal({
  event,
  onClose,
}: EconomyEventModalProps) {
  const { user } = useAuth();

  if (!event) return null;

  const isArrival = event.type === "arrival";

  if (isArrival) {
    const { data } = event;
    const isSender = data.sender_id === user?.id;

    if (isSender) {
      return (
        <Dialog open onOpenChange={() => onClose()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">🎉</span>
                Snail Arrived!
              </DialogTitle>
              <DialogDescription>
                Your snail successfully invaded the target's home base.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧂</span>
                  <span className="font-medium">Salt Earned</span>
                </div>
                <span className="text-xl font-bold text-green-600">
                  +{data.sender_reward_salt}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🐌</span>
                  <span className="font-medium">Snail Returned</span>
                </div>
                <span className="text-xl font-bold text-green-600">
                  +{data.sender_reward_snails}
                </span>
              </div>
            </div>
            <Button onClick={onClose} className="w-full">
              Continue
            </Button>
          </DialogContent>
        </Dialog>
      );
    } else {
      return (
        <Dialog open onOpenChange={() => onClose()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">🚨</span>
                Base Invaded!
              </DialogTitle>
              <DialogDescription>
                An enemy snail reached your home base.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧂</span>
                  <span className="font-medium">Salt Lost</span>
                </div>
                <span className="text-xl font-bold text-red-600">
                  -{data.target_penalty_salt}
                </span>
              </div>
            </div>
            <Button onClick={onClose} className="w-full">
              Continue
            </Button>
          </DialogContent>
        </Dialog>
      );
    }
  }

  // Intercept event
  const { data } = event;
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Snail Intercepted!
          </DialogTitle>
          <DialogDescription>
            You captured an enemy snail before it reached your base.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🐌</span>
              <span className="font-medium">Snail Captured</span>
            </div>
            <span className="text-xl font-bold text-green-600">
              +{data.snail_reward}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧂</span>
              <span className="font-medium">Salt Earned</span>
            </div>
            <span className="text-xl font-bold text-green-600">
              +{data.salt_reward}
            </span>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Intercepted at {Math.round(data.progress * 100)}% progress
          </p>
        </div>
        <Button onClick={onClose} className="w-full">
          Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
}
