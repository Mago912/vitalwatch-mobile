#ifndef VITALWATCH_I2C_BUS_SERVICE_H
#define VITALWATCH_I2C_BUS_SERVICE_H

#include <Arduino.h>
#include <Wire.h>

/*
  Un unico propietario inicializa Wire. Los drivers usan este bus ya preparado.
  La recuperacion manual es excepcional; despues de pulsar SCL se reinicializa
  Wire para no dejar el controlador I2C en un estado ambiguo.
*/
namespace I2CBusService {
  struct RegisterReadResult {
    bool success;
    uint8_t transmissionCode;
    size_t bytesReceived;
  };

  struct ScanResult {
    uint8_t devicesFound;
    uint8_t result68;
    uint8_t result69;
    bool sdaHigh;
    bool sclHigh;
  };

  bool begin();
  uint8_t probeAddress(uint8_t address, bool countError = true);
  bool addressResponds(uint8_t address);
  RegisterReadResult readRegister8Detailed(uint8_t address, uint8_t reg, uint8_t &value);
  bool readRegister8(uint8_t address, uint8_t reg, uint8_t &value);
  const char* resultText(uint8_t result);
  ScanResult scanBus();
  bool recover();
  void restoreConfig();
}

#endif
