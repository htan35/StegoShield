-- Create private messages table
CREATE TABLE IF NOT EXISTS private_messages (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(255) NOT NULL,
  text TEXT,
  sender VARCHAR(255) NOT NULL,
  timestamp BIGINT NOT NULL,
  type VARCHAR(50) DEFAULT 'text',
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_id ON private_messages(chat_id);

-- Create gallery table
CREATE TABLE IF NOT EXISTS gallery (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  title VARCHAR(255),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create settings table
-- Fixed PostgreSQL syntax - removed MySQL's ON UPDATE, use trigger instead
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  decode_password VARCHAR(255) DEFAULT 'admin_secret',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings if not exists
INSERT INTO settings (decode_password) VALUES ('admin_secret') ON CONFLICT DO NOTHING;
