import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import type { Database } from '@gym/types';

/**
 * The member app's only Supabase client. Anon key, so every query it makes is
 * subject to RLS — there is no service-role variant on a device and there never
 * will be (CLAUDE.md rule 3). Anything a member is not allowed to do is refused
 * by the database, not by this file.
 */

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = extra.supabaseUrl as string | undefined;
const supabaseAnonKey = extra.supabaseAnonKey as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail at startup with something that names the problem, rather than letting
  // an undefined URL surface as a network error twenty screens later.
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
      'Copy .env.example to .env.local and fill them in.',
  );
}

/**
 * Session storage.
 *
 * The refresh token is a long-lived credential: whoever holds it can mint access
 * tokens until it is revoked. On a device that means the Keychain or the Android
 * Keystore, not AsyncStorage, which is plain files readable on a rooted or
 * jailbroken handset.
 *
 * SecureStore caps a value at 2048 bytes and a Supabase session is comfortably
 * under that, but the cap is real — so the adapter fails loudly rather than
 * silently dropping a session that grew.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => {
    if (value.length > 2048) {
      throw new Error('Session value exceeds the secure storage limit.');
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // SecureStore has no web implementation; the app is native, and this keeps
    // Expo Go's web preview from crashing on startup.
    storage: Platform.OS === 'web' ? AsyncStorage : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no OAuth redirect in this app — sign-in is phone OTP — so there
    // is never a session to parse out of a URL, and looking for one is a way to
    // accept a token from a link someone else sent.
    detectSessionInUrl: false,
  },
});

export const appEnv = (extra.appEnv as string | undefined) ?? 'local';

/**
 * The publishable key. It ships inside the bundle by design — it identifies the
 * project, it does not authorize anything. RLS decides what a request may do.
 */
export const anonKey = supabaseAnonKey;

/**
 * The Edge Function base URL. Derived from the same config the client was built
 * with — `supabase.functions.url` is protected, and reaching into a private
 * field is how a library upgrade breaks the app silently.
 */
export const functionsUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1`;
