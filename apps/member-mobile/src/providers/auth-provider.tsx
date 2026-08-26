import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Who is signed in, and which gym they belong to.
 *
 * `gymId` is resolved from `gym_members` under RLS rather than stored anywhere a
 * client could edit. It is a convenience for routing and for read queries; it is
 * never what authorizes anything — every Edge Function resolves the gym again
 * from the caller's own row (docs/07 §1).
 */

type AuthState = {
  session: Session | null;
  userId: string | null;
  gymId: string | null;
  memberCode: string | null;
  /** True once the stored session has been read; screens wait on this. */
  ready: boolean;
  hasProfile: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [membership, setMembership] = useState<{
    gymId: string | null;
    memberCode: string | null;
    hasProfile: boolean;
  }>({ gymId: null, memberCode: null, hasProfile: false });

  async function loadMembership(userId: string | null) {
    if (!userId) {
      setMembership({ gymId: null, memberCode: null, hasProfile: false });
      return;
    }

    const [{ data: member }, { data: profile }] = await Promise.all([
      supabase.from('gym_members').select('gym_id, member_code').eq('status', 'ACTIVE').maybeSingle(),
      supabase.from('profiles').select('id').eq('id', userId).maybeSingle(),
    ]);

    setMembership({
      gymId: member?.gym_id ?? null,
      memberCode: member?.member_code ?? null,
      hasProfile: Boolean(profile),
    });
  }

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadMembership(data.session?.user.id ?? null);
      setReady(true);
    });

    // Covers sign-in, sign-out, and a refresh that fails because the token was
    // revoked — docs/04 §3 says an expired refresh routes back to onboarding.
    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return;
      setSession(next);
      await loadMembership(next?.user.id ?? null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      userId: session?.user.id ?? null,
      gymId: membership.gymId,
      memberCode: membership.memberCode,
      hasProfile: membership.hasProfile,
      ready,
      refresh: () => loadMembership(session?.user.id ?? null),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, membership, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
