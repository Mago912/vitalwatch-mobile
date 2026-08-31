import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { appColors, currentArgentinaDate, Medication } from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

function createEmptyForm() {
  return {
    name: '',
    dose: '',
    date: currentArgentinaDate(),
    time: '',
  };
}

export default function MedicationScreen() {
  const {
    activateMedicationReminder,
    addMedication,
    deleteMedication,
    isMedicationSyncing,
    markMedicationPending,
    markMedicationTaken,
    medicationSyncMessage,
    medications,
    profile,
    refreshMedications,
    updateMedication,
  } = useVitalWatch();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(createEmptyForm);
  const [formError, setFormError] = useState('');

  const editingMedication = medications.find((medication) => medication.id === editingId);
  const formTitle = editingMedication ? 'Editar medicamento' : 'Agregar medicamento';

  function startEditing(medication: Medication) {
    setEditingId(medication.id);
    setForm({
      name: medication.name,
      dose: medication.dose || '',
      date: medication.date,
      time: medication.time,
    });
  }

  function clearForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setFormError('');
  }

  async function handleSaveMedication() {
    const name = form.name.trim();
    const dose = form.dose.trim();
    const date = form.date.trim();
    const time = form.time.trim();

    if (!name || !date || !time) {
      setFormError('Completa el nombre, la fecha y la hora.');
      return;
    }

    if (!isValidDate(date)) {
      setFormError('Escribe una fecha valida con formato AAAA-MM-DD, por ejemplo 2026-08-31.');
      return;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setFormError('Escribe la hora con formato HH:MM, por ejemplo 09:00.');
      return;
    }

    setFormError('');
    let wasSaved = false;

    if (editingMedication) {
      wasSaved = await updateMedication({
        ...editingMedication,
        name,
        dose: dose || 'Dosis no especificada',
        date,
        time,
      });
    } else {
      wasSaved = await addMedication({
        name,
        dose: dose || 'Dosis no especificada',
        date,
        time,
      });
    }

    if (wasSaved) {
      clearForm();
    }
  }

  async function handleMedicationStatus(medication: Medication) {
    if (medication.status === 'Tomado') {
      await markMedicationPending(medication.id);
    } else {
      await markMedicationTaken(medication.id);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.appName}>VitalWatch</Text>
        <Text style={styles.title}>Medicacion</Text>
        <Text style={styles.subtitle}>Recordatorios personalizados para {profile.elderName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{formTitle}</Text>
        <Text style={styles.helpText}>
          Los cambios se guardan en Supabase para que la app y el ESP32 vean la misma informacion.
          AsyncStorage conserva una copia para cuando no haya conexion.
        </Text>

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

        <InputField
          label="Nombre"
          value={form.name}
          onChangeText={(name) => setForm((currentForm) => ({ ...currentForm, name }))}
          placeholder="Ej: Losartan 50 mg"
          editable={!isMedicationSyncing}
        />
        <InputField
          label="Dosis"
          value={form.dose}
          onChangeText={(dose) => setForm((currentForm) => ({ ...currentForm, dose }))}
          placeholder="Ej: 1 comprimido"
          editable={!isMedicationSyncing}
        />
        <InputField
          label="Fecha"
          value={form.date}
          onChangeText={(date) => setForm((currentForm) => ({ ...currentForm, date }))}
          placeholder="Ej: 2026-08-31"
          editable={!isMedicationSyncing}
        />
        <InputField
          label="Hora"
          value={form.time}
          onChangeText={(time) => setForm((currentForm) => ({ ...currentForm, time }))}
          placeholder="Ej: 09:00"
          editable={!isMedicationSyncing}
        />

        <View style={styles.formActions}>
          <Pressable
            onPress={handleSaveMedication}
            disabled={isMedicationSyncing}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: pressed ? '#075985' : appColors.primary },
              isMedicationSyncing && styles.disabledButton,
            ]}>
            <Text style={styles.primaryButtonText}>
              {isMedicationSyncing
                ? 'Guardando...'
                : editingMedication
                  ? 'Guardar cambios'
                  : 'Agregar medicamento'}
            </Text>
          </Pressable>

          {editingMedication ? (
            <Pressable onPress={clearForm} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancelar edicion</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.syncHeader}>
          <View style={styles.syncText}>
            <Text style={styles.sectionTitle}>Medicamentos programados</Text>
            <Text style={styles.helpText}>{medicationSyncMessage}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Actualizar medicamentos"
            disabled={isMedicationSyncing}
            onPress={() => void refreshMedications()}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.refreshButtonPressed,
              isMedicationSyncing && styles.disabledButton,
            ]}>
            <Text style={styles.refreshButtonText}>{isMedicationSyncing ? '...' : 'Actualizar'}</Text>
          </Pressable>
        </View>

        {medications.length === 0 ? (
          <Text style={styles.helpText}>Todavia no hay medicamentos cargados.</Text>
        ) : null}

        {medications.map((medication) => {
          const isTaken = medication.status === 'Tomado';

          return (
            <View key={medication.id} style={styles.medicationCard}>
              <View style={styles.medicationHeader}>
                <View style={styles.medicationInfo}>
                  <Text style={styles.medicationName}>{medication.name}</Text>
                  <Text style={styles.medicationTime}>Dosis: {medication.dose || 'No cargada'}</Text>
                  <Text style={styles.medicationTime}>
                    Fecha y hora: {formatMedicationDate(medication.date)} a las {medication.time}
                  </Text>
                </View>
                <View style={[styles.badge, isTaken ? styles.badgeTaken : styles.badgePending]}>
                  <Text style={[styles.badgeText, isTaken ? styles.badgeTextTaken : styles.badgeTextPending]}>
                    {medication.status}
                  </Text>
                </View>
              </View>

              <View style={styles.medicationActions}>
                <Pressable
                  disabled={isMedicationSyncing}
                  onPress={() => void handleMedicationStatus(medication)}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor: pressed ? '#334155' : isTaken ? '#64748B' : '#0A7EA4',
                    },
                    isMedicationSyncing && styles.disabledButton,
                  ]}>
                  <Text style={styles.primaryButtonText}>
                    {isTaken ? 'Volver a pendiente' : 'Marcar como tomado'}
                  </Text>
                </Pressable>

                <View style={styles.smallActions}>
                  <Pressable
                    disabled={isMedicationSyncing}
                    onPress={() => startEditing(medication)}
                    style={[styles.secondaryButton, isMedicationSyncing && styles.disabledButton]}>
                    <Text style={styles.secondaryButtonText}>Editar</Text>
                  </Pressable>
                  <Pressable
                    disabled={isMedicationSyncing}
                    onPress={() => void deleteMedication(medication.id)}
                    style={[styles.deleteButton, isMedicationSyncing && styles.disabledButton]}>
                    <Text style={styles.deleteButtonText}>Eliminar</Text>
                  </Pressable>
                </View>
              </View>
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

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatMedicationDate(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function InputField({
  editable,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  editable: boolean;
  label: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        style={[styles.input, !editable && styles.disabledInput]}
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
    gap: 14,
    borderCurve: 'continuous',
  },
  sectionTitle: {
    color: appColors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  helpText: {
    color: appColors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '700',
  },
  syncHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  syncText: {
    flex: 1,
    gap: 6,
  },
  refreshButton: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  refreshButtonPressed: {
    backgroundColor: '#BAE6FD',
  },
  refreshButtonText: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '900',
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
  disabledInput: {
    opacity: 0.6,
  },
  disabledButton: {
    opacity: 0.55,
  },
  formActions: {
    gap: 10,
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
  medicationActions: {
    gap: 10,
  },
  smallActions: {
    flexDirection: 'row',
    gap: 10,
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
  saveButton: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderCurve: 'continuous',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    padding: 12,
    borderCurve: 'continuous',
  },
  deleteButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderCurve: 'continuous',
  },
  primaryButtonText: {
    color: appColors.buttonText,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: '#075985',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  deleteButtonText: {
    color: '#991B1B',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
});
