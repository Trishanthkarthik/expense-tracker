// ============================================================
// supabase.js — Supabase Client Setup
// ============================================================
// This file initialises the Supabase client using your project's
// URL and public (anon) API key.  Every other script imports the
// `supabase` object from here, so you only need to change the
// credentials in ONE place.
// ============================================================

// 🔑  STEP 1 – Paste your Supabase project URL here.
//     Find it in: Supabase Dashboard → Project Settings → API
const SUPABASE_URL = "https://yffjgcxxbipaujzlxsbn.supabase.co";

// 🔑  STEP 2 – Paste your project's "anon / public" key here.
//     Find it in: Supabase Dashboard → Project Settings → API
//     ⚠️  This key is safe to expose in the browser because
//         Row Level Security (RLS) protects the data.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZmpnY3h4YmlwYXVqemx4c2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDUyNjEsImV4cCI6MjA5MDc4MTI2MX0.8uAfPU2stDLw32CCKRs2axNrePhf6dtoRIvpdSMCOn4";

// Import the Supabase client factory from the CDN bundle.
// (No npm / bundler needed — works directly in the browser.)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Create and export a single shared Supabase client instance.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
