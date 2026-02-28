-- Migration: Create oauth_states table
-- Run this in your Supabase SQL Editor to add this critical table

create table if not exists public.oauth_states (
  id              uuid primary key default uuid_generate_v4(),
  
  -- which user is this auth flow for?
  user_id         uuid not null references public.users(id) on delete cascade,
  
  -- CSRF nonce: must match (one-time use)
  nonce           text not null,
  
  -- expiry: typically 10 minutes from creation
  expires_at      timestamptz not null,
  
  -- timestamps
  created_at      timestamptz not null default now(),
  
  -- prevent duplicate nonces
  unique(user_id, nonce)
);

create index if not exists idx_oauth_states_user on public.oauth_states(user_id);
create index if not exists idx_oauth_states_expires on public.oauth_states(expires_at);

comment on table public.oauth_states is
  'Temporary OAuth CSRF tokens during Gmail connect flow. Auto-cleanup after 10 min.';
