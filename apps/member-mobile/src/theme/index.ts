import { useColorScheme } from 'react-native';
import { themes, palette, spacing, radius, fontSize, fontWeight, lineHeight } from '@gym/ui';
import type { Theme } from '@gym/ui';

/**
 * The tokens come from packages/ui so the two clients cannot drift apart on what
 * "accent" or "danger" means. Only the hook that picks a scheme is local, since
 * it needs react-native.
 */
export { palette, spacing, radius, fontSize, fontWeight, lineHeight };
export type { Theme };

export function useTheme(): Theme {
  // Follows the OS setting. A gym floor is bright and a locker room is not, so
  // this is worth respecting rather than hardcoding one.
  return useColorScheme() === 'dark' ? themes.dark : themes.light;
}
