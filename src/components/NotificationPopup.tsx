import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, ExternalLink } from "lucide-react";

const SHOWN_KEY = "notif_popup_shown_v1";

const NotificationPopup = () => {
  const { firstUnread, markRead, markClicked } = useNotifications();
  const [open, setOpen] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!firstUnread) return;
    const shown = JSON.parse(sessionStorage.getItem(SHOWN_KEY) || "[]") as string[];
    if (shown.includes(firstUnread.id)) return;
    setOpen(true);
    setShowFull(false);
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...shown, firstUnread.id]));
  }, [firstUnread]);

  // Auto-dismiss after configured seconds (0 = disabled)
  useEffect(() => {
    if (!open || !firstUnread?.auto_dismiss_seconds || firstUnread.auto_dismiss_seconds <= 0) return;
    const t = setTimeout(() => setOpen(false), firstUnread.auto_dismiss_seconds * 1000);
    return () => clearTimeout(t);
  }, [open, firstUnread]);

  if (!firstUnread) return null;

  const handleView = () => {
    setShowFull(true);
    markRead(firstUnread.id);
  };

  const handleLinkClick = () => {
    if (!firstUnread.link_url) return;
    markClicked(firstUnread.id);
    if (firstUnread.link_url.startsWith("http")) {
      window.open(firstUnread.link_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(firstUnread.link_url);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        {!showFull ? (
          <>
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle className="text-xl mb-2" lang="ml">
                നിങ്ങൾക്ക് ഒരു മെസ്സേജ് വന്നിട്ടുണ്ട്
              </DialogTitle>
              <DialogDescription>You have a new message</DialogDescription>
              <div className="flex gap-2 mt-6 w-full">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Later
                </Button>
                <Button className="flex-1" onClick={handleView}>
                  View Message
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{firstUnread.title}</DialogTitle>
            </DialogHeader>
            {firstUnread.image_url && (
              <img
                src={firstUnread.image_url}
                alt={firstUnread.title}
                className="w-full max-h-64 object-contain rounded-md border"
              />
            )}
            <p className="text-sm text-foreground whitespace-pre-wrap">{firstUnread.message}</p>
            <div className="flex gap-2">
              {firstUnread.link_url && (
                <Button className="flex-1" onClick={handleLinkClick}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {firstUnread.link_label || "Open Link"}
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPopup;
