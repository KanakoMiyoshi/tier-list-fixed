"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // build時に落とさないため、throwしない
    console.warn("Supabase env missing (build time).");
    // ダミーを返す（実行されない前提）
    return {} as SupabaseClient;
  }

  _client = createClient(url, key);
  return _client;
}
