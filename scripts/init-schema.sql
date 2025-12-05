-- Create tables for StegoSecure

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  isVerified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS private_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatId VARCHAR(255) NOT NULL,
  text TEXT,
  sender VARCHAR(255) NOT NULL,
  timestamp BIGINT NOT NULL,
  type VARCHAR(50) DEFAULT 'text',
  imageUrl TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imageUrl TEXT NOT NULL,
  title VARCHAR(255),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decodePassword VARCHAR(255) DEFAULT 'admin_secret',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_messages_chatId ON private_messages(chatId);
CREATE INDEX IF NOT EXISTS idx_gallery_timestamp ON gallery(timestamp);
