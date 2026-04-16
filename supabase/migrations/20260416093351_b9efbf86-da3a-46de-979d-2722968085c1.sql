
-- chatbot_config table
CREATE TABLE public.chatbot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.chatbot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read chatbot config" ON public.chatbot_config
  FOR SELECT USING (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can insert chatbot config" ON public.chatbot_config
  FOR INSERT WITH CHECK (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can update chatbot config" ON public.chatbot_config
  FOR UPDATE USING (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can delete chatbot config" ON public.chatbot_config
  FOR DELETE USING (is_super_admin());

-- Edge function needs to read config with service role, but also allow anon read for frontend
CREATE POLICY "Anyone can read chatbot config" ON public.chatbot_config
  FOR SELECT USING (true);

-- chatbot_knowledge table
CREATE TABLE public.chatbot_knowledge (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active knowledge" ON public.chatbot_knowledge
  FOR SELECT USING (is_active = true OR is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can insert knowledge" ON public.chatbot_knowledge
  FOR INSERT WITH CHECK (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can update knowledge" ON public.chatbot_knowledge
  FOR UPDATE USING (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can delete knowledge" ON public.chatbot_knowledge
  FOR DELETE USING (is_super_admin() OR has_permission('read_settings'));

-- chatbot_api_keys table
CREATE TABLE public.chatbot_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name text NOT NULL,
  api_key text NOT NULL,
  base_url text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read api keys" ON public.chatbot_api_keys
  FOR SELECT USING (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can insert api keys" ON public.chatbot_api_keys
  FOR INSERT WITH CHECK (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can update api keys" ON public.chatbot_api_keys
  FOR UPDATE USING (is_super_admin() OR has_permission('read_settings'));

CREATE POLICY "Admins can delete api keys" ON public.chatbot_api_keys
  FOR DELETE USING (is_super_admin());

-- Triggers for updated_at
CREATE TRIGGER update_chatbot_config_updated_at
  BEFORE UPDATE ON public.chatbot_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chatbot_knowledge_updated_at
  BEFORE UPDATE ON public.chatbot_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chatbot_api_keys_updated_at
  BEFORE UPDATE ON public.chatbot_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default config
INSERT INTO public.chatbot_config (key, value) VALUES
  ('enabled', 'true'),
  ('bot_name', 'Penny Assistant'),
  ('welcome_message', 'Hi! 👋 I''m Penny, your shopping assistant. How can I help you today?'),
  ('response_language', 'malayalam'),
  ('max_history_messages', '20'),
  ('system_prompt', NULL);
