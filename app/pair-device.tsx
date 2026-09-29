import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { VitalWatchLogo } from '@/components/vitalwatch-logo';
import { appColors } from '@/constants/vitalwatch';
import { useAuth } from '@/providers/auth-provider';

export default function PairDeviceScreen() {
  const { pairDevice, session, signOut } = useAuth();
  const [deviceCode, setDeviceCode] = useState('VW-001');
  const [isPairing, setIsPairing] = useState(false);
  const [message, setMessage] = useState('');
  const [pairingCode, setPairingCode] = useState('');

  async function handlePair() {
    if (!deviceCode.trim() || !pairingCode.trim()) {
      setMessage('Completa los dos codigos.');
      return;
    }

    setIsPairing(true);
    const result = await pairDevice(deviceCode, pairingCode);
    setMessage(result.message);
    setIsPairing(false);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <VitalWatchLogo compact />
          <Text style={styles.title}>Vincular pulsera</Text>
          <Text style={styles.subtitle}>
            Usa el codigo del dispositivo y el codigo privado entregado con la pulsera.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.accountText}>Cuenta: {session?.user.email}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Codigo de dispositivo</Text>
            <TextInput
              autoCapitalize="characters"
              editable={!isPairing}
              onChangeText={setDeviceCode}
              style={styles.input}
              value={deviceCode}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Codigo de vinculacion</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isPairing}
              onChangeText={setPairingCode}
              placeholder="VW-XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={pairingCode}
            />
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            disabled={isPairing}
            onPress={() => void handlePair()}
            style={[styles.primaryButton, isPairing && styles.disabled]}>
            {isPairing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Vincular con VitalWatch</Text>
            )}
          </Pressable>

          <Pressable disabled={isPairing} onPress={() => void signOut()} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Cerrar sesion</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 26 },
  header: { gap: 6 },
  appName: { color: appColors.primary, fontSize: 18, fontWeight: '900' },
  title: { color: appColors.text, fontSize: 32, fontWeight: '900' },
  subtitle: { color: appColors.muted, fontSize: 17, lineHeight: 24 },
  form: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  accountText: { color: appColors.muted, fontSize: 14, fontWeight: '700' },
  inputGroup: { gap: 8 },
  label: { color: appColors.text, fontSize: 16, fontWeight: '800' },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: appColors.text,
    fontSize: 17,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  message: { color: appColors.muted, fontSize: 15, lineHeight: 21 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: appColors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 58,
    padding: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  signOutButton: { alignItems: 'center', minHeight: 46, justifyContent: 'center' },
  signOutText: { color: appColors.muted, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
