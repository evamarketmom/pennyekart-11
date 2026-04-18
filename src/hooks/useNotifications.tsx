import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  target_audience: string;
  auto_dismiss_seconds: number;
  created_at: string;
  read_at: string | null;
  clicked_at: string | null;
}

const PROJECT_ID = "xxlocaexuoowxdzupjcs";

export const useNotifications = () => {
  const { user, session } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user || !session) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://${PROJECT_ID}.supabase.co/functions/v1/notifications-resolve?action=list`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  }, [user, session]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!user) return;
      await supabase
        .from("notification_reads")
        .update({ read_at: new Date().toISOString() })
        .eq("notification_id", notificationId)
        .eq("user_id", user.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
      );
    },
    [user]
  );

  const markClicked = useCallback(
    async (notificationId: string) => {
      if (!user) return;
      await supabase
        .from("notification_reads")
        .update({ clicked_at: new Date().toISOString(), read_at: new Date().toISOString() })
        .eq("notification_id", notificationId)
        .eq("user_id", user.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, clicked_at: new Date().toISOString(), read_at: new Date().toISOString() }
            : n
        )
      );
    },
    [user]
  );

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const firstUnread = notifications.find((n) => !n.read_at) ?? null;

  return { notifications, unreadCount, firstUnread, loading, markRead, markClicked, refetch: fetchAll };
};
