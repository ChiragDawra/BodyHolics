import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Caption, Heading, Screen } from '@/components/ui';
import { spacing, radius, fontSize, useTheme } from '@/theme';
import { gymSlugSchema } from '@gym/validation';

/**
 * D-006 — joining starts by scanning the gym's QR code. The code carries a deep
 * link whose last path segment is the gym slug.
 *
 * The scanned value is validated against the same slug schema the server uses
 * before it goes anywhere. A QR code is attacker-supplied input: anyone can
 * print one and stick it on a wall.
 */

/**
 * Whether this platform can actually read a QR code.
 *
 * On the web `CameraView` renders, but the decoding is done by the browser's
 * `BarcodeDetector`, which Safari does not implement — so on an iPhone the
 * viewfinder would open and simply never fire. Checking for the API is the
 * difference between offering a fallback and showing a camera that silently
 * does nothing.
 */
function canScanBarcodes(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/**
 * Accept either a bare slug or a link ending in one. Nothing else: a QR that
 * encodes a URL we would then open is a phishing vector.
 */
function slugFrom(value: string): string {
  return value.trim().split('?')[0]?.split('/').filter(Boolean).pop() ?? '';
}

export default function ScanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);
  const [typedCode, setTypedCode] = useState('');

  // A deep link may have opened the app directly, skipping the camera.
  const params = useLocalSearchParams<{ slug?: string }>();
  if (params.slug && !handled) {
    const parsed = gymSlugSchema.safeParse(params.slug);
    if (parsed.success) {
      setHandled(true);
      router.replace(`/(auth)/phone?gymSlug=${parsed.data}`);
    }
  }

  function accept(value: string, replace = false) {
    if (handled) return;

    const parsed = gymSlugSchema.safeParse(slugFrom(value));

    if (!parsed.success) {
      setError('That does not look like an Urban Gym code.');
      return;
    }

    setHandled(true);
    setError(null);
    const href = `/(auth)/phone?gymSlug=${parsed.data}`;
    if (replace) router.replace(href);
    else router.push(href);
  }

  // The typed path is the same validation as the scanned one, because a code
  // read off the wall by eye is exactly as untrusted as one read by the camera.
  if (!canScanBarcodes()) {
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            padding: spacing.lg,
            paddingTop: insets.top + spacing['3xl'],
            gap: spacing.lg,
          }}
        >
          <Heading>Enter the gym code</Heading>
          <Body muted>
            Scanning needs the app. On the web, type the short code printed under the QR code at the
            front desk.
          </Body>

          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <TextInput
              value={typedCode}
              onChangeText={setTypedCode}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="urban-gym"
              placeholderTextColor={theme.textMuted}
              accessibilityLabel="Gym code"
              onSubmitEditing={() => accept(typedCode)}
              style={{ color: theme.text, fontSize: fontSize.lg }}
            />
          </View>

          {error ? <Body style={{ color: theme.danger }}>{error}</Body> : null}

          <Button title="Continue" onPress={() => accept(typedCode)} />
        </View>
      </Screen>
    );
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
          onBarcodeScanned={({ data }) => accept(data)}
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
          {error ? <Body style={{ color: theme.danger }}>{error}</Body> : null}
        </View>
      </View>
    </Screen>
  );
}
