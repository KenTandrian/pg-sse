-- 1. Create a sample users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create the real-time JSON trigger function (adhering to Thin Event Pattern)
CREATE OR REPLACE FUNCTION notify_table_update()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'pg_sse_events',
    json_build_object(
      'table', TG_TABLE_NAME,
      'action', TG_OP,
      'id', COALESCE(NEW.id, OLD.id)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the trigger to the users table
DROP TRIGGER IF EXISTS users_update_trigger ON users;
CREATE TRIGGER users_update_trigger
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION notify_table_update();
