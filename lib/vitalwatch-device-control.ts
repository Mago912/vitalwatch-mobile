import { DeviceDisplayControl, DeviceDisplayView } from '@/constants/vitalwatch';
import { supabase } from '@/lib/supabase';

const displayControlSelect =
  'desired_display_on, desired_display_view, reported_display_on, reported_display_view, display_command_at, display_reported_at';

export async function setRemoteDisplayEnabled(
  deviceId: number,
  displayOn: boolean
): Promise<DeviceDisplayControl> {
  const commandAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('devices')
    .update({
      desired_display_on: displayOn,
      display_command_at: commandAt,
    })
    .eq('id', deviceId)
    .select(displayControlSelect)
    .single();

  if (error) {
    throw new Error(`No se pudo controlar la pantalla: ${error.message}`);
  }

  return {
    commandAt: data.display_command_at ?? commandAt,
    desiredOn: data.desired_display_on ?? displayOn,
    desiredView: data.desired_display_view ?? 'menu',
    reportedAt: data.display_reported_at ?? null,
    reportedOn: data.reported_display_on ?? null,
    reportedView: data.reported_display_view ?? null,
  };
}

export async function setRemoteDisplayView(
  deviceId: number,
  displayView: DeviceDisplayView
): Promise<DeviceDisplayControl> {
  const commandAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('devices')
    .update({
      desired_display_on: true,
      desired_display_view: displayView,
      display_command_at: commandAt,
    })
    .eq('id', deviceId)
    .select(displayControlSelect)
    .single();

  if (error) {
    throw new Error(`No se pudo cambiar el menu: ${error.message}`);
  }

  return {
    commandAt: data.display_command_at ?? commandAt,
    desiredOn: data.desired_display_on ?? true,
    desiredView: data.desired_display_view ?? displayView,
    reportedAt: data.display_reported_at ?? null,
    reportedOn: data.reported_display_on ?? null,
    reportedView: data.reported_display_view ?? null,
  };
}

export async function waitForRemoteDisplayConfirmation(
  deviceId: number,
  expectedOn: boolean,
  expectedView: DeviceDisplayView
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await delay(750);
    const { data, error } = await supabase
      .from('devices')
      .select(displayControlSelect)
      .eq('id', deviceId)
      .single();

    if (error) {
      throw new Error(`No se pudo confirmar la pantalla: ${error.message}`);
    }

    const control: DeviceDisplayControl = {
      commandAt: data.display_command_at ?? null,
      desiredOn: data.desired_display_on ?? expectedOn,
      desiredView: data.desired_display_view ?? expectedView,
      reportedAt: data.display_reported_at ?? null,
      reportedOn: data.reported_display_on ?? null,
      reportedView: data.reported_display_view ?? null,
    };
    const reportIsNew =
      control.commandAt !== null &&
      control.reportedAt !== null &&
      new Date(control.reportedAt).getTime() >= new Date(control.commandAt).getTime();
    const stateMatches =
      control.reportedOn === expectedOn &&
      (!expectedOn || control.reportedView === expectedView);

    if (reportIsNew && stateMatches) return control;
  }

  return null;
}

export async function sendRemoteOk(deviceId: number) {
  const commandAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('devices')
    .update({
      desired_input_action: 'ok',
      input_command_at: commandAt,
    })
    .eq('id', deviceId)
    .select('input_command_at')
    .single();

  if (error) {
    throw new Error(`No se pudo enviar OK a la pulsera: ${error.message}`);
  }

  return data.input_command_at ?? commandAt;
}

export async function waitForRemoteAlertDismissal(deviceId: number, commandAt: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(750);
    const { data, error } = await supabase
      .from('devices')
      .select('reported_alert_state, alert_reported_at, input_reported_at')
      .eq('id', deviceId)
      .single();

    if (error) {
      throw new Error(`No se pudo confirmar el cierre de la alerta: ${error.message}`);
    }

    const inputWasHandled =
      data.input_reported_at !== null &&
      new Date(data.input_reported_at).getTime() >= new Date(commandAt).getTime();
    const alertWasCleared =
      data.reported_alert_state === 'none' &&
      data.alert_reported_at !== null &&
      new Date(data.alert_reported_at).getTime() >= new Date(commandAt).getTime();

    if (inputWasHandled && alertWasCleared) return true;
  }

  return false;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
