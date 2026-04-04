import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useSettlementStore } from '@/store/settlement';

interface TunnyBunnyPayload {
  app: 'tunnybunny';
  to: string;
  amount: number;
  chain: number;
  groupId: string | null;
}

function isValidPayload(data: any): data is TunnyBunnyPayload {
  return (
    data &&
    data.app === 'tunnybunny' &&
    typeof data.to === 'string' &&
    data.to.startsWith('0x') &&
    typeof data.amount === 'number' &&
    data.amount > 0
  );
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { setSettlement } = useSettlementStore();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const payload = JSON.parse(data);

      if (!isValidPayload(payload)) {
        Alert.alert('Invalid QR', 'This QR code is not a TunnyBunny payment request.', [
          { text: 'Scan Again', onPress: () => setScanned(false) },
        ]);
        return;
      }

      // Populate settlement store and navigate to the settlement flow
      setSettlement({
        to: payload.to,
        amount: payload.amount,
        destChain: payload.chain,
        groupId: payload.groupId,
      });

      router.replace({
        pathname: '/settle/[id]',
        params: {
          id: payload.groupId || 'scan',
          from: '', // will be filled by wallet
          to: payload.to,
          amount: payload.amount.toString(),
        },
      });
    } catch {
      Alert.alert('Invalid QR', 'Could not read QR code data.', [
        { text: 'Scan Again', onPress: () => setScanned(false) },
      ]);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <FontAwesome name="camera" size={48} color="#999" />
          <Text style={styles.permissionText}>
            Camera access is needed to scan payment QR codes
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <Text style={styles.instructions}>
            Scan a TunnyBunny payment QR code
          </Text>
          <View style={styles.frame} />
          <Text style={styles.subtext}>
            Point your camera at the QR code shown{'\n'}on the payee's screen
          </Text>
        </View>
      </CameraView>

      {scanned && (
        <TouchableOpacity
          style={styles.rescanBtn}
          onPress={() => setScanned(false)}
        >
          <FontAwesome name="refresh" size={16} color="#fff" />
          <Text style={styles.rescanBtnText}>Scan Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 32,
  },
  instructions: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  frame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  subtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'transparent',
  },
  permissionText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  rescanBtn: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  rescanBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
