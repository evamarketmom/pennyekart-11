
-- Create storage bucket for app downloads (APK/IPA files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-downloads', 'app-downloads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read/download files
CREATE POLICY "Anyone can read app downloads"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-downloads');

-- Only super admins can upload
CREATE POLICY "Admins can upload app downloads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'app-downloads' AND (public.is_super_admin() OR public.has_permission('read_products')));

-- Only super admins can update
CREATE POLICY "Admins can update app downloads"
ON storage.objects FOR UPDATE
USING (bucket_id = 'app-downloads' AND (public.is_super_admin() OR public.has_permission('read_products')));

-- Only super admins can delete
CREATE POLICY "Admins can delete app downloads"
ON storage.objects FOR DELETE
USING (bucket_id = 'app-downloads' AND (public.is_super_admin() OR public.has_permission('read_products')));

-- Add app settings rows for storing the file URLs
INSERT INTO public.app_settings (key, value, description)
VALUES 
  ('android_app_url', null, 'URL for the Android APK file'),
  ('ios_app_url', null, 'URL for the iOS app file')
ON CONFLICT DO NOTHING;
