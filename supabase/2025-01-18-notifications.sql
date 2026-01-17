-- Notifications table for tracking snail events
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'arrival_success', 'arrival_invaded', 'intercept'
  data JSONB NOT NULL DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Update process_snail_arrival to create notifications
CREATE OR REPLACE FUNCTION public.process_snail_arrival(p_snail_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snail RECORD;
  v_reward INT := 100;
  v_penalty INT := 100;
  v_sender_username TEXT;
  v_target_username TEXT;
BEGIN
  SELECT * INTO v_snail
  FROM snails
  WHERE id = p_snail_id
  FOR UPDATE;

  IF v_snail IS NULL THEN
    RAISE EXCEPTION 'Snail not found';
  END IF;

  IF v_snail.status != 'moving' THEN
    RETURN jsonb_build_object('already_processed', true);
  END IF;

  -- Get usernames for notifications
  SELECT username INTO v_sender_username FROM profiles WHERE id = v_snail.sender_id;
  SELECT username INTO v_target_username FROM profiles WHERE id = v_snail.target_id;

  UPDATE snails
  SET status = 'arrived'
  WHERE id = p_snail_id;

  UPDATE profiles
  SET snail_inventory = snail_inventory + 1,
      salt_balance = salt_balance + v_reward,
      successful_invasions = successful_invasions + 1
  WHERE id = v_snail.sender_id;

  UPDATE profiles
  SET salt_balance = salt_balance - v_penalty
  WHERE id = v_snail.target_id;

  -- Create notification for sender (success)
  INSERT INTO notifications (user_id, type, data)
  VALUES (
    v_snail.sender_id,
    'arrival_success',
    jsonb_build_object(
      'snail_id', p_snail_id,
      'target_username', v_target_username,
      'salt_reward', v_reward,
      'snail_reward', 1
    )
  );

  -- Create notification for target (invaded)
  INSERT INTO notifications (user_id, type, data)
  VALUES (
    v_snail.target_id,
    'arrival_invaded',
    jsonb_build_object(
      'snail_id', p_snail_id,
      'sender_username', v_sender_username,
      'salt_penalty', v_penalty
    )
  );

  RETURN jsonb_build_object(
    'snail_id', p_snail_id,
    'sender_id', v_snail.sender_id,
    'target_id', v_snail.target_id,
    'sender_reward_salt', v_reward,
    'sender_reward_snails', 1,
    'target_penalty_salt', v_penalty
  );
END;
$$;

-- Update intercept_snail to create notification
CREATE OR REPLACE FUNCTION public.intercept_snail(p_snail_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snail RECORD;
  v_interceptor_id UUID := auth.uid();
  v_progress FLOAT;
  v_salt_reward INT;
  v_sender_username TEXT;
BEGIN
  IF v_interceptor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_snail
  FROM snails
  WHERE id = p_snail_id
  FOR UPDATE;

  IF v_snail IS NULL THEN
    RAISE EXCEPTION 'Snail not found';
  END IF;

  IF v_snail.status != 'moving' THEN
    RAISE EXCEPTION 'Snail is not moving';
  END IF;

  IF v_snail.target_id != v_interceptor_id THEN
    RAISE EXCEPTION 'You cannot intercept this snail';
  END IF;

  -- Get sender username for notification
  SELECT username INTO v_sender_username FROM profiles WHERE id = v_snail.sender_id;

  v_progress := EXTRACT(EPOCH FROM (NOW() - v_snail.start_time)) /
                EXTRACT(EPOCH FROM (v_snail.arrival_time - v_snail.start_time));
  v_progress := GREATEST(0, LEAST(1, v_progress));

  v_salt_reward := FLOOR(v_progress * 100);

  UPDATE snails
  SET status = 'intercepted'
  WHERE id = p_snail_id;

  UPDATE profiles
  SET snail_inventory = snail_inventory + 1,
      salt_balance = salt_balance + v_salt_reward,
      snails_thwarted = snails_thwarted + 1
  WHERE id = v_interceptor_id;

  -- Create notification for interceptor
  INSERT INTO notifications (user_id, type, data)
  VALUES (
    v_interceptor_id,
    'intercept',
    jsonb_build_object(
      'snail_id', p_snail_id,
      'sender_username', v_sender_username,
      'progress', v_progress,
      'salt_reward', v_salt_reward,
      'snail_reward', 1
    )
  );

  RETURN jsonb_build_object(
    'snail_id', p_snail_id,
    'interceptor_id', v_interceptor_id,
    'sender_id', v_snail.sender_id,
    'progress', v_progress,
    'salt_reward', v_salt_reward,
    'snail_reward', 1
  );
END;
$$;

-- RPC to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
