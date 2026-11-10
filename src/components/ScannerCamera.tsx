import {
  AvailableLenses,
  BarcodeScanningResult,
  BarcodeType,
  CameraView,
  type LensInfo,
} from 'expo-camera';
import { memo, useCallback, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

/** 1D product barcodes only — never QR / 2D codes. */
export const SCANNER_BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
];

type ScannerCameraProps = {
  active: boolean;
  onBarcodeScanned?: (result: BarcodeScanningResult) => void;
  onCameraReady?: () => void;
};

const WIDE_ANGLE_DEVICE_TYPE = 'AVCaptureDeviceTypeBuiltInWideAngleCamera';

/**
 * Pick the plain 1× back lens. Since SDK 58, expo-camera reports lenses as
 * `{ deviceType, localizedName }` and `selectedLens` takes the `deviceType`.
 * Without a real match, iOS falls back to the system-preferred camera —
 * often the 0.5× ultra-wide, which is bad for close-up barcodes.
 */
function pickOneXLens(lenses: LensInfo[]): string | undefined {
  if (lenses.length === 0) return undefined;

  const wideAngle = lenses.find((l) => l.deviceType === WIDE_ANGLE_DEVICE_TYPE);
  if (wideAngle) return wideAngle.deviceType;

  // Fallback by name for unexpected device types.
  const label = (l: LensInfo) => `${l.deviceType} ${l.localizedName}`;
  const isExcluded = (l: LensInfo) =>
    /ultra|tele|dual|triple|lidar|true\s*depth|continuity|0\s*[.,]\s*5/i.test(
      label(l)
    );

  const candidates = lenses.filter((l) => !isExcluded(l));
  if (candidates.length === 0) return lenses[0].deviceType;

  const wide = candidates.find((l) => /wide/i.test(label(l)));
  if (wide) return wide.deviceType;

  // Typical default: "Back Camera" / "Bakre kamera" / similar short names.
  const plainBack = candidates.find((l) =>
    /^(back|bakre|rear)\b/i.test(l.localizedName.trim())
  );
  return (plainBack ?? candidates[0]).deviceType;
}

/**
 * Shared preview used by the home scanner and fullscreen barcode capture.
 * Isolated + memoized so overlay re-renders (hold-to-scan) do not restart
 * the native session / reset zoom & continuous autofocus.
 */
export const ScannerCamera = memo(function ScannerCamera({
  active,
  onBarcodeScanned,
  onCameraReady,
}: ScannerCameraProps) {
  const [selectedLens, setSelectedLens] = useState<string | undefined>();

  const handleAvailableLenses = useCallback((event: AvailableLenses) => {
    if (Platform.OS !== 'ios') return;
    const next = pickOneXLens(event.lenses ?? []);
    if (!next) return;
    setSelectedLens((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      active={active}
      zoom={0}
      // Expo naming is inverted vs intuition: "off" = continuous autofocus;
      // "on" = focus once then lock (bad for barcode scanning).
      autofocus="off"
      selectedLens={selectedLens}
      onAvailableLensesChanged={handleAvailableLenses}
      barcodeScannerSettings={{ barcodeTypes: SCANNER_BARCODE_TYPES }}
      onBarcodeScanned={onBarcodeScanned}
      onCameraReady={onCameraReady}
      pointerEvents="none"
    />
  );
});
