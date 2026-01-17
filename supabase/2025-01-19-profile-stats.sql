-- Achievement counters for profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS snails_thwarted INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_invasions INT NOT NULL DEFAULT 0;

-- Update arrival processing to increment successful invasions
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

-- Update interception processing to increment snails thwarted
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

GRANT EXECUTE ON FUNCTION public.process_snail_arrival(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intercept_snail(UUID) TO authenticated;
