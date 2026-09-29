#pragma once
#include <stdint.h>
namespace FreezeTraceModel {
struct Record {
  uint32_t magic, schema, word, observedMs, polls, firstWord, firstAtMs, firstAgeMs, checksum;
};
inline uint32_t checksum(const Record& r) {
  const uint32_t values[]={r.magic,r.schema,r.word,r.observedMs,r.polls,
                           r.firstWord,r.firstAtMs,r.firstAgeMs};
  uint32_t hash=2166136261u;
  for(uint32_t value:values) { hash^=value;hash*=16777619u; }
  return hash;
}
inline bool valid(const Record& r) {
  return r.magic==0x46545A31u && r.schema==1 && r.checksum==checksum(r);
}
struct Tracker {
  uint32_t word=0, changedMs=0, polls=0, firstWord=0, firstAtMs=0, firstAgeMs=0;
  bool started=false;
  bool poll(uint32_t next, uint32_t now) {
    ++polls;
    if(!started || next!=word) { started=true;word=next;changedMs=now;return false; }
    const uint32_t age=now-changedMs;
    if(firstWord==0 && next!=0 && age>=2000) {
      firstWord=next;firstAtMs=now;firstAgeMs=age;return true;
    }
    return false;
  }
  Record record(uint32_t now) const {
    Record r={0x46545A31u,1,word,now,polls,firstWord,firstAtMs,firstAgeMs,0};
    r.checksum=checksum(r);return r;
  }
};
}
