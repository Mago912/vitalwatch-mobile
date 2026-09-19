#include "BioReplay.h"
#include "Configuracion.h"
#include "Sensor_Oxigeno.h"
#include <stdio.h>
#include <string.h>

#if BIO_REPLAY_MODE
namespace {
char line[128];size_t lineLength=0;uint32_t accepted=0,rejected=0;
void processLine(){
  line[lineLength]='\0';lineLength=0;
  if(line[0]=='\0'||line[0]=='#')return;
  if(strcmp(line,"RESET")==0){PPGService::resetReplay();Serial.println(F("[REPLAY] RESET_OK"));return;}
  unsigned long sequence=0,red=0,ir=0;unsigned long long sampleUs=0;unsigned timing=0;
  if(sscanf(line,"%lu,%llu,%lu,%lu,%u",&sequence,&sampleUs,&red,&ir,&timing)!=5){
    ++rejected;Serial.println(F("[REPLAY] ROW_REJECTED"));return;
  }
  const PPGSample sample={(uint32_t)red,(uint32_t)ir,(uint32_t)sequence,(uint64_t)sampleUs,timing!=0};
  PPGService::processReplaySample(sample);++accepted;
}
}
#endif

namespace BioReplay {
void begin(){
#if BIO_REPLAY_MODE
  PPGService::resetReplay();
  Serial.println(F("[REPLAY] READY schema=sample_index,sample_time_us,red_raw,ir_raw,timing_valid"));
#endif
}
void update(){
#if BIO_REPLAY_MODE
  while(Serial.available()){
    const char c=(char)Serial.read();if(c=='\r')continue;
    if(c=='\n'){processLine();continue;}
    if(lineLength+1<sizeof(line))line[lineLength++]=c;else{lineLength=0;++rejected;}
  }
#endif
}
uint32_t acceptedRows(){
#if BIO_REPLAY_MODE
  return accepted;
#else
  return 0;
#endif
}
uint32_t rejectedRows(){
#if BIO_REPLAY_MODE
  return rejected;
#else
  return 0;
#endif
}
}
