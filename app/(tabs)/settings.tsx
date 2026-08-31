import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  appColors,
  DeviceConnection,
  DeviceDisplayView,
  deviceDisplayViews,
} from '@/constants/vitalwatch';
import { useAuth } from '@/providers/auth-provider';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

const connectionModes: DeviceConnection['connectionMode'][] = ['Simulacion', 'WiFi', 'Bluetooth', 'API'];

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const {
    deviceConnection,
    displayControl,
    displayControlMessage,
    isDisplayControlSyncing,
    notificationPermission,
    profile,
    pushNotificationMessage,
    pushNotificationStatus,
    retryPushNotifications,
    setDisplayEnabled,
    setDisplayView,
    updateDeviceConnection,
    updateProfile,
  } = useVitalWatch();
  const [elderName, setElderName] = useState(profile.elderName);
  const [contactName, setContactName] = useState(profile.contactName);
  const [contactInfo, setContactInfo] = useState(profile.contactInfo);
  const [deviceName, setDeviceName] = useState(deviceConnection.deviceName);
  const [connectionMode, setConnectionMode] =
    useState<DeviceConnection['connectionMode']>(deviceConnection.connectionMode);
  const [endpoint, setEndpoint] = useState(deviceConnection.endpoint);
  const isRegisteringPushNotifications = pushNotificationStatus === 'Registrando';
  const appVersion = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? 'desarrollo';
  const buildVersion = Constants.nativeBuildVersion ?? 'sin numero';

  function displayViewLabel(view: DeviceDisplayView | null) {
    if (!view) return 'Sin confirmacion todavia';
    return deviceDisplayViews.find((option) => option.value === view)?.label ?? view;
  }

  useEffect(() => {
    setElderName(profile.elderName);
    setContactName(profile.contactName);
    setContactInfo(profile.contactInfo);
  }, [profile]);

  useEffect(() => {
    setDeviceName(deviceConnection.deviceName);
    setConnectionMode(deviceConnection.connectionMode);
    setEndpoint(deviceConnection.endpoint);
  }, [deviceConnection]);

  function handleSave() {
    updateProfile({
      elderName,
      contactName,
      contactInfo,
    });
  }

  function handleSaveDeviceConnection() {
    updateDeviceConnection({
      deviceName,
      connectionMode,
      endpoint,
    });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.appName}>VitalWatch</Text>
        <Text style={styles.title}>Configuracion</Text>
        <Text style={styles.subtitle}>Datos del usuario, la pulsera y la cuenta responsable.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Control de pantalla</Text>
        <Text style={styles.sectionHelp}>
          Elegí qué información querés ver en la TFT. El ESP32 sigue midiendo y enviando alertas,
          y una caída o SOS siempre tiene prioridad. La orden puede tardar hasta 30 segundos.
        </Text>

        <View style={styles.displayStatusBox}>
          <Text style={styles.displayStatusLabel}>Orden solicitada</Text>
          <Text style={styles.displayStatusValue}>
            {displayControl.desiredOn ? 'Pantalla encendida' : 'Pantalla apagada'}
          </Text>
          <Text style={styles.displayStatusLabel}>Vista solicitada</Text>
          <Text style={styles.displayStatusValue}>
            {displayViewLabel(displayControl.desiredView)}
          </Text>
          <Text style={styles.displayStatusLabel}>Confirmado por el ESP32</Text>
          <Text style={styles.displayStatusValue}>
            {displayControl.reportedOn === null
              ? 'Sin confirmacion todavia'
              : displayControl.reportedOn
                ? `Encendida: ${displayViewLabel(displayControl.reportedView)}`
                : 'Pantalla apagada'}
          </Text>
        </View>

        <Text style={styles.sectionHelp}>{displayControlMessage}</Text>

        <View style={styles.displayActions}>
          <Pressable
            disabled={isDisplayControlSyncing}
            onPress={() => void setDisplayEnabled(true)}
            style={({ pressed }) => [
              styles.displayButton,
              styles.displayButtonOn,
              pressed && styles.displayButtonPressed,
              isDisplayControlSyncing && styles.outlineButtonDisabled,
            ]}>
            <Text style={styles.displayButtonText}>Encender</Text>
          </Pressable>
          <Pressable
            disabled={isDisplayControlSyncing}
            onPress={() => void setDisplayEnabled(false)}
            style={({ pressed }) => [
              styles.displayButton,
              styles.displayButtonOff,
              pressed && styles.displayButtonPressed,
              isDisplayControlSyncing && styles.outlineButtonDisabled,
            ]}>
            <Text style={styles.displayButtonText}>Apagar</Text>
          </Pressable>
        </View>

        <Text style={styles.displayPickerTitle}>Mostrar en la pulsera</Text>
        <View style={styles.displayViewGrid}>
          {deviceDisplayViews.map((option) => {
            const isActive = displayControl.desiredOn && displayControl.desiredView === option.value;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                disabled={isDisplayControlSyncing}
                key={option.value}
                onPress={() => void setDisplayView(option.value)}
                style={({ pressed }) => [
                  styles.displayViewButton,
                  isActive && styles.displayViewButtonActive,
                  pressed && styles.displayButtonPressed,
                  isDisplayControlSyncing && styles.outlineButtonDisabled,
                ]}>
                <Text
                  style={[
                    styles.displayViewButtonText,
                    isActive && styles.displayViewButtonTextActive,
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.hardwareWarning}>
          Con LED conectado directo a 3V3, el controlador se duerme pero la luz puede seguir
          encendida. Para ahorrar realmente se necesita controlar LED con un MOSFET.
        </Text>
      </View>

      <View style={styles.section}>
        <InputField
          label="Nombre del adulto mayor"
          value={elderName}
          onChangeText={setElderName}
          placeholder="Ej: Alicia Gomez"
        />
        <InputField
          label="Contacto responsable"
          value={contactName}
          onChangeText={setContactName}
          placeholder="Ej: Mariana Gomez"
        />
        <InputField
          label="Telefono o correo"
          value={contactInfo}
          onChangeText={setContactInfo}
          placeholder="Ej: +54 9 11 5555-1234"
        />

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: pressed ? '#075985' : appColors.primary },
          ]}>
          <Text style={styles.saveButtonText}>Guardar cambios</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pulsera y ESP32</Text>
        <Text style={styles.sectionHelp}>
          La cuenta ya esta vinculada con la pulsera mediante Supabase. Estos campos describen
          como queres identificar y conectar el hardware durante las pruebas.
        </Text>

        <InputField
          label="Nombre del dispositivo"
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder="Ej: Pulsera VitalWatch ESP32"
        />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Modo de conexion</Text>
          <View style={styles.modeGrid}>
            {connectionModes.map((mode) => {
              const isSelected = connectionMode === mode;

              return (
                <Pressable
                  key={mode}
                  onPress={() => setConnectionMode(mode)}
                  style={[styles.modeButton, isSelected ? styles.modeButtonActive : undefined]}>
                  <Text style={[styles.modeText, isSelected ? styles.modeTextActive : undefined]}>
                    {mode}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <InputField
          label="IP o URL del dispositivo"
          value={endpoint}
          onChangeText={setEndpoint}
          placeholder="Ej: http://192.168.4.1/estado"
        />

        <Pressable
          onPress={handleSaveDeviceConnection}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: pressed ? '#075985' : appColors.primary },
          ]}>
          <Text style={styles.saveButtonText}>Guardar datos de pulsera</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificaciones remotas</Text>
        <View style={styles.pushStatusRow}>
          <View
            style={[
              styles.pushStatusDot,
              pushNotificationStatus === 'Activas'
                ? styles.pushStatusDotActive
                : styles.pushStatusDotInactive,
            ]}
          />
          <Text style={styles.pushStatusText}>{pushNotificationStatus}</Text>
        </View>
        <Text style={styles.sectionHelp}>{pushNotificationMessage}</Text>
        <Text style={styles.diagnosticText}>
          Permiso del sistema: {notificationPermission ? 'concedido' : 'no concedido'}
        </Text>
        <Text style={styles.diagnosticText}>
          Version instalada: {appVersion} ({buildVersion})
        </Text>
        <Pressable
          disabled={isRegisteringPushNotifications}
          onPress={() => void retryPushNotifications()}
          style={({ pressed }) => [
            styles.outlineButton,
            isRegisteringPushNotifications && styles.outlineButtonDisabled,
            pressed && !isRegisteringPushNotifications && styles.outlineButtonPressed,
          ]}>
          <Text style={styles.outlineButtonText}>
            {isRegisteringPushNotifications ? 'Registrando...' : 'Reintentar registro'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openSettings()}
          style={({ pressed }) => [
            styles.systemSettingsButton,
            pressed && styles.systemSettingsButtonPressed,
          ]}>
          <Text style={styles.systemSettingsButtonText}>Abrir permisos de Android</Text>
        </Pressable>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Importante</Text>
        <Text style={styles.noteText}>
          Los datos del contacto siguen siendo informativos. Las alertas remotas ya se envian al
          celular mediante Supabase y Expo, pero todavia no mandan SMS ni correos.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cuenta</Text>
        <Text style={styles.sectionHelp}>{session?.user.email}</Text>
        <Pressable
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}>
          <Text style={styles.signOutButtonText}>Cerrar sesion</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InputField({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  appName: {
    color: appColors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  title: {
    color: appColors.text,
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: appColors.muted,
    fontSize: 17,
    marginTop: 4,
  },
  section: {
    backgroundColor: appColors.card,
    borderColor: appColors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 16,
    borderCurve: 'continuous',
  },
  sectionTitle: {
    color: appColors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  sectionHelp: {
    color: appColors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  diagnosticText: {
    color: appColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: appColors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: appColors.text,
    fontSize: 17,
    minHeight: 54,
    paddingHorizontal: 14,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeButton: {
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  modeButtonActive: {
    backgroundColor: '#E0F2FE',
    borderColor: appColors.primary,
  },
  modeText: {
    color: appColors.muted,
    fontSize: 15,
    fontWeight: '900',
  },
  modeTextActive: {
    color: '#075985',
  },
  saveButton: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderCurve: 'continuous',
  },
  saveButtonText: {
    color: appColors.buttonText,
    fontSize: 17,
    fontWeight: '900',
  },
  pushStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  displayStatusBox: {
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  displayStatusLabel: {
    color: appColors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  displayStatusValue: {
    color: appColors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  displayActions: {
    flexDirection: 'row',
    gap: 10,
  },
  displayPickerTitle: {
    color: appColors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  displayViewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  displayViewButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: appColors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 12,
    width: '48%',
  },
  displayViewButtonActive: {
    backgroundColor: '#E0F2FE',
    borderColor: appColors.primary,
    borderWidth: 2,
  },
  displayViewButtonText: {
    color: appColors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  displayViewButtonTextActive: {
    color: '#075985',
  },
  displayButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    padding: 12,
  },
  displayButtonOn: {
    backgroundColor: '#0E9F6E',
  },
  displayButtonOff: {
    backgroundColor: '#475569',
  },
  displayButtonPressed: {
    opacity: 0.72,
  },
  displayButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  hardwareWarning: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  pushStatusDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  pushStatusDotActive: {
    backgroundColor: '#0E9F6E',
  },
  pushStatusDotInactive: {
    backgroundColor: '#F59E0B',
  },
  pushStatusText: {
    color: appColors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: appColors.primary,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 54,
    padding: 12,
  },
  outlineButtonPressed: {
    backgroundColor: '#E0F2FE',
  },
  outlineButtonDisabled: {
    opacity: 0.55,
  },
  outlineButtonText: {
    color: appColors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  systemSettingsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    padding: 10,
  },
  systemSettingsButtonPressed: {
    opacity: 0.65,
  },
  systemSettingsButtonText: {
    color: appColors.muted,
    fontSize: 15,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  noteCard: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    borderCurve: 'continuous',
  },
  noteTitle: {
    color: '#075985',
    fontSize: 18,
    fontWeight: '900',
  },
  noteText: {
    color: '#075985',
    fontSize: 15,
    lineHeight: 22,
  },
  signOutButton: {
    alignItems: 'center',
    borderColor: '#DC2626',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    padding: 12,
  },
  signOutButtonPressed: {
    backgroundColor: '#FEE2E2',
  },
  signOutButtonText: {
    color: '#B91C1C',
    fontSize: 16,
    fontWeight: '900',
  },
});
