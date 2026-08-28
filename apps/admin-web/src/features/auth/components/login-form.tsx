'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@/components/ui';
import { staffLoginSchema, type StaffLoginInput } from '../schemas';
import { useSignIn } from '../hooks';

export function LoginForm({ next, reason }: { next: string; reason?: string }) {
  const router = useRouter();
  const signIn = useSignIn();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginInput>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await signIn.mutateAsync(values);
    // `next` arrives as a path, never a full URL, so this cannot be pointed off-site.
    router.replace(next);
    router.refresh();
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
      {reason === 'idle' ? (
        <p
          role="status"
          className="rounded-[var(--radius-md)] bg-warning-100 px-3 py-2 text-sm text-warning-700"
        >
          You were signed out after 30 minutes of inactivity.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="identifier">Username or work email</Label>
        <Input
          id="identifier"
          // Deliberately `text`, not `email`: the browser's own email validation
          // would reject a bare username before the form ever sees it.
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          aria-invalid={errors.identifier ? true : undefined}
          {...register('identifier')}
        />
        {errors.identifier ? (
          <p className="text-xs text-danger-500">Enter your username or email address.</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-xs text-danger-500">Enter your password.</p>
        ) : null}
      </div>

      {signIn.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {signIn.error.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || signIn.isPending}>
        {signIn.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
