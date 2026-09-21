import { Medication } from '@/constants/vitalwatch';
import {
  DEFAULT_MEDICATION_DAYS,
  getMedicationOccurrences,
  normalizeMedicationDays,
} from '@/lib/medication-schedule';
import { supabase } from '@/lib/supabase';

type MedicationDraft = Pick<Medication, 'name' | 'dose' | 'date' | 'time' | 'days'>;

type DeviceRow = {
  id: number;
  user_id: number;
};

type MedicationRow = {
  dose: string;
  id: number;
  name: string;
  scheduled_date: string;
  scheduled_days: number[] | null;
  scheduled_time: string;
};

type MedicationLogRow = {
  created_at: string;
  medication_id: number;
  scheduled_for: string;
  status: string;
  taken_at: string | null;
};

export async function fetchRemoteMedications(deviceCode: string) {
  const device = await findDevice(deviceCode);
  return listMedications(device);
}

export async function createRemoteMedication(deviceCode: string, medication: MedicationDraft) {
  const device = await findDevice(deviceCode);
  const { error } = await supabase.from('medications').insert({
    user_id: device.user_id,
    name: medication.name.trim(),
    dose: medication.dose.trim(),
    scheduled_date: medication.date,
    scheduled_days: normalizeMedicationDays(medication.days ?? DEFAULT_MEDICATION_DAYS),
    scheduled_time: `${medication.time}:00`,
    active: true,
  });

  if (error) {
    throw new Error(`No se pudo agregar el medicamento: ${error.message}`);
  }

  return listMedications(device);
}

export async function updateRemoteMedication(deviceCode: string, medication: Medication) {
  const device = await findDevice(deviceCode);
  const medicationId = parseMedicationId(medication.id);
  const { error } = await supabase
    .from('medications')
    .update({
      name: medication.name.trim(),
      dose: medication.dose.trim(),
      scheduled_date: medication.date,
      scheduled_days: normalizeMedicationDays(medication.days ?? DEFAULT_MEDICATION_DAYS),
      scheduled_time: `${medication.time}:00`,
    })
    .eq('id', medicationId)
    .eq('user_id', device.user_id);

  if (error) {
    throw new Error(`No se pudo actualizar el medicamento: ${error.message}`);
  }

  return listMedications(device);
}

export async function deleteRemoteMedication(deviceCode: string, id: string) {
  const device = await findDevice(deviceCode);
  const { error } = await supabase
    .from('medications')
    .update({ active: false })
    .eq('id', parseMedicationId(id))
    .eq('user_id', device.user_id);

  if (error) {
    throw new Error(`No se pudo eliminar el medicamento: ${error.message}`);
  }

  return listMedications(device);
}

export async function setRemoteMedicationStatus(
  deviceCode: string,
  id: string,
  status: 'pending' | 'taken'
) {
  const device = await findDevice(deviceCode);
  const now = new Date();
  const medicationId = parseMedicationId(id);
  const { data: medication, error: medicationError } = await supabase
    .from('medications')
    .select('scheduled_date, scheduled_days, scheduled_time')
    .eq('id', medicationId)
    .eq('user_id', device.user_id)
    .single();

  if (medicationError) {
    throw new Error(`No se pudo consultar el horario: ${medicationError.message}`);
  }

  const occurrence = getMedicationOccurrences(
    medication.scheduled_date,
    medication.scheduled_time.slice(0, 5),
    medication.scheduled_days ?? DEFAULT_MEDICATION_DAYS,
    now,
    1
  )[0];

  if (!occurrence) {
    throw new Error('No hay una proxima toma programada para este medicamento.');
  }

  const { error } = await supabase.from('medication_logs').insert({
    medication_id: medicationId,
    device_id: device.id,
    scheduled_for: occurrence.iso,
    taken_at: status === 'taken' ? now.toISOString() : null,
    status,
    source: 'mobile_app',
  });

  if (error) {
    throw new Error(`No se pudo actualizar el estado: ${error.message}`);
  }

  return listMedications(device);
}

async function findDevice(deviceCode: string): Promise<DeviceRow> {
  const { data, error } = await supabase
    .from('devices')
    .select('id, user_id')
    .eq('device_code', deviceCode.trim())
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar la pulsera: ${error.message}`);
  }

  if (!data) {
    throw new Error('La pulsera no pertenece a esta cuenta.');
  }

  return data;
}

async function listMedications(device: DeviceRow): Promise<Medication[]> {
  const { data: medicationRows, error: medicationsError } = await supabase
    .from('medications')
    .select('id, name, dose, scheduled_date, scheduled_days, scheduled_time')
    .eq('user_id', device.user_id)
    .eq('active', true)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });

  if (medicationsError) {
    throw new Error(`No se pudieron leer los medicamentos: ${medicationsError.message}`);
  }

  const medications = (medicationRows ?? []) as MedicationRow[];
  if (medications.length === 0) return [];

  const { data: logRows, error: logsError } = await supabase
    .from('medication_logs')
    .select('medication_id, scheduled_for, taken_at, status, created_at')
    .in(
      'medication_id',
      medications.map((medication) => medication.id)
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (logsError) {
    throw new Error(`No se pudo leer el estado de los medicamentos: ${logsError.message}`);
  }

  const logs = (logRows ?? []) as MedicationLogRow[];
  const now = new Date();

  return medications.map((medication) => {
    const days = normalizeMedicationDays(medication.scheduled_days ?? DEFAULT_MEDICATION_DAYS);
    const occurrences = getMedicationOccurrences(
      medication.scheduled_date,
      medication.scheduled_time.slice(0, 5),
      days,
      now,
      3
    );
    const occurrence = occurrences[0];
    const status = occurrence ? getOccurrenceStatus(logs, medication.id, occurrence.iso) : 'pending';

    return {
      id: String(medication.id),
      name: medication.name,
      dose: medication.dose,
      date: medication.scheduled_date,
      nextDate: occurrence?.date ?? medication.scheduled_date,
      time: medication.scheduled_time.slice(0, 5),
      days,
      status: status === 'taken' ? 'Tomado' : 'Pendiente',
    };
  });
}

function getOccurrenceStatus(logs: MedicationLogRow[], medicationId: number, iso: string) {
  const expectedSchedule = new Date(iso).getTime();
  const matchingLog = logs.find(
    (log) =>
      log.medication_id === medicationId &&
      Math.abs(new Date(log.scheduled_for).getTime() - expectedSchedule) <= 60_000
  );

  return matchingLog?.status ?? 'pending';
}

function parseMedicationId(id: string) {
  const medicationId = Number(id);

  if (!Number.isInteger(medicationId)) {
    throw new Error('Este medicamento todavia no esta sincronizado con Supabase.');
  }

  return medicationId;
}
