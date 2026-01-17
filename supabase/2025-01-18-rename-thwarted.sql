-- Add snails_intercepted column if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS snails_intercepted INT NOT NULL DEFAULT 0;

-- Remove snails_thwarted column if it exists (in case it was created by previous migrations)
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS snails_thwarted;

-- Drop and recreate the intercept_snail function to use the new column name and notify sender
DROP FUNCTION IF EXISTS public.intercept_snail(UUID);

CREATE OR REPLACE FUNCTION public.intercept_snail(p_snail_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snail RECORD;
  v_progress FLOAT;
  v_salt_reward INT;
  v_snail_reward INT := 1;
  v_sender_username TEXT;
  v_interceptor_username TEXT;
BEGIN
  SELECT * INTO v_snail
  FROM snails
  WHERE id = p_snail_id
    AND target_id = auth.uid()
    AND status = 'moving'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snail not found or not interceptable';
  END IF;

  v_progress := EXTRACT(EPOCH FROM (NOW() - v_snail.start_time)) /
                EXTRACT(EPOCH FROM (v_snail.arrival_time - v_snail.start_time));
  v_progress := GREATEST(0, LEAST(1, v_progress));

  v_salt_reward := ROUND(100 * v_progress);

  UPDATE snails
  SET status = 'intercepted'
  WHERE id = p_snail_id;

  UPDATE profiles
  SET salt_balance = salt_balance + v_salt_reward,
      snail_inventory = snail_inventory + v_snail_reward,
      snails_intercepted = snails_intercepted + 1
  WHERE id = auth.uid();

  SELECT username INTO v_sender_username
  FROM profiles
  WHERE id = v_snail.sender_id;

  SELECT username INTO v_interceptor_username
  FROM profiles
  WHERE id = auth.uid();

  -- Notification for the interceptor
  INSERT INTO notifications (user_id, type, data)
  VALUES (
    auth.uid(),
    'intercept',
    jsonb_build_object(
      'snail_id', p_snail_id,
      'sender_id', v_snail.sender_id,
      'sender_username', v_sender_username,
      'progress', v_progress,
      'salt_reward', v_salt_reward,
      'snail_reward', v_snail_reward
    )
  );

  -- Notification for the sender whose snail was intercepted
  INSERT INTO notifications (user_id, type, data)
  VALUES (
    v_snail.sender_id,
    'snail_intercepted',
    jsonb_build_object(
      'snail_id', p_snail_id,
      'interceptor_id', auth.uid(),
      'interceptor_username', v_interceptor_username,
      'progress', v_progress
    )
  );

  RETURN jsonb_build_object(
    'snail_id', p_snail_id,
    'interceptor_id', auth.uid(),
    'sender_id', v_snail.sender_id,
    'progress', v_progress,
    'salt_reward', v_salt_reward,
    'snail_reward', v_snail_reward
  );
END;
$$;
