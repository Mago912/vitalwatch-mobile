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

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
