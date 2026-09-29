#include <cmath>
#include <cstdio>
#include <cstring>
#include "PpgBeatFusion.h"
using std::isnan;
using std::isfinite;
static uint32_t fakeMs=0;
uint32_t millis(){return fakeMs;}
// Generated from current production source, NOT a rewritten algorithm.
#include "publication.inc"

static int failures=0, cases=0;
void check(bool ok,const char* name){
  ++cases;
  std::printf("%s: %s\n",ok?"PASS":"FAIL",name);
  if(!ok)++failures;
}
void fresh(){
  fakeMs=0;
  hr={NAN,HeartRateStatus::INSUFFICIENT_DATA,SignalQuality::POOR,QR_NONE,0,0};
  sp={NAN,SpO2Status::INSUFFICIENT_DATA,SignalQuality::POOR,QR_NONE,0,0,0};
  resetDisplayResults();
}
void publish(uint32_t ms,HeartRateStatus status,float bpm){
  fakeMs=ms;
  hr={bpm,status,SignalQuality::GOOD,
      (uint16_t)(status==HeartRateStatus::UNSTABLE?QR_IBI_INCONSISTENT:QR_NONE),
      (uint64_t)ms*1000,0};
  publishDisplayResults();
}
PpgFusedBeat pair(PpgBeatFusion& fusion,uint64_t us){
  PpgChannelObservation red={},ir={};
  red.timestampUs=ir.timestampUs=us;
  red.observedAtUs=ir.observedAtUs=us+320000;
  red.candidate=ir.candidate=true;
  return fusion.update(red,ir);
}
void publicationTests(bool requireImmediate){
  fresh();
  publish(1000,HeartRateStatus::VALID,60);
  check(requireImmediate?hrDisplay.status==HeartRateStatus::VALID:
      hrDisplay.status==HeartRateStatus::INSUFFICIENT_DATA,
      requireImmediate?"contract: valid state should publish immediately":"baseline: valid at 1 s remains unpublished");
  publish(2000,HeartRateStatus::UNSTABLE,62.5);
  publish(5000,HeartRateStatus::UNSTABLE,62.5);
  check(hrDisplay.status==HeartRateStatus::UNSTABLE,"control: final unstable input remains unstable");

  fresh();
  publish(5000,HeartRateStatus::VALID,60);
  publish(5040,HeartRateStatus::UNSTABLE,62.5);
  check(requireImmediate?hrDisplay.status==HeartRateStatus::UNSTABLE:
      hrDisplay.status==HeartRateStatus::VALID,
      requireImmediate?"contract: numeric unstable must invalidate immediately":"baseline: numeric unstable retains prior VALID");
  publish(10000,HeartRateStatus::UNSTABLE,62.5);
  check(hrDisplay.status==HeartRateStatus::UNSTABLE,"baseline: unstable state arrives on next publication");

  fresh();
  publish(5000,HeartRateStatus::VALID,60);
  publish(5040,HeartRateStatus::UNSTABLE,NAN);
  check(hrDisplay.status==HeartRateStatus::UNSTABLE&&isnan(hrDisplay.bpm)&&displayBpmCount==0,
        "control: unstable NaN clears immediately");
  publish(10000,HeartRateStatus::VALID,60);
  publish(10040,HeartRateStatus::NO_CONTACT,NAN);
  check(hrDisplay.status==HeartRateStatus::NO_CONTACT&&isnan(hrDisplay.bpm)&&displayBpmCount==0,
        "control: loss of contact clears immediately when publication function runs");

  fresh();
  for(uint32_t ms=1000;ms<=10000;ms+=1000)publish(ms,HeartRateStatus::UNSTABLE,70);
  check(hrDisplay.status==HeartRateStatus::UNSTABLE,"control: unstable-only input never becomes VALID");
  fresh();
  for(uint32_t ms=1000;ms<=4000;ms+=1000)publish(ms,HeartRateStatus::UNSTABLE,70);
  publish(5000,HeartRateStatus::VALID,90);
  check(hrDisplay.status==HeartRateStatus::VALID&&hrDisplay.bpm==(requireImmediate?90:70)&&hr.bpm==90,
        requireImmediate?"contract: newly valid output excludes unstable history":
        "baseline: valid publication median includes preceding unstable numeric values");
}
void correctedPublicationEdges(){
  fresh();
  publish(1000,HeartRateStatus::VALID,70);
  publish(2000,HeartRateStatus::VALID,90);
  check(hrDisplay.bpm==70,"contract: valid-to-valid numeric smoothing retains its cadence");
  publish(5000,HeartRateStatus::VALID,80);
  check(hrDisplay.bpm==80,"contract: stable numeric publication uses the valid-only median");
  publish(5040,HeartRateStatus::UNSTABLE,100);
  check(hrDisplay.status==HeartRateStatus::UNSTABLE&&displayBpmCount==0&&
        hrDisplay.qualityReasons==QR_IBI_INCONSISTENT&&hrDisplay.timestampUs==5040000,
        "contract: invalidation copies metadata immediately and clears numeric history");
  publish(5080,HeartRateStatus::VALID,60);
  check(hrDisplay.status==HeartRateStatus::VALID&&hrDisplay.bpm==60&&displayBpmCount==1,
        "contract: reacquisition publishes fresh valid number, excluding the previous session");
  check(hr.status==HeartRateStatus::VALID&&hr.bpm==60&&hr.timestampUs==5080000,
        "control: publication does not mutate instantaneous HR");

  const HeartRateStatus invalidStates[]={HeartRateStatus::INSUFFICIENT_DATA,
    HeartRateStatus::LOW_QUALITY,HeartRateStatus::NO_CONTACT,
    HeartRateStatus::TIMING_INVALID,HeartRateStatus::SENSOR_ERROR};
  for(const auto status:invalidStates){
    fresh();publish(5000,HeartRateStatus::VALID,60);publish(5040,status,NAN);
    check(hrDisplay.status==status&&isnan(hrDisplay.bpm)&&displayBpmCount==0,
          "contract: non-valid status propagates without waiting for numeric cadence");
  }
  const float invalidNumbers[]={NAN,INFINITY,0,-1};
  for(const float bpm:invalidNumbers){
    fresh();publish(5000,HeartRateStatus::VALID,60);publish(5040,HeartRateStatus::VALID,bpm);
    check(hrDisplay.status!=HeartRateStatus::VALID&&isnan(hrDisplay.bpm)&&displayBpmCount==0,
          "contract: malformed VALID value cannot retain valid publication");
  }

  fresh();
  sp={95,SpO2Status::EXPERIMENTAL_VALID,SignalQuality::GOOD,0,1000000,0,0};
  publish(1000,HeartRateStatus::VALID,60);
  check(spDisplay.status==SpO2Status::INSUFFICIENT_DATA,"control: immediate HR does not advance SpO2 publication");
  publish(5000,HeartRateStatus::VALID,60);
  check(spDisplay.spo2Estimate==95,"control: SpO2 still publishes on original cadence");
  sp.spo2Estimate=92;
  publish(5040,HeartRateStatus::UNSTABLE,70);
  check(spDisplay.spo2Estimate==95,"control: HR invalidation does not advance SpO2 publication");
  sp.status=SpO2Status::INVALID;sp.spo2Estimate=NAN;
  publish(5080,HeartRateStatus::UNSTABLE,70);
  check(spDisplay.status==SpO2Status::INVALID&&isnan(spDisplay.spo2Estimate),
        "control: invalid SpO2 still propagates immediately");

  fresh();fakeMs=0xffffff00u;resetDisplayResults();
  publish(0xffffff10u,HeartRateStatus::VALID,60);
  publish(1000,HeartRateStatus::VALID,90);
  check(hrDisplay.bpm==60,"contract: millis wrap does not prematurely publish the numeric value");
  publish(4744,HeartRateStatus::VALID,80);
  check(hrDisplay.bpm==80,"control: numeric publication resumes at 5000 ms across wrap");
}
void fusionTests(){
  PpgBeatFusion fusion;
  PpgFusedBeat beat={};
  for(uint64_t us=1000000;us<=9000000;us+=1000000)beat=pair(fusion,us);
  check(beat.ibiCount==8&&beat.bpm==60&&!beat.historyReset,"fusion: nine paired pulses yield eight 1000 ms IBIs");
  beat=pair(fusion,11000000);
  check(beat.fused&&beat.historyReset&&beat.ibiCount==0&&beat.synchronizedCount==1&&isnan(beat.bpm),
        "fusion: one missed pair at 60 bpm clears history at 2000 ms");
  beat=pair(fusion,12000000);
  check(!beat.historyReset&&beat.ibiCount==1&&beat.bpm==60,"fusion: recovery starts with one IBI, not restored history");
  fusion.reset();pair(fusion,1000000);beat=pair(fusion,2600000);
  check(!beat.historyReset&&beat.ibiCount==1&&beat.ibiMs==1600,"fusion: 1600 ms accepted");
  beat=pair(fusion,4201000);
  check(beat.historyReset&&beat.ibiCount==0,"fusion: 1601 ms clears history");
  fusion.reset();pair(fusion,1000000);beat=pair(fusion,1329000);
  check(!beat.fused&&!beat.historyReset&&beat.ibiCount==0,"fusion: 329 ms rejected without resetting history");
  beat=pair(fusion,1330000);
  check(beat.fused&&beat.ibiCount==1&&beat.ibiMs==330,"fusion: 330 ms accepted relative to last accepted pair");
  fusion.reset();
  PpgChannelObservation red={},ir={};
  red.timestampUs=1000000;ir.timestampUs=1121000;
  red.observedAtUs=ir.observedAtUs=1500000;
  red.candidate=ir.candidate=true;
  beat=fusion.update(red,ir);
  check(!beat.fused&&beat.ibiCount==0,"fusion: channels 121 ms apart do not form a pair");
}
int main(int argc,char** argv){
  const bool requireImmediate=argc==2&&std::strcmp(argv[1],"--require-immediate")==0;
  std::puts("CODEX REPRODUCTION TESTS — synthetic inputs, real production functions");
  publicationTests(requireImmediate);
  if(requireImmediate)correctedPublicationEdges();
  fusionTests();
  std::printf("cases=%d failures=%d\n",cases,failures);
  return failures?1:0;
}
