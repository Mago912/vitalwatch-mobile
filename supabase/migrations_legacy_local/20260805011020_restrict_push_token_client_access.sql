create policy push_tokens_block_client_access
  on public.push_tokens
  for all
  to anon, authenticated
  using (false)
  with check (false);
