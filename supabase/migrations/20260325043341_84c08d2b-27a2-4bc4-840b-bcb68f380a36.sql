ALTER TABLE public.offer_flash_screens 
  ADD COLUMN IF NOT EXISTS content_text text,
  ADD COLUMN IF NOT EXISTS gradient_from text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS gradient_to text DEFAULT '#8b5cf6';