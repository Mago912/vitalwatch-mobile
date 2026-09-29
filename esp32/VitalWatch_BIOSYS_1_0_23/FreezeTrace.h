#pragma once
#include <stdint.h>
// Only the separate 1.0.23 diagnostic copy contains these hooks.
namespace FreezeTrace {
enum Stage : uint8_t {
  IDLE=0, LOOP=1, REMOTE=2, BUTTONS=3, SERIAL_INPUT=4, IMU=5, PPG=6,
  MEDICATION=7, WIFI=8, TELEMETRY=9, FALL=10, EVENTS=11, TFT=12,
  RESEARCH=13, YIELD=14, FIFO_CHECK=20, FIFO_METADATA=21,
  SAMPLE=22, AUTOGAIN=23, DETECTORS=24, SPO2=25, PUBLICATION=26,
  HRPAIR_WRITE=27, TRACE_WRITE=28, FIFO_RECOVERY=29
};
void boot();
void begin();
void mark(Stage stage);
Stage current();
void report();
class Scope {
  Stage previous;
public:
  explicit Scope(Stage stage):previous(current()){mark(stage);}
  ~Scope(){mark(previous);}
  Scope(const Scope&)=delete;
  Scope& operator=(const Scope&)=delete;
};
}
