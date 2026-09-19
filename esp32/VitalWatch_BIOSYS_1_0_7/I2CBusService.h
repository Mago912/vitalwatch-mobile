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
  void begin();
  bool addressResponds(uint8_t address);
  bool readRegister8(uint8_t address, uint8_t reg, uint8_t &value);
  bool recover();
  void restoreConfig();
}

#endif
