import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { Loading, Screen } from '@/components/ui';

/**
 * The entry gate. Routing here is a convenience, not a security control — a
 * member who skips it still hits RLS on every query (docs/04 §5 layer 1).
 */
export default function Index() {
  const { ready, session, hasProfile, gymId } = useAuth();

  useEffect(() => {
    if (!ready) return;

    if (!session) {
      router.replace('/(auth)/scan');
      return;
    }
    // Signed in but never finished registering: the account exists and grants
    // nothing until there is a gym_members row.
    if (!hasProfile || !gymId) {
      router.replace('/(onboarding)/profile');
      return;
    }
    router.replace('/(tabs)');
  }, [ready, session, hasProfile, gymId]);

  return (
    <Screen>
      <Loading />
    </Screen>
  );
}
