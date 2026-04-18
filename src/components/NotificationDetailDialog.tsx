import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";

interface Props {
  notification: AppNotification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NotificationDetailDialog = ({ notification, open, onOpenChange }: Props) => {
  const { markClicked } = useNotifications();
  const navigate = useNavigate();

  if (!notification) return null;

  const handleLinkClick = () => {
    if (!notification.link_url) return;
    markClicked(notification.id);
    if (notification.link_url.startsWith("http")) {
      window.open(notification.link_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(notification.link_url);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{notification.title}</DialogTitle>
        </DialogHeader>
        {notification.image_url && (
          <img
            src={notification.image_url}
            alt={notification.title}
            className="w-full max-h-64 object-contain rounded-md border"
          />
        )}
        <p className="text-sm text-foreground whitespace-pre-wrap">{notification.message}</p>
        <div className="flex gap-2">
          {notification.link_url && (
            <Button className="flex-1" onClick={handleLinkClick}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {notification.link_label || "Open Link"}
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationDetailDialog;
