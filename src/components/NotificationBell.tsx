import { useState } from "react";
import { Bell, ExternalLink, X } from "lucide-react";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import NotificationDetailDialog from "@/components/NotificationDetailDialog";

const NotificationBell = () => {
  const { notifications, unreadCount, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleClick = (n: AppNotification) => {
    if (!n.read_at) markRead(n.id);
    setSelected(n);
    setDetailOpen(true);
    setOpen(false);
  };


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative text-foreground hover:text-primary transition-colors" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet</p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !n.read_at ? "bg-primary/5" : ""
                  }`}
                  onClick={() => handleClick(n)}
                >
                  <div className="flex items-start gap-3">
                    {n.image_url ? (
                      <img src={n.image_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{n.title}</p>
                        {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                      {n.link_url && (
                        <span className="inline-flex items-center text-xs text-primary mt-1">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {n.link_label || "Open"}
                        </span>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
