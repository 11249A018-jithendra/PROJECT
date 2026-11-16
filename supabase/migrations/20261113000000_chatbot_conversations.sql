-- ============================================================================
-- Hostel Assistant chatbot: conversations on top of the existing
-- chatbot_messages table (20261112010000_chatbot_messages.sql).
-- 1. conversation_id groups messages into conversations ("new conversation",
--    "load previous conversations"). Existing rows become one conversation
--    per student. The default keeps any older code that inserts without a
--    conversation working.
-- 2. source records whether an assistant reply came from the AI or the FAQ.
-- 3. Row level security ON, matching every other table: the backend uses the
--    service key (which bypasses RLS); with RLS off the public anon key could
--    read every student's chat.
-- Additive only — no existing data is removed.
-- ============================================================================

alter table public.chatbot_messages
  add column if not exists conversation_id uuid,
  add column if not exists source text;

update public.chatbot_messages m
set conversation_id = u.conversation_id
from (
  select user_id, gen_random_uuid() as conversation_id
  from (select distinct user_id from public.chatbot_messages where conversation_id is null) d
) u
where m.user_id = u.user_id and m.conversation_id is null;

alter table public.chatbot_messages
  alter column conversation_id set default gen_random_uuid(),
  alter column conversation_id set not null;

alter table public.chatbot_messages enable row level security;

create index if not exists chatbot_messages_conversation_idx
  on public.chatbot_messages (conversation_id, created_at);
