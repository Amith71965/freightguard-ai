CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE shipment_status AS ENUM ('attention', 'in_transit', 'rescheduled', 'escalated', 'delivered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE exception_type AS ENUM ('weather_delay', 'damage_risk', 'missed_window', 'not_found');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS demo_sessions (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  reset_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
  tracking_code text NOT NULL,
  customer_name text NOT NULL,
  carrier_name text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  promised_eta timestamptz NOT NULL,
  current_eta timestamptz NOT NULL,
  status shipment_status NOT NULL DEFAULT 'attention',
  exception_type exception_type NOT NULL,
  scenario_behavior text NOT NULL DEFAULT 'normal',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, tracking_code)
);

CREATE INDEX IF NOT EXISTS shipments_session_idx ON shipments(session_id);

CREATE TABLE IF NOT EXISTS shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipment_events_shipment_idx ON shipment_events(shipment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS calls (
  call_id text PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES shipments(id) ON DELETE SET NULL,
  lifecycle_status text NOT NULL DEFAULT 'started',
  disposition text,
  transcript jsonb,
  analysis jsonb,
  latency jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  analyzed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calls_session_idx ON calls(session_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS request_receipts (
  fingerprint text PRIMARY KEY,
  call_id text NOT NULL,
  function_name text NOT NULL,
  response jsonb,
  processing_status text NOT NULL DEFAULT 'started',
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_receipts (
  digest text PRIMARY KEY,
  event_type text NOT NULL,
  call_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
