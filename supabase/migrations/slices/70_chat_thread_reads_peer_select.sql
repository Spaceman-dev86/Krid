-- =============================================================================
-- TRANCHE 70 — Accusés de lecture visibles par le pair (✓✓ colorés)
-- Prérequis : 16_chat
-- Problème : RLS chat_thread_reads_own ne laissait lire que sa propre ligne →
--   loadPeerLastReadAt renvoyait toujours null → ticks jamais « lus ».
-- =============================================================================

drop policy if exists "chat_thread_reads_own" on public.chat_thread_reads;
drop policy if exists "chat_thread_reads_select" on public.chat_thread_reads;
drop policy if exists "chat_thread_reads_insert" on public.chat_thread_reads;
drop policy if exists "chat_thread_reads_update" on public.chat_thread_reads;
drop policy if exists "chat_thread_reads_delete" on public.chat_thread_reads;

-- Lecture : tout participant du thread voit les last_read_at (y compris le pair)
create policy "chat_thread_reads_select"
on public.chat_thread_reads for select to authenticated
using (public.can_access_chat_thread(thread_id));

-- Écriture : uniquement sa propre ligne
create policy "chat_thread_reads_insert"
on public.chat_thread_reads for insert to authenticated
with check (
  reader_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
);

create policy "chat_thread_reads_update"
on public.chat_thread_reads for update to authenticated
using (
  reader_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
)
with check (
  reader_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
);

create policy "chat_thread_reads_delete"
on public.chat_thread_reads for delete to authenticated
using (
  reader_id = auth.uid()
  and public.can_access_chat_thread(thread_id)
);
