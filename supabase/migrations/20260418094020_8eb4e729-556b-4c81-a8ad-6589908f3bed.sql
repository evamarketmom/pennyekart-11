-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT,
  link_label TEXT,
  target_audience TEXT NOT NULL DEFAULT 'all', -- 'all' | 'agents' | 'panchayath'
  target_local_body_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notification reads tracking
CREATE TABLE public.notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  UNIQUE(notification_id, user_id)
);

CREATE INDEX idx_notifications_active ON public.notifications(is_active, created_at DESC);
CREATE INDEX idx_notification_reads_user ON public.notification_reads(user_id, notification_id);
CREATE INDEX idx_notification_reads_notif ON public.notification_reads(notification_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Notifications RLS
CREATE POLICY "Anyone can read active notifications"
  ON public.notifications FOR SELECT
  USING (is_active = true OR is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can update notifications"
  ON public.notifications FOR UPDATE
  USING (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can delete notifications"
  ON public.notifications FOR DELETE
  USING (is_super_admin() OR has_permission('read_settings'));

-- Notification reads RLS
CREATE POLICY "Users can read own notification reads"
  ON public.notification_reads FOR SELECT
  USING (auth.uid() = user_id OR is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Users can insert own notification reads"
  ON public.notification_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification reads"
  ON public.notification_reads FOR UPDATE
  USING (auth.uid() = user_id OR is_super_admin());

CREATE POLICY "Admins can delete notification reads"
  ON public.notification_reads FOR DELETE
  USING (is_super_admin());

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();