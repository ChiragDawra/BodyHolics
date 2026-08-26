import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Caption, Heading, Screen } from '@/components/ui';
import { spacing, radius, useTheme } from '@/theme';
import { gymSlugSchema } from '@gym/validation';

/**
 * D-006 — joining starts by scanning the gym's QR code. The code carries a deep
 * link whose last path segment is the gym slug.
 *
 * The scanned value is validated against the same slug schema the server uses
 * before it goes anywhere. A QR code is attacker-supplied input: anyone can
 * print one and stick it on a wall.
 */
export default function ScanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);

  // A deep link may have opened the app directly, skipping the camera.
  const params = useLocalSearchParams<{ slug?: string }>();
  if (params.slug && !handled) {
    const parsed = gymSlugSchema.safeParse(params.slug);
    if (parsed.success) {
      setHandled(true);
      router.replace(`/(auth)/phone?gymSlug=${parsed.data}`);
    }
  }

  function onScanned(value: string) {
    if (handled) return;

    // Accept either a bare slug or a link ending in one. Nothing else: a QR that
    // encodes a URL we would then open is a phishing vector.
    const candidate = value.trim().split('?')[0]?.split('/').filter(Boolean).pop() ?? '';
    const parsed = gymSlugSchema.safeParse(candidate);

    if (!parsed.success) {
      setError('That does not look like an Urban Gym code.');
      return;
    }

    setHandled(true);
    router.push(`/(auth)/phone?gymSlug=${parsed.data}`);
  }

  if (!permission) {
    return <Screen />;
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={{ flex: 1, padding: spacing.lg, paddingTop: insets.top + spacing['3xl'], gap: spacing.lg }}>
          <Heading>Scan to join</Heading>
          <Body muted>
            Urban Gym needs the camera to read the QR code at the front desk. It is used for nothing
            else.
          </Body>
          <Button title="Allow camera" onPress={() => void requestPermission()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onScanned(data)}
        />

        <View
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: insets.bottom + spacing.xl,
            backgroundColor: theme.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.xs,
          }}
        >
          <Heading>Scan the gym code</Heading>
          <Caption>Point the camera at the QR code at the front desk.</Caption>
          {error ? <Body style={{ color: theme.danger, marginTop: spacing.xs }}>{error}</Body> : null}
        </View>
      </View>
    </Screen>
  );
}
