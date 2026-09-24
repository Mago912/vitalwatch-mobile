#include "I2CBusService.h"
#include "Configuracion.h"
#include "SystemState.h"

namespace I2CBusService {

// [BIOSYS-F1] Contrato eléctrico compartido: frecuencia y timeout del bus.
void restoreConfig() {
  Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);
  Wire.setTimeOut(VitalWatchConfig::TIMEOUT_I2C_MS);
}

bool begin() {
  const bool initialized = Wire.begin(
    VitalWatchConfig::PIN_I2C_SDA,
    VitalWatchConfig::PIN_I2C_SCL
  );
  restoreConfig();
  Serial.printf("[INFO][I2C] init=%s SDA=%u SCL=%u clock=%luHz timeout=%ums\n",
                initialized ? "OK" : "FALLO",
                VitalWatchConfig::PIN_I2C_SDA,
                VitalWatchConfig::PIN_I2C_SCL,
                (unsigned long)VitalWatchConfig::FRECUENCIA_I2C_HZ,
                VitalWatchConfig::TIMEOUT_I2C_MS);
  return initialized;
}

// [BIOSYS-F2] Lecturas pequeñas con conteo centralizado de errores.
uint8_t probeAddress(uint8_t address, bool countError) {
  Wire.beginTransmission(address);
  const uint8_t result = Wire.endTransmission(true);
  if (countError && result != 0) ++systemHealth.i2cErrors;
  return result;
}

bool addressResponds(uint8_t address) {
  return probeAddress(address) == 0;
}

RegisterReadResult readRegister8Detailed(uint8_t address, uint8_t reg, uint8_t &value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  const uint8_t transmissionCode = Wire.endTransmission(false);
  if (transmissionCode != 0) {
    ++systemHealth.i2cErrors;
    return {false, transmissionCode, 0};
  }

  const size_t bytesReceived = Wire.requestFrom(address, (size_t)1, true);
  if (bytesReceived != 1) {
    while (Wire.available()) Wire.read();
    ++systemHealth.i2cErrors;
    return {false, 0, bytesReceived};
  }

  value = Wire.read();
  return {true, 0, bytesReceived};
}

bool readRegister8(uint8_t address, uint8_t reg, uint8_t &value) {
  return readRegister8Detailed(address, reg, value).success;
}

const char* resultText(uint8_t result) {
  switch (result) {
    case 0: return "ACK/OK";
    case 1: return "BUFFER_LARGO";
    case 2: return "NACK_DIRECCION";
    case 3: return "NACK_DATOS";
    case 4: return "OTRO_ERROR";
    case 5: return "TIMEOUT";
    default: return "DESCONOCIDO";
  }
}

// [BIOSYS-F2B] Escaneo solo diagnostico. No suma NACK esperables al contador
// de errores porque un escaner consulta deliberadamente direcciones vacias.
ScanResult scanBus() {
  ScanResult scan = {0, 0xFF, 0xFF, false, false};

  Serial.printf(
    "[DIAG][I2C] SCAN INICIO SDA=%u SCL=%u clock=%luHz timeout=%ums\n",
    VitalWatchConfig::PIN_I2C_SDA,
    VitalWatchConfig::PIN_I2C_SCL,
    (unsigned long)VitalWatchConfig::FRECUENCIA_I2C_HZ,
    VitalWatchConfig::TIMEOUT_I2C_MS
  );

  for (uint8_t address = 0x01; address <= 0x7E; ++address) {
    const uint8_t result = probeAddress(address, false);
    if (address == 0x68) scan.result68 = result;
    if (address == 0x69) scan.result69 = result;

    if (result == 0) {
      ++scan.devicesFound;
      const char* role = address == 0x57
        ? "MAX30102"
        : (address == 0x68 || address == 0x69 ? "IMU_CANDIDATA" : "OTRO");
      Serial.printf("[DIAG][I2C] ACK addr=0x%02X role=%s\n", address, role);
    }
  }

  scan.sdaHigh = digitalRead(VitalWatchConfig::PIN_I2C_SDA) == HIGH;
  scan.sclHigh = digitalRead(VitalWatchConfig::PIN_I2C_SCL) == HIGH;
  Serial.printf(
    "[DIAG][I2C] SCAN FIN devices=%u 0x68=%u(%s) 0x69=%u(%s) SDA=%s SCL=%s\n",
    scan.devicesFound,
    scan.result68,
    resultText(scan.result68),
    scan.result69,
    resultText(scan.result69),
    scan.sdaHigh ? "HIGH" : "LOW",
    scan.sclHigh ? "HIGH" : "LOW"
  );

  return scan;
}

// [BIOSYS-F3] Recuperación por nueve pulsos de reloj y reconstrucción de Wire.
bool recover() {
  Serial.println(F("[WARN][I2C] Intento de recuperacion manual del bus"));

  // Liberar el periférico Wire antes de manipular los pines manualmente.
  Wire.end();

  pinMode(VitalWatchConfig::PIN_I2C_SDA, INPUT_PULLUP);
  pinMode(VitalWatchConfig::PIN_I2C_SCL, OUTPUT_OPEN_DRAIN);
  digitalWrite(VitalWatchConfig::PIN_I2C_SCL, HIGH);
  delayMicroseconds(5);

  if (digitalRead(VitalWatchConfig::PIN_I2C_SDA) == LOW) {
    for (uint8_t i = 0; i < 9; ++i) {
      digitalWrite(VitalWatchConfig::PIN_I2C_SCL, LOW);
      delayMicroseconds(5);
      digitalWrite(VitalWatchConfig::PIN_I2C_SCL, HIGH);
      delayMicroseconds(5);
    }

    // STOP manual: SDA LOW -> SCL HIGH -> SDA HIGH.
    pinMode(VitalWatchConfig::PIN_I2C_SDA, OUTPUT_OPEN_DRAIN);
    digitalWrite(VitalWatchConfig::PIN_I2C_SDA, LOW);
    delayMicroseconds(5);
    digitalWrite(VitalWatchConfig::PIN_I2C_SCL, HIGH);
    delayMicroseconds(5);
    digitalWrite(VitalWatchConfig::PIN_I2C_SDA, HIGH);
    delayMicroseconds(5);
  }

  // Reestablecer SIEMPRE Wire; este era un pendiente explícito de la auditoría.
  Wire.begin(VitalWatchConfig::PIN_I2C_SDA, VitalWatchConfig::PIN_I2C_SCL);
  restoreConfig();

  const bool released = digitalRead(VitalWatchConfig::PIN_I2C_SDA) == HIGH;
  Serial.println(released ? F("[INFO][I2C] Bus liberado") : F("[ERROR][I2C] SDA continua LOW"));
  return released;
}

}
