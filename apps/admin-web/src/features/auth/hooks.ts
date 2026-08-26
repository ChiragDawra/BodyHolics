'use client';

import { useMutation } from '@tanstack/react-query';
import { signInWithPassword, signOut } from './api';
import type { StaffLoginInput } from './schemas';

export function useSignIn() {
  return useMutation({
    mutationFn: (input: StaffLoginInput) => signInWithPassword(input),
  });
}

export function useSignOut() {
  return useMutation({ mutationFn: signOut });
}
