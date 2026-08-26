import { getStaffSession } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

/**
 * The proxy has already established that *someone* is signed in. This layout
 * establishes that they are staff, by reading gym_staff live (docs/04 §4).
 *
 * A signed-in non-staff user is refused here rather than redirected to login:
 * bouncing them to a login page they can already pass would loop, and it would
 * also tell them nothing about why they cannot get in.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();

  if (!session) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">This account has no staff access</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Members use the Urban Gym mobile app. If you should have access here, ask the gym owner
            to add you to the staff list.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AppShell gymName={session.gymName} fullName={session.fullName} role={session.role}>
      {children}
    </AppShell>
  );
}
