-- ==============================================================================
-- LOOT — Complete Supabase Schema for Parent Shareable Links
-- File: supabase/schema.sql
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.parent_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL,
    pitch_id TEXT,
    request_type TEXT NOT NULL DEFAULT 'purchase' CHECK (request_type IN ('purchase', 'goal', 'general')),
    title TEXT NOT NULL,
    description TEXT,
    requested_amount NUMERIC(12, 2),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'changes_requested', 'expired', 'revoked')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    responded_at TIMESTAMPTZ,
    parent_message TEXT,
    response_type TEXT CHECK (response_type IS NULL OR response_type IN ('approved', 'declined', 'changes_requested')),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_parent_requests_token_hash ON public.parent_requests (token_hash);
CREATE INDEX IF NOT EXISTS idx_parent_requests_owner_id ON public.parent_requests (owner_id);
CREATE INDEX IF NOT EXISTS idx_parent_requests_status ON public.parent_requests (status);
CREATE INDEX IF NOT EXISTS idx_parent_requests_expires_at ON public.parent_requests (expires_at);

ALTER TABLE public.parent_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read parent request by token hash"
ON public.parent_requests
FOR SELECT
USING (true);

CREATE POLICY "Allow request creation"
ON public.parent_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow parent response update on pending requests"
ON public.parent_requests
FOR UPDATE
USING (status = 'pending' AND expires_at > timezone('utc'::text, now()))
WITH CHECK (status IN ('approved', 'declined', 'changes_requested', 'revoked'));
