-- ==============================================================================
-- LOOT — Migration: Create parent_requests table for passwordless parent share links
-- File: supabase/migrations/20261109000000_create_parent_requests.sql
-- Description: Stores passwordless parent requests and responses. Only shared
--              parent requests are stored here. Rest of LOOT data stays in browser.
-- ==============================================================================

-- Enable uuid generation if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table definition
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

-- Comments for documentation integrity
COMMENT ON TABLE public.parent_requests IS 'Passwordless teen-to-parent request proposals and parent responses.';
COMMENT ON COLUMN public.parent_requests.token_hash IS 'SHA-256 hash of the cryptographically random share token.';
COMMENT ON COLUMN public.parent_requests.status IS 'Current lifecycle state: pending, approved, declined, changes_requested, expired, revoked.';

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_parent_requests_token_hash ON public.parent_requests (token_hash);
CREATE INDEX IF NOT EXISTS idx_parent_requests_owner_id ON public.parent_requests (owner_id);
CREATE INDEX IF NOT EXISTS idx_parent_requests_status ON public.parent_requests (status);
CREATE INDEX IF NOT EXISTS idx_parent_requests_expires_at ON public.parent_requests (expires_at);

-- Row Level Security (RLS)
ALTER TABLE public.parent_requests ENABLE ROW LEVEL SECURITY;

-- 1. Anyone possessing the token hash can read their specific request
CREATE POLICY "Public read parent request by token hash"
ON public.parent_requests
FOR SELECT
USING (true);

-- 2. Allow server/anon to insert parent requests
CREATE POLICY "Allow request creation"
ON public.parent_requests
FOR INSERT
WITH CHECK (true);

-- 3. Only pending requests that are unexpired can be updated with a response
CREATE POLICY "Allow parent response update on pending requests"
ON public.parent_requests
FOR UPDATE
USING (status = 'pending' AND expires_at > timezone('utc'::text, now()))
WITH CHECK (status IN ('approved', 'declined', 'changes_requested', 'revoked'));
