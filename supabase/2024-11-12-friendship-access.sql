-- Allow players to view usernames for anyone they're connected to
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view friend profiles"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status IN ('requested','friends')
      AND (
        (f.requester_id = auth.uid() AND f.addressee_id = id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = id)
      )
  )
);

-- Security-definer RPC to fetch friendships plus usernames
CREATE OR REPLACE FUNCTION public.get_friendships_with_profiles()
RETURNS TABLE (
  id UUID,
  requester_id UUID,
  addressee_id UUID,
  status friendship_status,
  created_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  requester_username TEXT,
  addressee_username TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.requester_id,
    f.addressee_id,
    f.status,
    f.created_at,
    f.responded_at,
    pr.username AS requester_username,
    pa.username AS addressee_username
  FROM public.friendships f
  JOIN public.profiles pr ON pr.id = f.requester_id
  JOIN public.profiles pa ON pa.id = f.addressee_id
  WHERE f.requester_id = auth.uid()
     OR f.addressee_id = auth.uid()
  ORDER BY f.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_friendships_with_profiles() TO authenticated;
