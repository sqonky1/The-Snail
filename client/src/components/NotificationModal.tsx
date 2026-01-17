import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Notification, NotificationType } from "@/lib/database.types";

interface NotificationData {
  target_username?: string;
  sender_username?: string;
  interceptor_username?: string;
  salt_reward?: number;
  salt_penalty?: number;
  snail_reward?: number;
  progress?: number;
}

interface NotificationModalProps {
  notification: Notification | null;
  onClose: () => void;
}

export default function NotificationModal({
  notification,
  onClose,
}: NotificationModalProps) {
  if (!notification) return null;

  const data = notification.data as NotificationData;
  const type = notification.type as NotificationType;

  if (type === "arrival_success") {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              Invasion Successful!
            </DialogTitle>
            <DialogDescription>
              Your snail invaded @{data.target_username}'s home base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧂</span>
                <span className="font-medium">Salt Earned</span>
              </div>
              <span className="text-xl font-bold text-green-600">
                +{data.salt_reward}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🐌</span>
                <span className="font-medium">Snail Returned</span>
              </div>
              <span className="text-xl font-bold text-green-600">
                +{data.snail_reward}
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

  if (type === "arrival_invaded") {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              Base Invaded!
            </DialogTitle>
            <DialogDescription>
              @{data.sender_username}'s snail reached your home base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧂</span>
                <span className="font-medium">Salt Lost</span>
              </div>
              <span className="text-xl font-bold text-red-600">
                -{data.salt_penalty}
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

  if (type === "intercept") {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              Snail Intercepted!
            </DialogTitle>
            <DialogDescription>
              You captured @{data.sender_username}'s snail before it reached your base.
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
              Intercepted at {Math.round((data.progress ?? 0) * 100)}% progress
            </p>
          </div>
          <Button onClick={onClose} className="w-full">
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (type === "snail_intercepted") {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">💔</span>
              Snail Intercepted!
            </DialogTitle>
            <DialogDescription>
              @{data.interceptor_username} intercepted your snail before it reached their base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🐌</span>
                <span className="font-medium">Snail Lost</span>
              </div>
              <span className="text-xl font-bold text-red-600">
                -1
              </span>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Intercepted at {Math.round((data.progress ?? 0) * 100)}% progress
            </p>
          </div>
          <Button onClick={onClose} className="w-full">
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
