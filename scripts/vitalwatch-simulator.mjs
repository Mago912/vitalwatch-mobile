import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const deviceId = readPositiveNumber('SIMULATOR_DEVICE_ID', 1);
const intervalMs = readPositiveNumber('SIMULATOR_INTERVAL_MS', 15000);

if (!supabaseUrl) {
  stopWithError('Falta EXPO_PUBLIC_SUPABASE_URL en .env.local.');
}

if (!secretKey) {
  stopWithError('Falta SUPABASE_SECRET_KEY en .env.simulator.local.');
}

if (secretKey.startsWith('sb_publishable_')) {
  stopWithError('El simulador necesita una Secret key, no la Publishable key de la app.');
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

// Cada paso dura dos o mas ciclos cuando hay una alerta para que el celular
// tenga tiempo de consultarla. Despues se registra una recuperacion normal.
const scenarios = [
  normalScenario(85, true),
  normalScenario(84),
  alertScenario({
    label: 'Ritmo cardiaco alto',
    heartRate: [108, 118],
    oxygen: [95, 98],
    impact: [0.1, 0.4],
    battery: 83,
    event: {
      type: 'heart_rate_high',
      severity: 'warning',
      message: 'Ritmo cardiaco alto detectado.',
    },
  }),
  alertScenario({
    label: 'Ritmo cardiaco alto',
    heartRate: [108, 118],
    oxygen: [95, 98],
    impact: [0.1, 0.4],
    battery: 82,
  }),
  normalScenario(81, true),
  normalScenario(80),
  alertScenario({
    label: 'Oxigeno bajo',
    heartRate: [84, 96],
    oxygen: [90, 92],
    impact: [0.1, 0.4],
    battery: 79,
    event: {
      type: 'spo2_low',
      severity: 'warning',
      message: 'Nivel de oxigeno bajo detectado.',
    },
  }),
  alertScenario({
    label: 'Oxigeno bajo',
    heartRate: [84, 96],
    oxygen: [90, 92],
    impact: [0.1, 0.4],
    battery: 78,
  }),
  normalScenario(77, true),
  alertScenario({
    label: 'Posible caida',
    heartRate: [96, 110],
    oxygen: [93, 96],
    impact: [3.2, 4.2],
    battery: 76,
    event: {
      type: 'fall_detected',
      severity: 'critical',
      message: 'Posible caida detectada.',
    },
  }),
  alertScenario({
    label: 'Posible caida',
    heartRate: [96, 110],
    oxygen: [93, 96],
    impact: [3.2, 4.2],
    battery: 75,
  }),
  normalScenario(74, true),
  alertScenario({
    label: 'Bateria baja',
    heartRate: [72, 84],
    oxygen: [96, 99],
    impact: [0.05, 0.3],
    battery: 18,
    performanceMode: true,
    event: {
      type: 'battery_low',
      severity: 'warning',
      message: 'Bateria baja: modo rendimiento activado.',
    },
  }),
  alertScenario({
    label: 'Bateria baja',
    heartRate: [72, 84],
    oxygen: [96, 99],
    impact: [0.05, 0.3],
    battery: 17,
    performanceMode: true,
  }),
  normalScenario(85, true),
];

let scenarioIndex = 0;
let isRunning = true;

process.on('SIGINT', () => {
  isRunning = false;
  console.log('\nSimulador detenido.');
});

await verifyDevice();
console.log(`Simulador VitalWatch iniciado para el dispositivo ${deviceId}.`);
console.log(`Se guardara una lectura cada ${intervalMs / 1000} segundos. Usa Ctrl+C para detenerlo.\n`);

while (isRunning) {
  try {
    await saveScenario(scenarios[scenarioIndex]);
    scenarioIndex = (scenarioIndex + 1) % scenarios.length;
  } catch (error) {
    console.error(`No se pudo guardar la lectura: ${getErrorMessage(error)}`);
  }

  if (isRunning) {
    await wait(intervalMs);
  }
}

async function verifyDevice() {
  const { data, error } = await supabase
    .from('devices')
    .select('id, name')
    .eq('id', deviceId)
    .maybeSingle();

  if (error) {
    stopWithError(`No se pudo consultar devices: ${error.message}`);
  }

  if (!data) {
    stopWithError(`No existe un dispositivo con id ${deviceId}.`);
  }
}

async function saveScenario(scenario) {
  const recordedAt = new Date().toISOString();
  const heartRate = randomInteger(...scenario.heartRate);
  const oxygen = randomInteger(...scenario.oxygen);
  const impact = randomDecimal(...scenario.impact);

  const { error: readingError } = await supabase.from('sensor_readings').insert({
    device_id: deviceId,
    heart_rate: heartRate,
    spo2: oxygen,
    battery_level: scenario.battery,
    impact_value: impact,
    performance_mode: scenario.performanceMode,
    recorded_at: recordedAt,
  });

  if (readingError) {
    throw new Error(`sensor_readings: ${readingError.message}`);
  }

  const { error: deviceError } = await supabase
    .from('devices')
    .update({
      current_battery: scenario.battery,
      performance_mode: scenario.performanceMode,
      last_seen_at: recordedAt,
    })
    .eq('id', deviceId);

  if (deviceError) {
    throw new Error(`devices: ${deviceError.message}`);
  }

  if (scenario.event) {
    const { error: eventError } = await supabase.from('device_events').insert({
      device_id: deviceId,
      type: scenario.event.type,
      severity: scenario.event.severity,
      message: scenario.event.message,
      heart_rate: heartRate,
      spo2: oxygen,
      battery_level: scenario.battery,
      impact_value: impact,
      event_time: recordedAt,
    });

    if (eventError) {
      throw new Error(`device_events: ${eventError.message}`);
    }
  }

  const time = new Date(recordedAt).toLocaleTimeString('es-AR');
  console.log(
    `[${time}] ${scenario.label} | ${heartRate} lpm | SpO2 ${oxygen}% | bateria ${scenario.battery}%`
  );
}

function normalScenario(battery, registerRecovery = false) {
  return {
    label: 'Estado normal',
    heartRate: [70, 84],
    oxygen: [96, 99],
    impact: [0.05, 0.35],
    battery,
    performanceMode: false,
    event: registerRecovery
      ? {
          type: 'normal_status',
          severity: 'info',
          message: 'Valores normales restablecidos.',
        }
      : null,
  };
}

function alertScenario(scenario) {
  return {
    performanceMode: false,
    event: null,
    ...scenario,
  };
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function readPositiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);

  if (!Number.isFinite(value) || value <= 0) {
    stopWithError(`${name} debe ser un numero mayor que cero.`);
  }

  return value;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function stopWithError(message) {
  console.error(`Error del simulador: ${message}`);
  process.exit(1);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
