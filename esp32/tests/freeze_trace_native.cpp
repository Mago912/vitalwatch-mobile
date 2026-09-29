// CODEX REPRODUCTION TESTS: diagnostic model only, not the physical freeze.
#include <stdio.h>
#include <stdint.h>
#include "FreezeTraceModel.h"
#define SERIAL 0x0 // Arduino.h compatibility regression.
#include "FreezeTrace.h"
namespace FreezeTrace {
static Stage testStage=IDLE;
void mark(Stage stage){testStage=stage;}
Stage current(){return testStage;}
}
using namespace FreezeTraceModel;
int failures=0, cases=0;
void check(bool ok,const char* name){++cases;printf("%s %s\n",ok?"PASS":"FAIL",name);if(!ok)++failures;}
int main(){
  FreezeTrace::mark(FreezeTrace::PPG);
  {
    FreezeTrace::Scope outer(FreezeTrace::SAMPLE);
    {FreezeTrace::Scope inner(FreezeTrace::AUTOGAIN);}
    check(FreezeTrace::current()==FreezeTrace::SAMPLE,"nested scope restores sample stage");
  }
  check(FreezeTrace::current()==FreezeTrace::PPG,"scope exit restores PPG parent");
  Tracker t;
  check(!t.poll(0x101,100),"first observation is not a stall");
  check(!t.poll(0x101,2099),"1999ms is below threshold");
  check(t.poll(0x101,2100),"2000ms records first stagnant stage");
  check(t.firstWord==0x101 && t.firstAtMs==2100 && t.firstAgeMs==2000,"stall evidence contains stage and time");
  check(!t.poll(0x101,5100),"same stall does not relatch");
  t.poll(0x202,5200);t.poll(0x202,7200);
  check(t.firstWord==0x101 && t.firstAtMs==2100,"later stalls preserve first evidence");
  check(t.word==0x202 && t.polls==6,"current progress remains observable after first stall");
  Tracker progress;
  progress.poll(0x105,0);progress.poll(0x205,1900);
  check(!progress.poll(0x305,3800) && progress.firstWord==0,"same stage with advancing sequence is progress");
  Tracker wrap;
  wrap.poll(0x110,0xFFFFFF00u);
  check(!wrap.poll(0x110,1743),"millis wrap at 1999ms");
  check(wrap.poll(0x110,1744),"millis wrap at 2000ms");
  const Record good=t.record(7300);
  check(valid(good),"record checksum validates complete evidence");
  check(good.word==0x202 && good.observedMs==7300 && good.firstWord==0x101,"record preserves live and first stall");
  for(unsigned i=0;i<sizeof(Record)/sizeof(uint32_t);++i){
    Record corrupt=good;
    // memcpy avoids aliasing assumptions about structure members.
    uint32_t words[sizeof(Record)/sizeof(uint32_t)];
    __builtin_memcpy(words,&corrupt,sizeof(corrupt)); words[i]^=1;
    __builtin_memcpy(&corrupt,words,sizeof(corrupt));
    check(!valid(corrupt),"reject corrupted/torn record word");
  }
  check(!valid(Record{}),"reject uninitialized RTC");
  printf("CODEX REPRODUCTION TESTS: %d cases, %d failures\n",cases,failures);
  return failures?1:0;
}
