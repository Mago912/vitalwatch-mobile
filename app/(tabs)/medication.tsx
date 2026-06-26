import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appColors } from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

export default function MedicationScreen() {
  const { activateMedicationReminder, markMedicationTaken, medications, profile } = useVitalWatch();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.appName}>VitalWatch</Text>
        <Text style={styles.title}>Medicacion</Text>
        <Text style={styles.subtitle}>Recordatorios simulados para {profile.elderName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medicamentos programados</Text>

        {medications.map((medication) => {
          const isTaken = medication.status === 'Tomado';

          return (
            <View key={medication.id} style={styles.medicationCard}>
              <View style={styles.medicationHeader}>
                <View style={styles.medicationInfo}>
                  <Text style={styles.medicationName}>{medication.name}</Text>
                  <Text style={styles.medicationTime}>Hora: {medication.time}</Text>
                </View>
                <View style={[styles.badge, isTaken ? styles.badgeTaken : styles.badgePending]}>
                  <Text style={[styles.badgeText, isTaken ? styles.badgeTextTaken : styles.badgeTextPending]}>
                    {medication.status}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => markMedicationTaken(medication.id)}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: pressed ? '#334155' : isTaken ? '#94A3B8' : '#0A7EA4',
                  },
                ]}>
                <Text style={styles.primaryButtonText}>Marcar como tomado</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Simular recordatorio</Text>
        <Text style={styles.helpText}>
          Este boton cambia el estado principal a medicacion pendiente, agrega un evento al historial
          y muestra una notificacion local.
        </Text>
        <Pressable
          onPress={activateMedicationReminder}
          style={({ pressed }) => [
            styles.reminderButton,
            { backgroundColor: pressed ? '#4C1D95' : '#6D28D9' },
          ]}>
          <Text style={styles.primaryButtonText}>Simular recordatorio de medicacion</Text>
        </Pressable>
      </View>
    </ScrollView>
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
    gap: 14,
    borderCurve: 'continuous',
  },
  sectionTitle: {
    color: appColors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  medicationCard: {
    borderColor: appColors.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 14,
    borderCurve: 'continuous',
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  medicationInfo: {
    flex: 1,
    gap: 4,
  },
  medicationName: {
    color: appColors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  medicationTime: {
    color: appColors.muted,
    fontSize: 15,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeTaken: {
    backgroundColor: '#DCFCE7',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  badgeTextPending: {
    color: '#78350F',
  },
  badgeTextTaken: {
    color: '#064E3B',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderCurve: 'continuous',
  },
  reminderButton: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderCurve: 'continuous',
  },
  primaryButtonText: {
    color: appColors.buttonText,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  helpText: {
    color: appColors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
