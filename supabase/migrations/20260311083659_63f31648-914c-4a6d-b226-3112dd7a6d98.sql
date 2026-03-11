-- Allow admin staff with read_users permission to view all profiles
CREATE POLICY "Admin staff can view profiles"
ON public.profiles
FOR SELECT
USING (has_permission('read_users'));
