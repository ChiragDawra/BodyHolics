import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from 'react-native';
import { useTheme, spacing, radius, fontSize, fontWeight, lineHeight } from '@/theme';

/**
 * Presentational primitives. Nothing here knows what a membership or a payment
 * is — that belongs in a feature folder (docs/06 §3).
 */

export function Screen({ children, style, ...props }: ViewProps) {
  const theme = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.background }, style]} {...props}>
      {children}
    </View>
  );
}

export function Card({ children, style, ...props }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

type TypographyProps = TextProps & { muted?: boolean };

export function Heading({ style, muted, ...props }: TypographyProps) {
  const theme = useTheme();
  return (
    <Text
      style={[
        {
          color: muted ? theme.textMuted : theme.text,
          fontSize: fontSize['2xl'],
          lineHeight: lineHeight['2xl'],
          fontWeight: fontWeight.semibold,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function Body({ style, muted, ...props }: TypographyProps) {
  const theme = useTheme();
  return (
    <Text
      style={[
        {
          color: muted ? theme.textMuted : theme.text,
          fontSize: fontSize.base,
          lineHeight: lineHeight.base,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function Caption({ style, muted = true, ...props }: TypographyProps) {
  const theme = useTheme();
  return (
    <Text
      style={[
        {
          color: muted ? theme.textMuted : theme.text,
          fontSize: fontSize.sm,
          lineHeight: lineHeight.sm,
        },
        style,
      ]}
      {...props}
    />
  );
}

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
};

export function Button({ title, variant = 'primary', loading, disabled, style, ...props }: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const background =
    variant === 'primary' ? theme.accent : variant === 'secondary' ? theme.surface : 'transparent';
  const textColor = variant === 'primary' ? theme.onAccent : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: pressed && variant === 'primary' ? theme.accentPressed : background,
          borderColor: variant === 'secondary' ? theme.border : 'transparent',
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderRadius: radius.md,
          // 48pt, comfortably above the 44pt minimum touch target.
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
          opacity: isDisabled ? 0.5 : 1,
        },
        typeof style === 'function' ? undefined : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'positive' | 'warning' | 'danger' }) {
  const theme = useTheme();
  const colors = {
    neutral: { bg: theme.surfaceRaised, fg: theme.textMuted },
    positive: { bg: theme.surfaceRaised, fg: theme.accent },
    warning: { bg: theme.warningSurface, fg: theme.warning },
    danger: { bg: theme.dangerSurface, fg: theme.danger },
  }[tone];

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: colors.fg, fontSize: fontSize.xs, fontWeight: fontWeight.medium }}>
        {label}
      </Text>
    </View>
  );
}

/** An empty list and a failed load look identical unless you say which it is. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ paddingVertical: spacing['3xl'], paddingHorizontal: spacing.lg, alignItems: 'center' }}>
      <Body style={{ fontWeight: fontWeight.medium, textAlign: 'center' }}>{title}</Body>
      {hint ? <Caption style={{ marginTop: spacing.xs, textAlign: 'center' }}>{hint}</Caption> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: spacing['3xl'], paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.lg }}>
      <Body style={{ color: theme.danger, textAlign: 'center' }}>{message}</Body>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}
