// lib/db.js — Postgres connection (works with Neon, Supabase, Vercel Postgres, etc.)
import { Pool } from 'pg';

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.PRISMA_DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: process.env.PRISMA_DATABASE_URL,
      ssl: { rejectUnauthorized: false } // most managed Postgres providers require this
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}
