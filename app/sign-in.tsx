import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { VitalWatchLogo } from '@/components/vitalwatch-logo';
import { appColors } from '@/constants/vitalwatch';
import { useAuth } from '@/providers/auth-provider';

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');

  async function submit(mode: 'sign-in' | 'sign-up') {
    if (!email.trim() || password.length < 6) {
      setMessage('Completa el correo y usa una contrasena de al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    const result =
      mode === 'sign-in' ? await signIn(email, password) : await signUp(email, password);
    setMessage(result.message);
    setIsSubmitting(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <VitalWatchLogo />
          <Text style={styles.title}>Iniciar sesion</Text>
          <Text style={styles.subtitle}>Acceso seguro para familiares y responsables.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSubmitting}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contrasena</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              editable={!isSubmitting}
              onChangeText={setPassword}
              placeholder="Minimo 6 caracteres"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            disabled={isSubmitting}
            onPress={() => void submit('sign-in')}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              isSubmitting && styles.disabled,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Ingresar</Text>
            )}
          </Pressable>

          <Pressable
            disabled={isSubmitting}
            onPress={() => void submit('sign-up')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
            <Text style={styles.secondaryButtonText}>Crear una cuenta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 28 },
  brandBlock: { gap: 6 },
  appName: { color: appColors.primary, fontSize: 18, fontWeight: '900' },
  title: { color: appColors.text, fontSize: 34, fontWeight: '900' },
  subtitle: { color: appColors.muted, fontSize: 17, lineHeight: 24 },
  form: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
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
  primaryButtonPressed: { backgroundColor: '#075985' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: appColors.primary,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    padding: 12,
  },
  secondaryButtonPressed: { backgroundColor: '#E0F2FE' },
  secondaryButtonText: { color: '#075985', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
