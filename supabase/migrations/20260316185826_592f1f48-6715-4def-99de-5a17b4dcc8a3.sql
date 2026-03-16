
-- Update the handle_new_user function to auto-assign admin for specific email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  INSERT INTO public.subscriptions (user_id, plan, daily_limit, price, active, is_trial, trial_ends_at, expires_at)
  VALUES (NEW.id, 'basico', 15, 0, true, true, now() + interval '7 days', now() + interval '7 days');

  -- Assign admin role for specific email, otherwise user role
  IF NEW.email = 'ipazcristian34@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;
