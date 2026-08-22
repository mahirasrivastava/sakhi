// supabase.js
// The Postgres connection behind the session store.
//
// Only one client is exported, and it holds the service-role key. There is no
// user-scoped client here because ASHA workers do not authenticate against
// Supabase Auth — they authenticate against this server (security/accounts.js,
// security/authSessions.js), which then decides what they may read. Postgres
// never sees a worker identity, so RLS has no auth.uid() to key off and the
// authorization boundary stays in requireAuth where it already is.
//
// That means the service-role key is the only credential that can reach these
// rows, and it must never leave the server. It is read from the environment and
// never returned by any route.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Both halves are required. A URL with no key would fail on the first query
// rather than at boot, which is a worse place to find out.
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

// A misconfiguration that silently falls back to the JSON file would be easy to
// miss in production, where the file is on an ephemeral disk. Say so loudly.
if (SUPABASE_URL && !SERVICE_ROLE_KEY) {
  console.warn("[supabase] SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is not — falling back to the JSON store.");
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        // This is a server process, not a browser. There is no session to
        // persist or refresh, and writing one to disk would be one more place
        // the service-role credential could leak from.
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const SESSIONS_TABLE = "triage_sessions";
