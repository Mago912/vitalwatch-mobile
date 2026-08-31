#ifndef VITALWATCH_SENSOR_OXIGENO_H
#define VITALWATCH_SENSOR_OXIGENO_H

#include <Arduino.h>
#include <stdint.h>
#include <math.h>
#include "Configuracion.h"
#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"

// ============================================================================
// MAX30102 - ADQUISICION Y PROCESAMIENTO PPG
//
// La libreria de SparkFun usa la clase MAX30105 para MAX30102/MAX30105. Por eso
// el nombre de la clase no implica que el sensor fisico haya cambiado.
//
// MEJORA PRINCIPAL DE ESTA REVISION:
// la adquisicion PPG ya NO depende de que la pantalla "Signos vitales" este
// abierta. El sensor se atiende siempre en segundo plano. La vista grafica solo
// consume el estado y los resultados ya calculados.
//
// IMPORTANTE BIOMEDICO:
// los umbrales, filtros y fallback de SpO2 son experimentales. Esta revision
// conserva la logica previa para no introducir una modificacion cientifica sin
// validacion del Biomedical Algorithms Lab.
// ============================================================================

namespace PPGConfig {
  static constexpr uint8_t DIRECCION = 0x57;

  // Presencia de dedo/contacto. Valores heredados del baseline del proyecto.
  static constexpr uint32_t UMBRAL_DEDO = 14000UL;
  static constexpr uint32_t UMBRAL_RETIRO_DEDO = 8500UL;
  static constexpr uint32_t UMBRAL_INICIAR_AUTOGANANCIA = 7000UL;

  static constexpr uint8_t POTENCIA_LED_MINIMA = 0x35;
  static constexpr uint8_t POTENCIA_LED_INICIAL = 0x70;
  static constexpr uint8_t POTENCIA_LED_MAXIMA = 0xC0;
  static constexpr uint8_t PASO_LED = 0x10;
  static constexpr uint32_t IR_OBJETIVO_MIN = 38000UL;
  static constexpr uint32_t IR_OBJETIVO_MAX = 90000UL;

  static constexpr uint32_t TIEMPO_CALIBRACION_MS = 3200UL;
  static constexpr uint32_t TIEMPO_MEDICION_GUIADA_MS = 20000UL;
  static constexpr uint32_t INTERVALO_AUTOGANANCIA_MS = 450UL;
  static constexpr uint32_t INTERVALO_RESULTADO_MS = 1000UL;
  static constexpr uint32_t INTERVALO_REFRESCO_VISTA_MS = 500UL;

  static constexpr uint16_t INTERVALO_MINIMO_LATIDO_MS = 330;
  static constexpr uint16_t INTERVALO_MAXIMO_LATIDO_MS = 1600;
  static constexpr uint8_t CANTIDAD_INTERVALOS = 8;

  static constexpr int32_t LONGITUD_SPO2 = 100;
  static constexpr int32_t NUEVAS_MUESTRAS_SPO2 = 25;
  static constexpr uint8_t FACTOR_DECIMACION = 4;
  static constexpr uint8_t CANTIDAD_SPO2 = 5;

  // Limitar el trabajo por pasada impide que un FIFO atrasado monopolice loop()
  // y retrase el muestreo del MPU6050.
  static constexpr uint8_t MAX_MUESTRAS_PPG_POR_CICLO = 8;
}

enum class EstadoMedicionPPG : uint8_t {
  SIN_CONTACTO = 0,
  CALIBRANDO,
  MIDIENDO,
  RESULTADO,
  SENAL_INSUFICIENTE,
  SENSOR_NO_DISPONIBLE
};

enum class CalidadPPG : uint8_t {
  SIN_DATOS = 0,
  BAJA,
  MEDIA,
  BUENA
};

struct ResultadoSignosVitales {
  int bpm;
  int spo2;
  bool bpmValido;
  bool spo2Valido;
  bool aproximado;
  CalidadPPG calidad;
  uint32_t timestampMs;
};

static MAX30105 max30102;
static uint8_t idParteMAX30102 = 0;
static char detalleErrorMAX30102[24] = "NO PROBADO";

static EstadoMedicionPPG estadoMedicionPPG = EstadoMedicionPPG::SIN_CONTACTO;
static ResultadoSignosVitales ultimoResultadoVital = {
  0, 0, false, false, true, CalidadPPG::SIN_DATOS, 0
};

// ============================================================================
// DETECTOR DE PULSO
// ============================================================================
static uint16_t intervalos[PPGConfig::CANTIDAD_INTERVALOS] = {0};
static uint8_t cantidadIntervalos = 0;
static uint8_t posicionIntervalo = 0;
static uint32_t ultimoLatidoAceptado = 0;
static uint32_t ultimoPicoDetectado = 0;
static int bpmInstantaneo = 0;
static uint8_t latidosDetectados = 0;

static float dcIR = 0.0f;
static float acIRFiltrada = 0.0f;
static float acIRAnterior = 0.0f;
static float acIRAnterior2 = 0.0f;
static float vallePPG = 0.0f;
static float envolventePPG = 0.0f;
static float amplitudPulsoEMA = 0.0f;
static float amplitudPPGActual = 0.0f;

// ============================================================================
// BUFFER SpO2
// ============================================================================
static uint32_t bufferIR[PPGConfig::LONGITUD_SPO2];
static uint32_t bufferRojo[PPGConfig::LONGITUD_SPO2];
static int32_t muestrasBuffer = 0;
static int32_t muestrasNuevas = 0;
static uint8_t contadorDecimacion = 0;
static bool bufferCompleto = false;

static int32_t spo2Crudo = 0;
static int8_t spo2ValidoAlgoritmo = 0;
static int32_t bpmAlgoritmo = 0;
static int8_t bpmAlgoritmoValido = 0;

static int historialSpO2[PPGConfig::CANTIDAD_SPO2] = {0};
static uint8_t cantidadSpO2 = 0;
static uint8_t posicionSpO2 = 0;

// ============================================================================
// ESTADO OPTICO
// ============================================================================
static bool dedoPresente = false;
static bool calibrandoOptica = false;
static uint8_t muestrasConDedo = 0;
static uint8_t muestrasSinDedo = 0;

static uint32_t irActual = 0;
static uint32_t rojoActual = 0;
static uint32_t irSuavizado = 0;
static uint8_t potenciaLEDActual = PPGConfig::POTENCIA_LED_INICIAL;

static uint32_t inicioCalibracion = 0;
static uint32_t inicioMedicion = 0;
static uint32_t ultimaAutoganancia = 0;
static uint32_t ultimoCalculoResultado = 0;
static uint32_t ultimoRefrescoVistaPPG = 0;

static bool calidadOpticaBuena = false;
static bool calidadOpticaAceptable = false;
static float perfusionIR = 0.0f;
static float perfusionRoja = 0.0f;
static float ratioRojoIR = 0.0f;

static inline void establecerErrorMAX30102(const char* texto) {
  snprintf(detalleErrorMAX30102, sizeof(detalleErrorMAX30102), "%s", texto);
}

static inline const char* nombreCalidadPPG(CalidadPPG calidad) {
  switch (calidad) {
    case CalidadPPG::BUENA: return "BUENA";
    case CalidadPPG::MEDIA: return "MEDIA";
    case CalidadPPG::BAJA:  return "BAJA";
    default:                 return "--";
  }
}

static inline void limpiarDetectorPulso() {
  cantidadIntervalos = 0;
  posicionIntervalo = 0;
  ultimoLatidoAceptado = 0;
  ultimoPicoDetectado = 0;
  bpmInstantaneo = 0;
  latidosDetectados = 0;

  dcIR = 0.0f;
  acIRFiltrada = 0.0f;
  acIRAnterior = 0.0f;
  acIRAnterior2 = 0.0f;
  vallePPG = 0.0f;
  envolventePPG = 0.0f;
  amplitudPulsoEMA = 0.0f;
  amplitudPPGActual = 0.0f;

  for (uint8_t i = 0; i < PPGConfig::CANTIDAD_INTERVALOS; ++i) {
    intervalos[i] = 0;
  }
}

static inline void limpiarVentanaOptica() {
  limpiarDetectorPulso();

  cantidadSpO2 = 0;
  posicionSpO2 = 0;
  muestrasBuffer = 0;
  muestrasNuevas = 0;
  contadorDecimacion = 0;
  bufferCompleto = false;

  calidadOpticaBuena = false;
  calidadOpticaAceptable = false;
  spo2Crudo = 0;
  spo2ValidoAlgoritmo = 0;
  bpmAlgoritmo = 0;
  bpmAlgoritmoValido = 0;
  perfusionIR = 0.0f;
  perfusionRoja = 0.0f;
  ratioRojoIR = 0.0f;

  for (uint8_t i = 0; i < PPGConfig::CANTIDAD_SPO2; ++i) {
    historialSpO2[i] = 0;
  }
}

// Reinicia la medicion en curso, pero no borra ultimoResultadoVital. De ese
// modo la interfaz puede mostrar el ultimo dato conocido sin confundirlo con
// una lectura instantanea nueva.
static inline void reiniciarMedicionPPG() {
  limpiarVentanaOptica();

  dedoPresente = false;
  calibrandoOptica = false;
  muestrasConDedo = 0;
  muestrasSinDedo = 0;
  irActual = 0;
  rojoActual = 0;
  irSuavizado = 0;
  inicioCalibracion = 0;
  inicioMedicion = 0;
  ultimaAutoganancia = 0;
  ultimoCalculoResultado = 0;
  estadoMedicionPPG = max30102Disponible
    ? EstadoMedicionPPG::SIN_CONTACTO
    : EstadoMedicionPPG::SENSOR_NO_DISPONIBLE;
}

// ============================================================================
// BPM
// ============================================================================
static inline uint16_t medianaIntervalos() {
  if (cantidadIntervalos == 0) return 0;

  uint16_t copia[PPGConfig::CANTIDAD_INTERVALOS];
  for (uint8_t i = 0; i < cantidadIntervalos; ++i) copia[i] = intervalos[i];

  for (uint8_t i = 0; i + 1 < cantidadIntervalos; ++i) {
    for (uint8_t j = i + 1; j < cantidadIntervalos; ++j) {
      if (copia[j] < copia[i]) {
        const uint16_t aux = copia[i];
        copia[i] = copia[j];
        copia[j] = aux;
      }
    }
  }

  return copia[cantidadIntervalos / 2];
}

static inline void aceptarLatido(uint32_t ahora, float amplitud) {
  using namespace PPGConfig;

  if (ultimoLatidoAceptado != 0) {
    const uint32_t intervalo = ahora - ultimoLatidoAceptado;
    if (intervalo < INTERVALO_MINIMO_LATIDO_MS) return;

    if (intervalo <= INTERVALO_MAXIMO_LATIDO_MS) {
      intervalos[posicionIntervalo] = (uint16_t)intervalo;
      posicionIntervalo = (posicionIntervalo + 1) % CANTIDAD_INTERVALOS;
      if (cantidadIntervalos < CANTIDAD_INTERVALOS) ++cantidadIntervalos;

      bpmInstantaneo = (int)(60000.0f / intervalo + 0.5f);
      if (bpmInstantaneo < 35 || bpmInstantaneo > 190) bpmInstantaneo = 0;
    } else {
      cantidadIntervalos = 0;
      posicionIntervalo = 0;
      bpmInstantaneo = 0;
    }
  }

  ultimoLatidoAceptado = ahora;
  ultimoPicoDetectado = ahora;
  if (latidosDetectados < 255) ++latidosDetectados;

  if (amplitudPulsoEMA <= 0.0f) amplitudPulsoEMA = amplitud;
  else amplitudPulsoEMA = amplitudPulsoEMA * 0.80f + amplitud * 0.20f;
}

static inline void procesarDetectorPulso(uint32_t valorIR) {
  using namespace PPGConfig;

  if (dcIR == 0.0f) {
    dcIR = (float)valorIR;
    vallePPG = 0.0f;
    return;
  }

  // Separacion DC/AC muy ligera heredada del prototipo previo.
  dcIR += 0.010f * ((float)valorIR - dcIR);
  const float ac = (float)valorIR - dcIR;
  acIRFiltrada += 0.22f * (ac - acIRFiltrada);

  envolventePPG *= 0.995f;
  const float absoluto = fabsf(acIRFiltrada);
  if (absoluto > envolventePPG) envolventePPG = absoluto;
  if (acIRFiltrada < vallePPG) vallePPG = acIRFiltrada;

  const bool maximoLocal =
    acIRAnterior > acIRAnterior2 && acIRAnterior >= acIRFiltrada;

  if (maximoLocal) {
    const float amplitud = acIRAnterior - vallePPG;
    amplitudPPGActual = amplitud;

    const float umbralAmplitud = amplitudPulsoEMA > 0.0f
      ? max(25.0f, amplitudPulsoEMA * 0.38f)
      : max(25.0f, envolventePPG * 0.22f);

    const uint32_t ahora = millis();
    const bool refractarioCumplido =
      ultimoPicoDetectado == 0 ||
      ahora - ultimoPicoDetectado >= INTERVALO_MINIMO_LATIDO_MS;

    const bool formaValida =
      acIRAnterior > 8.0f &&
      amplitud >= umbralAmplitud &&
      amplitud <= 15000.0f;

    if (refractarioCumplido && formaValida) {
      aceptarLatido(ahora, amplitud);
    }
    vallePPG = acIRFiltrada;
  }

  // Segunda via: detector oficial incluido en la libreria SparkFun.
  if (checkForBeat((int32_t)valorIR)) {
    const uint32_t ahora = millis();
    if (ultimoPicoDetectado == 0 ||
        ahora - ultimoPicoDetectado >= INTERVALO_MINIMO_LATIDO_MS) {
      aceptarLatido(ahora, max(30.0f, amplitudPPGActual));
    }
  }

  acIRAnterior2 = acIRAnterior;
  acIRAnterior = acIRFiltrada;
}

static inline bool obtenerBPMEstable(int &bpmFinal) {
  bpmFinal = 0;
  if (cantidadIntervalos < 4) return false;

  const uint16_t mediana = medianaIntervalos();
  if (mediana == 0) return false;

  uint32_t sumaDiferencias = 0;
  uint16_t minimo = 65535;
  uint16_t maximo = 0;

  for (uint8_t i = 0; i < cantidadIntervalos; ++i) {
    const uint16_t valor = intervalos[i];
    if (valor < minimo) minimo = valor;
    if (valor > maximo) maximo = valor;
    sumaDiferencias += valor > mediana ? valor - mediana : mediana - valor;
  }

  const float variacion =
    100.0f * (sumaDiferencias / (float)cantidadIntervalos) / mediana;
  const int bpm = (int)(60000.0f / mediana + 0.5f);

  const bool consistente = variacion <= 18.0f && (maximo - minimo) <= 260;
  const bool rangoValido = bpm >= 35 && bpm <= 190;
  if (!consistente || !rangoValido) return false;

  bpmFinal = bpm;
  return true;
}

static inline bool obtenerBPMAproximado(int &bpmFinal) {
  bpmFinal = 0;

  if (cantidadIntervalos >= 1) {
    const uint16_t mediana = medianaIntervalos();
    if (mediana > 0) {
      const int bpm = (int)(60000.0f / mediana + 0.5f);
      if (bpm >= 35 && bpm <= 190) {
        bpmFinal = bpm;
        return true;
      }
    }
  }

  if (bpmAlgoritmoValido && bpmAlgoritmo >= 35 && bpmAlgoritmo <= 190) {
    bpmFinal = (int)bpmAlgoritmo;
    return true;
  }

  if (bpmInstantaneo >= 35 && bpmInstantaneo <= 190) {
    bpmFinal = bpmInstantaneo;
    return true;
  }

  return false;
}

// ============================================================================
// SpO2
// ============================================================================
static inline void agregarSpO2(int valor) {
  historialSpO2[posicionSpO2] = valor;
  posicionSpO2 = (posicionSpO2 + 1) % PPGConfig::CANTIDAD_SPO2;
  if (cantidadSpO2 < PPGConfig::CANTIDAD_SPO2) ++cantidadSpO2;
}

static inline int medianaSpO2() {
  if (cantidadSpO2 == 0) return 0;

  int copia[PPGConfig::CANTIDAD_SPO2];
  for (uint8_t i = 0; i < cantidadSpO2; ++i) copia[i] = historialSpO2[i];

  for (uint8_t i = 0; i + 1 < cantidadSpO2; ++i) {
    for (uint8_t j = i + 1; j < cantidadSpO2; ++j) {
      if (copia[j] < copia[i]) {
        const int aux = copia[i];
        copia[i] = copia[j];
        copia[j] = aux;
      }
    }
  }
  return copia[cantidadSpO2 / 2];
}

static inline bool obtenerSpO2Estable(int &resultado) {
  resultado = 0;
  if (cantidadSpO2 < 4) return false;

  int minimo = 101;
  int maximo = 0;
  for (uint8_t i = 0; i < cantidadSpO2; ++i) {
    if (historialSpO2[i] < minimo) minimo = historialSpO2[i];
    if (historialSpO2[i] > maximo) maximo = historialSpO2[i];
  }

  if ((maximo - minimo) > 4) return false;

  resultado = medianaSpO2();
  return resultado >= 85 && resultado <= 100;
}

static inline bool obtenerSpO2Aproximado(int &resultado) {
  resultado = 0;

  if (cantidadSpO2 > 0) {
    resultado = medianaSpO2();
    if (resultado >= 80 && resultado <= 100) return true;
  }

  if (spo2ValidoAlgoritmo && spo2Crudo >= 80 && spo2Crudo <= 100) {
    resultado = (int)spo2Crudo;
    return true;
  }

  // Fallback experimental heredado: relacion AC/DC.
  if (bufferCompleto &&
      cantidadIntervalos >= 1 &&
      perfusionIR >= 0.08f &&
      perfusionRoja >= 0.06f &&
      ratioRojoIR >= 0.35f &&
      ratioRojoIR <= 1.35f) {
    int aproximado = (int)(110.0f - 25.0f * ratioRojoIR + 0.5f);
    aproximado = constrain(aproximado, 80, 100);
    resultado = aproximado;
    return true;
  }

  return false;
}

static inline bool analizarCalidadOptica() {
  if (!bufferCompleto) return false;

  double sumaIR = 0.0;
  double sumaRoja = 0.0;
  uint32_t maximoIR = 0;
  uint32_t maximoRojo = 0;

  for (int32_t i = 0; i < PPGConfig::LONGITUD_SPO2; ++i) {
    const uint32_t ir = bufferIR[i];
    const uint32_t rojo = bufferRojo[i];
    sumaIR += ir;
    sumaRoja += rojo;
    if (ir > maximoIR) maximoIR = ir;
    if (rojo > maximoRojo) maximoRojo = rojo;
  }

  const float promedioIR = sumaIR / PPGConfig::LONGITUD_SPO2;
  const float promedioRojo = sumaRoja / PPGConfig::LONGITUD_SPO2;
  if (promedioIR <= 0.0f || promedioRojo <= 0.0f) return false;

  double sumaCuadradosIR = 0.0;
  double sumaCuadradosRojo = 0.0;

  for (int32_t i = 0; i < PPGConfig::LONGITUD_SPO2; ++i) {
    const float dIR = (float)bufferIR[i] - promedioIR;
    const float dRojo = (float)bufferRojo[i] - promedioRojo;
    sumaCuadradosIR += (double)dIR * dIR;
    sumaCuadradosRojo += (double)dRojo * dRojo;
  }

  const float rmsIR = sqrtf((float)(sumaCuadradosIR / PPGConfig::LONGITUD_SPO2));
  const float rmsRojo = sqrtf((float)(sumaCuadradosRojo / PPGConfig::LONGITUD_SPO2));

  perfusionIR = 100.0f * rmsIR / promedioIR;
  perfusionRoja = 100.0f * rmsRojo / promedioRojo;

  ratioRojoIR = (rmsIR > 0.0f && promedioRojo > 0.0f)
    ? (rmsRojo / promedioRojo) / (rmsIR / promedioIR)
    : 0.0f;

  const bool sinSaturacion = maximoIR < 250000UL && maximoRojo < 250000UL;
  const bool dcSuficiente =
    promedioIR >= PPGConfig::UMBRAL_DEDO && promedioRojo >= 5000.0f;

  calidadOpticaAceptable =
    dcSuficiente &&
    sinSaturacion &&
    perfusionIR >= 0.06f && perfusionIR <= 12.0f &&
    perfusionRoja >= 0.04f && perfusionRoja <= 12.0f;

  const bool buena =
    calidadOpticaAceptable &&
    perfusionIR >= 0.15f &&
    perfusionRoja >= 0.10f &&
    cantidadIntervalos >= 3;

  return buena;
}

static inline void calcularSpO2() {
  calidadOpticaBuena = analizarCalidadOptica();

  maxim_heart_rate_and_oxygen_saturation(
    bufferIR,
    PPGConfig::LONGITUD_SPO2,
    bufferRojo,
    &spo2Crudo,
    &spo2ValidoAlgoritmo,
    &bpmAlgoritmo,
    &bpmAlgoritmoValido
  );

  if (spo2Crudo >= 80 && spo2Crudo <= 100 &&
      (spo2ValidoAlgoritmo || calidadOpticaAceptable)) {
    agregarSpO2((int)spo2Crudo);
  }
}

static inline void guardarMuestraSpO2(uint32_t rojo, uint32_t ir) {
  ++contadorDecimacion;
  if (contadorDecimacion < PPGConfig::FACTOR_DECIMACION) return;
  contadorDecimacion = 0;

  if (!bufferCompleto) {
    bufferIR[muestrasBuffer] = ir;
    bufferRojo[muestrasBuffer] = rojo;
    ++muestrasBuffer;

    if (muestrasBuffer >= PPGConfig::LONGITUD_SPO2) {
      bufferCompleto = true;
      muestrasNuevas = 0;
      calcularSpO2();
    }
    return;
  }

  if (muestrasNuevas == 0) {
    for (int32_t i = PPGConfig::NUEVAS_MUESTRAS_SPO2;
         i < PPGConfig::LONGITUD_SPO2;
         ++i) {
      bufferIR[i - PPGConfig::NUEVAS_MUESTRAS_SPO2] = bufferIR[i];
      bufferRojo[i - PPGConfig::NUEVAS_MUESTRAS_SPO2] = bufferRojo[i];
    }
  }

  const int32_t posicion =
    PPGConfig::LONGITUD_SPO2 - PPGConfig::NUEVAS_MUESTRAS_SPO2 + muestrasNuevas;
  bufferIR[posicion] = ir;
  bufferRojo[posicion] = rojo;
  ++muestrasNuevas;

  if (muestrasNuevas >= PPGConfig::NUEVAS_MUESTRAS_SPO2) {
    muestrasNuevas = 0;
    calcularSpO2();
  }
}

// ============================================================================
// CONTACTO / AUTOGANANCIA
// ============================================================================
static inline void aplicarPotenciaLED(uint8_t potencia) {
  potenciaLEDActual = potencia;
  max30102.setPulseAmplitudeRed(potenciaLEDActual);
  max30102.setPulseAmplitudeIR(potenciaLEDActual);
}

static inline bool ajustarGananciaOptica() {
  if (irSuavizado < PPGConfig::UMBRAL_INICIAR_AUTOGANANCIA) return false;

  uint8_t nuevaPotencia = potenciaLEDActual;

  if (irSuavizado < PPGConfig::IR_OBJETIVO_MIN &&
      potenciaLEDActual < PPGConfig::POTENCIA_LED_MAXIMA) {
    nuevaPotencia = (uint8_t)min(
      (int)PPGConfig::POTENCIA_LED_MAXIMA,
      (int)potenciaLEDActual + PPGConfig::PASO_LED
    );
  } else if (irSuavizado > PPGConfig::IR_OBJETIVO_MAX &&
             potenciaLEDActual > PPGConfig::POTENCIA_LED_MINIMA) {
    nuevaPotencia = (uint8_t)max(
      (int)PPGConfig::POTENCIA_LED_MINIMA,
      (int)potenciaLEDActual - PPGConfig::PASO_LED
    );
  }

  if (nuevaPotencia == potenciaLEDActual) return false;

  aplicarPotenciaLED(nuevaPotencia);
  return true;
}

static inline void comenzarCalibracionOptica() {
  calibrandoOptica = true;
  estadoMedicionPPG = EstadoMedicionPPG::CALIBRANDO;
  inicioCalibracion = millis();
  ultimaAutoganancia = 0;
  limpiarVentanaOptica();

  Serial.println(F("[INFO][PPG] Contacto detectado; calibracion optica"));
}

static inline void finalizarCalibracionOptica() {
  calibrandoOptica = false;
  limpiarVentanaOptica();
  inicioMedicion = millis();
  ultimoCalculoResultado = 0;
  estadoMedicionPPG = EstadoMedicionPPG::MIDIENDO;

  Serial.println(F("[INFO][PPG] Calibracion finalizada; medicion activa"));
}

static inline void actualizarEstadoDedo() {
  if (!dedoPresente) {
    if (irSuavizado > PPGConfig::UMBRAL_DEDO) {
      if (muestrasConDedo < 30) ++muestrasConDedo;
    } else {
      muestrasConDedo = 0;
    }

    if (muestrasConDedo >= 12) {
      dedoPresente = true;
      muestrasConDedo = 0;
      muestrasSinDedo = 0;
      comenzarCalibracionOptica();
    }
    return;
  }

  if (irSuavizado < PPGConfig::UMBRAL_RETIRO_DEDO) {
    if (muestrasSinDedo < 30) ++muestrasSinDedo;
  } else {
    muestrasSinDedo = 0;
  }

  if (muestrasSinDedo >= 12) {
    dedoPresente = false;
    calibrandoOptica = false;
    muestrasConDedo = 0;
    muestrasSinDedo = 0;
    limpiarVentanaOptica();
    inicioMedicion = 0;
    estadoMedicionPPG = EstadoMedicionPPG::SIN_CONTACTO;

    Serial.println(F("[INFO][PPG] Contacto retirado; ventana actual cancelada"));
  }
}

// ============================================================================
// RESULTADO PUBLICO
// ============================================================================
static inline void actualizarResultadoSignosVitales() {
  int bpmFinal = 0;
  int spo2Final = 0;

  const bool bpmConfiable = obtenerBPMEstable(bpmFinal);
  const bool spo2Confiable = calidadOpticaBuena && obtenerSpO2Estable(spo2Final);

  const bool bpmDisponible = bpmConfiable || obtenerBPMAproximado(bpmFinal);
  const bool spo2Disponible = spo2Confiable || obtenerSpO2Aproximado(spo2Final);

  ultimoResultadoVital.bpm = bpmDisponible ? bpmFinal : 0;
  ultimoResultadoVital.spo2 = spo2Disponible ? spo2Final : 0;
  ultimoResultadoVital.bpmValido = bpmDisponible;
  ultimoResultadoVital.spo2Valido = spo2Disponible;
  ultimoResultadoVital.aproximado = !(bpmConfiable && spo2Confiable);
  ultimoResultadoVital.timestampMs = millis();

  if (bpmConfiable && spo2Confiable) {
    ultimoResultadoVital.calidad = CalidadPPG::BUENA;
    estadoMedicionPPG = EstadoMedicionPPG::RESULTADO;
  } else if ((bpmDisponible || spo2Disponible) && calidadOpticaAceptable) {
    ultimoResultadoVital.calidad = CalidadPPG::MEDIA;
    estadoMedicionPPG = EstadoMedicionPPG::RESULTADO;
  } else {
    ultimoResultadoVital.calidad = CalidadPPG::BAJA;
    estadoMedicionPPG = EstadoMedicionPPG::SENAL_INSUFICIENTE;
  }
}

// ============================================================================
// INICIALIZACION
// ============================================================================
static inline void inicializarMAX30102() {
  max30102Disponible = false;
  idParteMAX30102 = 0;
  establecerErrorMAX30102("SIN ACK 0x57");
  estadoMedicionPPG = EstadoMedicionPPG::SENSOR_NO_DISPONIBLE;

  Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);

  if (!direccionI2CResponde(PPGConfig::DIRECCION)) {
    Serial.println(F("[WARN][PPG] MAX30102 sin ACK en 0x57"));
    pantallaSucia = true;
    return;
  }

  for (uint8_t intento = 1; intento <= 3; ++intento) {
    if (max30102.begin(Wire, I2C_SPEED_STANDARD)) {
      idParteMAX30102 = max30102.readPartID();
      max30102Disponible = true;
      establecerErrorMAX30102("OK");
      break;
    }

    establecerErrorMAX30102("ID/BEGIN FALLO");
    Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);
    delay(100); // solo durante inicializacion/reconexion
  }

  if (!max30102Disponible) {
    Serial.print(F("[ERROR][PPG] MAX30102 no inicializado: "));
    Serial.println(detalleErrorMAX30102);
    pantallaSucia = true;
    return;
  }

  potenciaLEDActual = PPGConfig::POTENCIA_LED_INICIAL;

  // SparkFun: brillo, promedio FIFO, modo LED, sample rate, pulse width, ADC.
  // Baseline: 400 Hz, AVG4, Red+IR, 411 us, rango 4096.
  max30102.setup(potenciaLEDActual, 4, 2, 400, 411, 4096);
  aplicarPotenciaLED(potenciaLEDActual);
  max30102.setPulseAmplitudeGreen(0);
  max30102.clearFIFO();

  Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);
  reiniciarMedicionPPG();
  pantallaSucia = true;

  Serial.print(F("[INFO][PPG] MAX30102 PART_ID=0x"));
  Serial.println(idParteMAX30102, HEX);
}

// ============================================================================
// PROCESAMIENTO CONTINUO
// ============================================================================
static inline void procesarOxigeno() {
  if (!max30102Disponible) return;

  max30102.check();

  // Se procesa un numero acotado de muestras por pasada para preservar la
  // capacidad de respuesta del resto del sistema, especialmente del MPU.
  uint8_t procesadas = 0;
  while (max30102.available() &&
         procesadas < PPGConfig::MAX_MUESTRAS_PPG_POR_CICLO) {

    const uint32_t rojo = max30102.getRed();
    const uint32_t ir = max30102.getIR();
    max30102.nextSample();
    ++procesadas;

    irActual = ir;
    rojoActual = rojo;

    if (irSuavizado == 0) irSuavizado = ir;
    else irSuavizado = (uint32_t)(((uint64_t)irSuavizado * 7ULL + ir) / 8ULL);

    actualizarEstadoDedo();
    if (!dedoPresente) continue;

    if (calibrandoOptica) {
      const uint32_t ahora = millis();
      if (ahora - ultimaAutoganancia >= PPGConfig::INTERVALO_AUTOGANANCIA_MS) {
        ultimaAutoganancia = ahora;
        ajustarGananciaOptica();
      }

      if (ahora - inicioCalibracion >= PPGConfig::TIEMPO_CALIBRACION_MS) {
        finalizarCalibracionOptica();
      }
      continue;
    }

    procesarDetectorPulso(ir);
    guardarMuestraSpO2(rojo, ir);
  }

  // Una vez estabilizada la ventana, el resultado se actualiza periodicamente
  // aunque el usuario este mirando el menu u otra pantalla.
  if (dedoPresente && !calibrandoOptica && inicioMedicion != 0) {
    const uint32_t ahora = millis();

    if (ahora - inicioMedicion >= PPGConfig::TIEMPO_MEDICION_GUIADA_MS &&
        (ultimoCalculoResultado == 0 ||
         ahora - ultimoCalculoResultado >= PPGConfig::INTERVALO_RESULTADO_MS)) {
      ultimoCalculoResultado = ahora;
      actualizarResultadoSignosVitales();
    } else if (estadoMedicionPPG != EstadoMedicionPPG::RESULTADO &&
               estadoMedicionPPG != EstadoMedicionPPG::SENAL_INSUFICIENTE) {
      estadoMedicionPPG = EstadoMedicionPPG::MIDIENDO;
    }
  }

  // Solo la vista activa solicita redibujado; el procesamiento no depende de UI.
  if (modoActual == ModoSistema::SIGNOS_VITALES) {
    const uint32_t ahora = millis();
    if (ahora - ultimoRefrescoVistaPPG >= PPGConfig::INTERVALO_REFRESCO_VISTA_MS) {
      ultimoRefrescoVistaPPG = ahora;
      pantallaSucia = true;
    }
  }
}

#endif
