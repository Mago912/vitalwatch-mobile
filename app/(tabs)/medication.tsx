import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { appColors, currentArgentinaDate, Medication } from '@/constants/vitalwatch';
import {
  DEFAULT_MEDICATION_DAYS,
  medicationDaysLabel,
  MEDICATION_WEEKDAYS,
  normalizeMedicationDays,
} from '@/lib/medication-schedule';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

function createEmptyForm() {
  return {
    name: '',
    dose: '',
    date: currentArgentinaDate(),
    times: [''],
    days: [...DEFAULT_MEDICATION_DAYS],
  };
}

export default function MedicationScreen() {
  const {
    addMedicationSchedules,
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
      times: [medication.time],
      days: normalizeMedicationDays(medication.days),
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
    const times = Array.from(new Set(form.times.map((time) => time.trim()))).sort();

    if (!name || !date || times.some((time) => !time) || form.days.length === 0) {
      setFormError('Completa el nombre, la fecha de inicio, los horarios y al menos un dia.');
      return;
    }

    if (!isValidDate(date)) {
      setFormError('Escribe una fecha valida con formato AAAA-MM-DD, por ejemplo 2026-08-31.');
      return;
    }

    if (times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      setFormError('Escribe cada hora con formato HH:MM, por ejemplo 09:00.');
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
        time: times[0],
        days: normalizeMedicationDays(form.days),
      });
    } else {
      wasSaved = await addMedicationSchedules(
        times.map((time) => ({
          name,
          dose: dose || 'Dosis no especificada',
          date,
          time,
          days: normalizeMedicationDays(form.days),
        }))
      );
    }

    if (wasSaved) {
      clearForm();
    }
  }

  function toggleDay(day: number) {
    setForm((currentForm) => {
      const selectedDays = currentForm.days.includes(day)
        ? currentForm.days.filter((selectedDay) => selectedDay !== day)
        : [...currentForm.days, day];

      return {
        ...currentForm,
        days: Array.from(new Set(selectedDays)).sort((left, right) => left - right),
      };
    });
  }

  function updateTime(index: number, time: string) {
    setForm((currentForm) => ({
      ...currentForm,
      times: currentForm.times.map((currentTime, currentIndex) =>
        currentIndex === index ? time : currentTime
      ),
    }));
  }

  function addTime() {
    setForm((currentForm) => ({ ...currentForm, times: [...currentForm.times, ''] }));
  }

  function removeTime(index: number) {
    setForm((currentForm) => ({
      ...currentForm,
      times: currentForm.times.filter((_, currentIndex) => currentIndex !== index),
    }));
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
          label="Fecha de inicio"
          value={form.date}
          onChangeText={(date) => setForm((currentForm) => ({ ...currentForm, date }))}
          placeholder="Ej: 2026-08-31"
          editable={!isMedicationSyncing}
        />
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{editingMedication ? 'Hora' : 'Horarios'}</Text>
          {!editingMedication ? (
            <Text style={styles.helpText}>
              Agrega una hora por cada toma diaria. Por ejemplo, 10:00 y 22:00.
            </Text>
          ) : null}
          {form.times.map((time, index) => (
            <View key={index} style={styles.timeRow}>
              <TextInput
                editable={!isMedicationSyncing}
                value={time}
                onChangeText={(nextTime) => updateTime(index, nextTime)}
                placeholder="Ej: 09:00"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                style={[styles.input, styles.timeInput, isMedicationSyncing && styles.disabledInput]}
              />
              {!editingMedication && form.times.length > 1 ? (
                <Pressable
                  accessibilityLabel={`Eliminar horario ${index + 1}`}
                  disabled={isMedicationSyncing}
                  onPress={() => removeTime(index)}
                  style={styles.removeTimeButton}>
                  <Text style={styles.removeTimeButtonText}>Quitar</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {!editingMedication ? (
            <Pressable
              disabled={isMedicationSyncing}
              onPress={addTime}
              style={[styles.addTimeButton, isMedicationSyncing && styles.disabledButton]}>
              <Text style={styles.addTimeButtonText}>+ Agregar otro horario</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Se repite los dias</Text>
          <Text style={styles.helpText}>Selecciona los dias en que debe avisar la pulsera.</Text>
          <View style={styles.weekdayRow}>
            {MEDICATION_WEEKDAYS.map((day) => {
              const selected = form.days.includes(day.value);
              return (
                <Pressable
                  key={day.value}
                  disabled={isMedicationSyncing}
                  onPress={() => toggleDay(day.value)}
                  style={[
                    styles.weekdayButton,
                    selected && styles.weekdayButtonSelected,
                    isMedicationSyncing && styles.disabledButton,
                  ]}>
                  <Text style={[styles.weekdayText, selected && styles.weekdayTextSelected]}>
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.selectedDaysText}>
            Configurado: {medicationDaysLabel(form.days)}
          </Text>
        </View>

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

        {medications.length > 0 ? (
          <Text style={styles.helpText}>
            Cada tarjeta permite alternar su estado: una toma confirmada puede volver a pendiente
            para corregirla o probar nuevamente la pulsera.
          </Text>
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
                    Proxima toma: {formatMedicationDate(medication.nextDate || medication.date)} a las {medication.time}
                  </Text>
                  <Text style={styles.medicationTime}>
                    Dias: {medicationDaysLabel(medication.days)}
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
                    {isTaken ? 'Cambiar a pendiente' : 'Marcar como tomado'}
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
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  timeInput: {
    flex: 1,
  },
  addTimeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  addTimeButtonText: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '900',
  },
  removeTimeButton: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  removeTimeButtonText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '900',
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayButton: {
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: appColors.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: 'center',
    minWidth: 48,
    paddingHorizontal: 8,
  },
  weekdayButtonSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: appColors.primary,
  },
  weekdayText: {
    color: appColors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  weekdayTextSelected: {
    color: '#075985',
  },
  selectedDaysText: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '800',
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
