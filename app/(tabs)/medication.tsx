import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { appColors, Medication } from '@/constants/vitalwatch';
import { useVitalWatch } from '@/providers/vitalwatch-provider';

const emptyForm = {
  name: '',
  dose: '',
  time: '',
};

export default function MedicationScreen() {
  const {
    activateMedicationReminder,
    addMedication,
    deleteMedication,
    markMedicationPending,
    markMedicationTaken,
    medications,
    profile,
    updateMedication,
  } = useVitalWatch();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const editingMedication = medications.find((medication) => medication.id === editingId);
  const formTitle = editingMedication ? 'Editar medicamento' : 'Agregar medicamento';

  function startEditing(medication: Medication) {
    setEditingId(medication.id);
    setForm({
      name: medication.name,
      dose: medication.dose || '',
      time: medication.time,
    });
  }

  function clearForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSaveMedication() {
    const name = form.name.trim();
    const dose = form.dose.trim();
    const time = form.time.trim();

    if (!name || !time) {
      return;
    }

    if (editingMedication) {
      updateMedication({
        ...editingMedication,
        name,
        dose: dose || 'Dosis no especificada',
        time,
      });
    } else {
      addMedication({
        name,
        dose: dose || 'Dosis no especificada',
        time,
      });
    }

    clearForm();
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
          Estos datos quedan guardados en el celular con AsyncStorage. Mas adelante pueden venir de
          una base de datos.
        </Text>

        <InputField
          label="Nombre"
          value={form.name}
          onChangeText={(name) => setForm((currentForm) => ({ ...currentForm, name }))}
          placeholder="Ej: Losartan 50 mg"
        />
        <InputField
          label="Dosis"
          value={form.dose}
          onChangeText={(dose) => setForm((currentForm) => ({ ...currentForm, dose }))}
          placeholder="Ej: 1 comprimido"
        />
        <InputField
          label="Hora"
          value={form.time}
          onChangeText={(time) => setForm((currentForm) => ({ ...currentForm, time }))}
          placeholder="Ej: 09:00"
        />

        <View style={styles.formActions}>
          <Pressable
            onPress={handleSaveMedication}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: pressed ? '#075985' : appColors.primary },
            ]}>
            <Text style={styles.primaryButtonText}>
              {editingMedication ? 'Guardar cambios' : 'Agregar medicamento'}
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
        <Text style={styles.sectionTitle}>Medicamentos programados</Text>

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
                  <Text style={styles.medicationTime}>Hora: {medication.time}</Text>
                </View>
                <View style={[styles.badge, isTaken ? styles.badgeTaken : styles.badgePending]}>
                  <Text style={[styles.badgeText, isTaken ? styles.badgeTextTaken : styles.badgeTextPending]}>
                    {medication.status}
                  </Text>
                </View>
              </View>

              <View style={styles.medicationActions}>
                <Pressable
                  onPress={() =>
                    isTaken ? markMedicationPending(medication.id) : markMedicationTaken(medication.id)
                  }
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor: pressed ? '#334155' : isTaken ? '#64748B' : '#0A7EA4',
                    },
                  ]}>
                  <Text style={styles.primaryButtonText}>
                    {isTaken ? 'Volver a pendiente' : 'Marcar como tomado'}
                  </Text>
                </Pressable>

                <View style={styles.smallActions}>
                  <Pressable onPress={() => startEditing(medication)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Editar</Text>
                  </Pressable>
                  <Pressable onPress={() => deleteMedication(medication.id)} style={styles.deleteButton}>
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
