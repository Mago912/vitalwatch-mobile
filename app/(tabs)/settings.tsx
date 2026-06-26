import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { appColors, DeviceConnection } from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

const connectionModes: DeviceConnection['connectionMode'][] = ['Simulacion', 'WiFi', 'Bluetooth', 'API'];

export default function SettingsScreen() {
  const { deviceConnection, profile, updateDeviceConnection, updateProfile } = useVitalWatch();
  const [elderName, setElderName] = useState(profile.elderName);
  const [contactName, setContactName] = useState(profile.contactName);
  const [contactInfo, setContactInfo] = useState(profile.contactInfo);
  const [deviceName, setDeviceName] = useState(deviceConnection.deviceName);
  const [connectionMode, setConnectionMode] =
    useState<DeviceConnection['connectionMode']>(deviceConnection.connectionMode);
  const [endpoint, setEndpoint] = useState(deviceConnection.endpoint);

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
        <Text style={styles.subtitle}>Datos simulados del usuario y su responsable.</Text>
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
          Esta configuracion todavia es simulada. Sirve para dejar preparada la app para WiFi,
          Bluetooth o una API cuando el hardware este listo.
        </Text>

        <InputField
          label="Nombre del dispositivo"
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder="Ej: Pulsera VitalWatch ESP32"
        />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Modo de conexion futura</Text>
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
          label="IP o URL simulada"
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

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Importante</Text>
        <Text style={styles.noteText}>
          Por ahora estos datos no envian mensajes reales. Sirven para mostrar como sera la app
          cuando conectemos la pulsera o un backend.
        </Text>
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
});
