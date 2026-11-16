-- Chat messages table for Student AI Chatbot
CREATE TABLE IF NOT EXISTS chatbot_messages (
  _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(_id) ON DELETE CASCADE,
  sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_user_created 
  ON chatbot_messages (user_id, created_at ASC);
