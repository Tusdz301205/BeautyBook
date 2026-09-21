-- Additive guard only. Never delete roles, profiles or historical records.
BEGIN;
LOCK TABLE user_roles IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP
    GROUP BY ur.user_id
    HAVING bool_or(r.code::text = 'CUSTOMER')
      AND bool_or(r.code::text IN ('BUSINESS_OWNER','RECEPTIONIST','STAFF','PLATFORM_ADMIN'))
  ) THEN
    RAISE EXCEPTION 'Account separation requires review of legacy mixed-role accounts; no automatic data conversion';
  END IF;
END $$;

CREATE FUNCTION public.validate_account_role_separation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE incoming_code text;
BEGIN
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= CURRENT_TIMESTAMP THEN
    RETURN NEW;
  END IF;
  -- Serialize all role writers for this account, including concurrent grants
  -- and renewals. Serializable transactions additionally retry write conflicts.
  PERFORM 1 FROM users WHERE id = NEW.user_id FOR UPDATE;
  SELECT code::text INTO incoming_code FROM roles WHERE id = NEW.role_id;
  IF EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = NEW.user_id AND ur.id IS DISTINCT FROM NEW.id
      AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
      AND ((incoming_code = 'CUSTOMER' AND r.code::text IN ('BUSINESS_OWNER','RECEPTIONIST','STAFF','PLATFORM_ADMIN'))
        OR (incoming_code IN ('BUSINESS_OWNER','RECEPTIONIST','STAFF','PLATFORM_ADMIN') AND r.code::text = 'CUSTOMER'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      CONSTRAINT = 'account_role_separation_guard',
      MESSAGE = 'CUSTOMER and operational roles require separate accounts';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER account_role_separation_guard
BEFORE INSERT OR UPDATE OF user_id, role_id, expires_at ON user_roles
FOR EACH ROW EXECUTE FUNCTION public.validate_account_role_separation();
COMMIT;
