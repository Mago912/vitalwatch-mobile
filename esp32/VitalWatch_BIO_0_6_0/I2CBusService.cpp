#include "I2CBusService.h"
#include "Configuracion.h"
#include "SystemState.h"

namespace I2CBusService {

void restoreConfig() {
  Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);
  Wire.setTimeOut(VitalWatchConfig::TIMEOUT_I2C_MS);
}

void begin() {
  Wire.begin(VitalWatchConfig::PIN_I2C_SDA, VitalWatchConfig::PIN_I2C_SCL);
  restoreConfig();
  Serial.printf("[INFO][I2C] SDA=%u SCL=%u clock=%luHz timeout=%ums\n",
                VitalWatchConfig::PIN_I2C_SDA,
                VitalWatchConfig::PIN_I2C_SCL,
                (unsigned long)VitalWatchConfig::FRECUENCIA_I2C_HZ,
                VitalWatchConfig::TIMEOUT_I2C_MS);
}

bool addressResponds(uint8_t address) {
  Wire.beginTransmission(address);
  const uint8_t result = Wire.endTransmission(true);
  if (result != 0) ++systemHealth.i2cErrors;
  return result == 0;
}

bool readRegister8(uint8_t address, uint8_t reg, uint8_t &value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    ++systemHealth.i2cErrors;
    return false;
  }
  if (Wire.requestFrom(address, (size_t)1, true) != 1) {
    ++systemHealth.i2cErrors;
    return false;
  }
  value = Wire.read();
  return true;
}

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
