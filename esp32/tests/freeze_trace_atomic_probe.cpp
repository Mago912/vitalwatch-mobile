// Inspect with the exact target compiler: no RMW operations are used by trace.
#include <atomic>
#include <stdint.h>
std::atomic<uint32_t> probe{0};
uint32_t readProbe(){return probe.load(std::memory_order_relaxed);}
void writeProbe(uint32_t value){probe.store(value,std::memory_order_relaxed);}
