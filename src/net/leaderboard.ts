import { invoke } from '@tauri-apps/api/core';
import { supabase } from './supabase';
import { isTauri } from '../platform/tauri';
import type { ClassId } from '../game/types';

export interface LeaderRow {
  user_id: string;
  name: string;
  best_stage: number;
  best_essence: number;
  class: string;
  updated_at: string;
}

export interface ScoreInput {
  name: string;
  bestStage: number;
  bestEssence: number;
  classId: ClassId;
}

/** Google sign-in + realtime leaderboard need both a configured client and the
 *  Tauri shell (the OAuth loopback lives in Rust). */
export function leaderboardEnabled(): boolean {
  return !!supabase && isTauri();
}

function displayName(user: { user_metadata?: Record<string, unknown>; email?: string }): string {
  const m = user.user_metadata ?? {};
  return (
    (m.full_name as string) || (m.name as string) || user.email?.split('@')[0] || 'Player'
  );
}

export async function getSignedInName(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? displayName(data.user) : null;
}

/** Opens the system browser, completes Google OAuth, and signs in to Supabase.
 *  Returns the display name to persist as the player's leaderboard name. */
export async function signInWithGoogle(): Promise<string> {
  if (!supabase) throw new Error('Leaderboard is not configured.');
  const idToken = await invoke<string>('google_sign_in');
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-in returned no user.');
  return displayName(data.user);
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Upsert the player's best result. No-op when signed out or not configured. */
export async function submitScore(s: ScoreInput): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;
  const { error } = await supabase.from('scores').upsert(
    {
      user_id: user.id,
      name: s.name || displayName(user),
      best_stage: Math.floor(s.bestStage),
      best_essence: Math.floor(s.bestEssence),
      class: s.classId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function fetchTop(limit = 100): Promise<LeaderRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('scores')
    .select('user_id,name,best_stage,best_essence,class,updated_at')
    .order('best_stage', { ascending: false })
    .order('best_essence', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LeaderRow[];
}

/** Subscribe to any change on the scores table; returns an unsubscribe fn. */
export function subscribeScores(onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel('scores-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, onChange)
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
