-- Salt Economy RPC Functions
-- Handles all economy transactions atomically on the server side

-- Drop existing function that has different return type
DROP FUNCTION IF EXISTS public.check_and_sync_snails();

-- Constants for economy
-- Initial Salt Balance: 200
-- Initial Snail Inventory: 3
-- Successful delivery reward: +100 salt, +1 snail to sender
-- Successful delivery penalty: -100 salt to receiver
-- Interception reward: +1 snail, +(progress * 100) salt to interceptor

-- Deploy a snail (deducts 1 snail from sender's inventory)
CREATE OR REPLACE FUNCTION public.deploy_snail(
  p_target_id UUID,
  p_friendship_id UUID,
  p_path_json JSONB,
  p_arrival_time TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID := auth.uid();
  v_snail_count INT;
  v_snail_id UUID;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check sender has snails
  SELECT snail_inventory INTO v_snail_count
  FROM profiles
  WHERE id = v_sender_id
  FOR UPDATE;

  IF v_snail_count IS NULL OR v_snail_count <= 0 THEN
    RAISE EXCEPTION 'No snails available';
  END IF;

  -- Deduct snail from sender
  UPDATE profiles
  SET snail_inventory = snail_inventory - 1
  WHERE id = v_sender_id;

  -- Create snail record
  INSERT INTO snails (sender_id, target_id, friendship_id, path_json, arrival_time, status)
  VALUES (v_sender_id, p_target_id, p_friendship_id, p_path_json, p_arrival_time, 'moving')
  RETURNING id INTO v_snail_id;

  RETURN v_snail_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deploy_snail(UUID, UUID, JSONB, TIMESTAMPTZ) TO authenticated;

-- Process snail arrival (called by check_and_sync_snails or directly)
-- Returns JSON with details for UI notification
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
  -- Get snail details with lock
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

  -- Update snail status
  UPDATE snails
  SET status = 'arrived'
  WHERE id = p_snail_id;

  -- Award sender: +1 snail, +100 salt
  UPDATE profiles
  SET snail_inventory = snail_inventory + 1,
      salt_balance = salt_balance + v_reward
  WHERE id = v_snail.sender_id;

  -- Penalize receiver: -100 salt (can go negative)
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

GRANT EXECUTE ON FUNCTION public.process_snail_arrival(UUID) TO authenticated;

-- Intercept a snail (receiver captures it before arrival)
-- Returns JSON with details for UI notification
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

  -- Get snail details with lock
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

  -- Only the target can intercept
  IF v_snail.target_id != v_interceptor_id THEN
    RAISE EXCEPTION 'You cannot intercept this snail';
  END IF;

  -- Calculate progress (0 to 1)
  v_progress := EXTRACT(EPOCH FROM (NOW() - v_snail.start_time)) /
                EXTRACT(EPOCH FROM (v_snail.arrival_time - v_snail.start_time));
  v_progress := GREATEST(0, LEAST(1, v_progress));

  -- Salt reward based on progress (progress * 100)
  v_salt_reward := FLOOR(v_progress * 100);

  -- Update snail status
  UPDATE snails
  SET status = 'intercepted'
  WHERE id = p_snail_id;

  -- Award interceptor: +1 snail, +salt based on progress
  UPDATE profiles
  SET snail_inventory = snail_inventory + 1,
      salt_balance = salt_balance + v_salt_reward
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

GRANT EXECUTE ON FUNCTION public.intercept_snail(UUID) TO authenticated;

-- Purchase a snail using salt (100 salt -> +1 snail)
CREATE OR REPLACE FUNCTION public.purchase_snail()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_cost INT := 100;
  v_salt_balance INT;
  v_snail_inventory INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT salt_balance, snail_inventory
  INTO v_salt_balance, v_snail_inventory
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_salt_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_salt_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient salt';
  END IF;

  UPDATE profiles
  SET salt_balance = salt_balance - v_cost,
      snail_inventory = snail_inventory + 1
  WHERE id = v_user_id
  RETURNING salt_balance, snail_inventory
  INTO v_salt_balance, v_snail_inventory;

  RETURN jsonb_build_object(
    'salt_balance', v_salt_balance,
    'snail_inventory', v_snail_inventory,
    'snails_purchased', 1,
    'salt_spent', v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_snail() TO authenticated;

-- Updated check_and_sync_snails to process economy on arrival
-- Returns array of processed arrivals for UI notifications
CREATE OR REPLACE FUNCTION public.check_and_sync_snails()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_snail RECORD;
  v_results JSONB := '[]'::JSONB;
  v_arrival_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN v_results;
  END IF;

  -- Find all snails that have arrived but not processed
  -- Only process snails where the current user is sender or target
  FOR v_snail IN
    SELECT id
    FROM snails
    WHERE status = 'moving'
      AND arrival_time <= NOW()
      AND (sender_id = v_user_id OR target_id = v_user_id)
  LOOP
    v_arrival_result := process_snail_arrival(v_snail.id);
    IF NOT (v_arrival_result ? 'already_processed') THEN
      v_results := v_results || v_arrival_result;
    END IF;
  END LOOP;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_sync_snails() TO authenticated;
