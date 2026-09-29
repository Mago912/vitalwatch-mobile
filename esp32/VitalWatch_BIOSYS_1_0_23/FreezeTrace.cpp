#include "FreezeTrace.h"
#include "FreezeTraceModel.h"
#include "Configuracion.h"
#include <esp_attr.h>
#include <esp_system.h>
#include <atomic>

namespace FreezeTrace {
namespace {
// Single producer: the existing loop task. No sensor/network work on observer.
std::atomic<uint32_t> marker{0}, observerPolls{0}, firstStall{0};
// Xtensa reports ATOMIC_INT_LOCK_FREE=1 (all atomic operations are not promised).
// Only relaxed aligned load/store are used: target assembly verified l32i/s32i
// plus memw, with no helper calls/locks. See tests/freeze_trace_atomic_probe.cpp.
static_assert(sizeof(std::atomic<uint32_t>)==4 && alignof(std::atomic<uint32_t>)>=4,
              "Trace requires aligned single-word atomics");
uint32_t sequence=0;
RTC_NOINIT_ATTR volatile FreezeTraceModel::Record retained;
FreezeTraceModel::Record previous{};
bool previousValid=false, observerStarted=false, reporterStarted=false;
uint32_t resetReason=0;

void persist(const FreezeTraceModel::Record& r) {
  // A reset during this bounded write yields an invalid checksum/magic.
  // Only this task writes RTC. boot() reads it before this task is created.
  retained.magic=0;
  retained.schema=r.schema;retained.word=r.word;retained.observedMs=r.observedMs;
  retained.polls=r.polls;retained.firstWord=r.firstWord;
  retained.firstAtMs=r.firstAtMs;retained.firstAgeMs=r.firstAgeMs;
  retained.checksum=r.checksum;
  std::atomic_thread_fence(std::memory_order_release);
  retained.magic=r.magic;
}

void observe(void*) {
  FreezeTraceModel::Tracker tracker;
  for(;;) {
    const uint32_t now=millis();
    tracker.poll(marker.load(std::memory_order_relaxed),now);
    persist(tracker.record(now));
    firstStall.store(tracker.firstWord,std::memory_order_relaxed);
    observerPolls.store(tracker.polls,std::memory_order_relaxed);
    // Never touch Serial, Wire, SPI, TFT, flash or a mutex here.
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

void reportFirstStall(void*) {
  uint32_t word=0;
  while((word=firstStall.load(std::memory_order_relaxed))==0)
    vTaskDelay(pdMS_TO_TICKS(100));
  // Separate expendable task: if Serial blocks, the observer keeps recording.
  // Do not call report()/mark()/Scope: the marker has ONLY the loop producer.
  Serial.printf("FREEZE,1,STALL,%lu,%lu\n",(unsigned long)word,
    (unsigned long)observerPolls.load(std::memory_order_relaxed));
  vTaskDelete(nullptr);
}
}

Stage current(){return static_cast<Stage>(marker.load(std::memory_order_relaxed)&0xFFu);}
void mark(Stage stage) {
#if !BIO_REPLAY_MODE && !BIO_RESEARCH_MODE
  sequence=(sequence+1)&0x00FFFFFFu;
  marker.store((sequence<<8)|static_cast<uint8_t>(stage),std::memory_order_relaxed);
#else
  (void)stage;
#endif
}
void boot() {
#if !BIO_REPLAY_MODE && !BIO_RESEARCH_MODE
  previous={retained.magic,retained.schema,retained.word,retained.observedMs,
    retained.polls,retained.firstWord,retained.firstAtMs,retained.firstAgeMs,retained.checksum};
  previousValid=FreezeTraceModel::valid(previous);
  resetReason=static_cast<uint32_t>(esp_reset_reason());
  // Cold power-on/brownout evidence must not be treated as a prior warm run.
  if(resetReason==ESP_RST_POWERON || resetReason==ESP_RST_BROWNOUT)previousValid=false;
  if(!previousValid)previous={};
  retained.magic=0;
#endif
}
void begin() {
#if !BIO_REPLAY_MODE && !BIO_RESEARCH_MODE
  if(observerStarted)return;
  mark(LOOP);
  // Opposite core from the classic ESP32 Arduino loop (verified at runtime).
  const BaseType_t core=xPortGetCoreID()==0?1:0;
  observerStarted=xTaskCreatePinnedToCore(observe,"vwFreeze",3072,nullptr,1,nullptr,core)==pdPASS;
  if(observerStarted)
    reporterStarted=xTaskCreatePinnedToCore(reportFirstStall,"vwFreezeOut",3072,nullptr,1,nullptr,core)==pdPASS;
  Serial.printf("[DIAG][FREEZE] BIOSYS 1.0.23 DIAG; observer=%u reporter=%u core=%d; J=trace; no auto-reset\n",
    (unsigned)observerStarted,(unsigned)reporterStarted,(int)core);
#endif
}
void report() {
  Scope output(TRACE_WRITE);
  // Different fields are advisory snapshots, not an atomic physiological record.
  Serial.printf("FREEZE,1,LIVE,%lu,%lu,%lu,%u,%u,%lu\n",
    (unsigned long)marker.load(std::memory_order_relaxed),
    (unsigned long)observerPolls.load(std::memory_order_relaxed),
    (unsigned long)firstStall.load(std::memory_order_relaxed),
    (unsigned)observerStarted,(unsigned)reporterStarted,(unsigned long)resetReason);
  // Cached before observer starts: repeatedly readable without clearing evidence.
  Serial.printf("FREEZE,1,PREV,%u,%lu,%lu,%lu,%lu,%lu,%lu\n",
    (unsigned)previousValid,(unsigned long)previous.word,(unsigned long)previous.observedMs,
    (unsigned long)previous.polls,(unsigned long)previous.firstWord,
    (unsigned long)previous.firstAtMs,(unsigned long)previous.firstAgeMs);
}
}
