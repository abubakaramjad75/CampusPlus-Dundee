import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Props {
  onTokenScanned: (token: string) => void;
}

export function ExpoQrScanner({ onTokenScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Camera Permission Required</Text>
        <Text style={styles.subtitle}>
          Allow camera access to scan CampusPulse study desk QR codes, or enter the printed token manually.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          scanned
            ? undefined
            : ({ data }) => {
                setScanned(true);
                onTokenScanned(data);
              }
        }
      />
      {scanned && (
        <TouchableOpacity style={styles.button} onPress={() => setScanned(false)}>
          <Text style={styles.buttonText}>Scan Another Code</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  camera: { height: 280, borderRadius: 16, overflow: 'hidden' },
  card: { padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#0B1B3B' },
  subtitle: { fontSize: 13, color: '#475569' },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#0B1B3B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
