import { LoginForm } from '@/features/auth/components/login-form';

export const metadata = { title: 'Sign in — Urban Gym Admin' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const params = await searchParams;

  // Only a same-origin path is ever followed. Anything else — a full URL, a
  // protocol-relative `//evil.example` — falls back to the dashboard root.
  const requested = params.next ?? '/';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Urban Gym
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Staff sign in</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Members use the mobile app. This console is for gym staff.
          </p>
        </div>

        <LoginForm next={next} {...(params.reason ? { reason: params.reason } : {})} />
      </div>
    </main>
  );
}
