#include "Interfaz.h"
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <math.h>
#include "SystemState.h"
#include "Sensor_Oxigeno.h"
#include "Sensor_Movimiento.h"
#include "BioResearch.h"
#include "LogoVitalWatch.h"

namespace {
Adafruit_ST7735 tft(VitalWatchConfig::TFT_CS,VitalWatchConfig::TFT_DC,VitalWatchConfig::TFT_RST);
constexpr uint16_t BLACK=ST77XX_BLACK,WHITE=ST77XX_WHITE,CYAN=ST77XX_CYAN,RED=ST77XX_RED,GREEN=ST77XX_GREEN,YELLOW=ST77XX_YELLOW;
constexpr uint16_t BLUE_DARK=0x0128,BLUE=0x049F,GRAY=0x7BEF,DARK_GRAY=0x2104;
constexpr int TOP_H=14,FOOT_Y=116,CONTENT_Y=15;
DatosBarraSuperior top={false,0,false,0,false,0,0};
uint8_t menuIndex=0;
ModoSistema renderedMode=(ModoSistema)255;
bool viewDirty=true,topDirty=true;
char buttonText[8]="";uint32_t buttonUntilMs=0;
uint32_t lastPpgUi=0,lastImuUi=0,lastStatusUi=0;

void centered(const char*txt,int y,uint8_t size,uint16_t fg,uint16_t bg=BLACK){int16_t x1,y1;uint16_t w,h;tft.setTextSize(size);tft.setTextWrap(false);tft.getTextBounds((char*)txt,0,y,&x1,&y1,&w,&h);int x=max(0,(tft.width()-(int)w)/2);tft.setTextColor(fg,bg);tft.setCursor(x,y);tft.print(txt);}
void clearRect(int x,int y,int w,int h,uint16_t c=BLACK){tft.fillRect(x,y,w,h,c);}

void drawTop(){
  char a[8],b[8],c[8];
  if(top.climaValido)snprintf(a,sizeof(a),"%dC",top.temperaturaC);else strcpy(a,"--C");
  if(top.bateriaValida)snprintf(b,sizeof(b),"%d%%",top.bateriaPorcentaje);else strcpy(b,"--%");
  if(top.horaValida)snprintf(c,sizeof(c),"%02u:%02u",top.hora,top.minuto);else strcpy(c,"--:--");
  tft.fillRect(0,0,128,TOP_H,BLUE_DARK);tft.drawFastHLine(0,TOP_H-1,128,BLUE);
  tft.setTextSize(1);tft.setTextColor(CYAN,BLUE_DARK);tft.setCursor(2,3);tft.print(a);
  tft.setTextColor(WHITE,BLUE_DARK);tft.setCursor(51,3);tft.print(b);tft.setCursor(91,3);tft.print(c);topDirty=false;
}
void drawFooter(){
  clearRect(0,FOOT_Y,128,12,DARK_GRAY);tft.setTextSize(1);tft.setTextColor(WHITE,DARK_GRAY);
  if(buttonText[0]&&millis()<buttonUntilMs){tft.setCursor(2,118);tft.print("BTN ");tft.print(buttonText);}else{tft.setCursor(2,118);tft.print("< > navegar  OK");buttonText[0]='\0';}
}

const char* menuTitle(uint8_t i){return i==0?"SIGNOS":i==1?"MOVIMIENTO":"ESTADO";}
const char* menuDesc(uint8_t i){return i==0?"Pulso y SpO2":i==1?"Sensor de movimiento":"Estado del equipo";}

void drawSplashStatic(){
  tft.fillScreen(BLACK);const int x=(128-LOGO_CORAZON_ANCHO)/2;tft.drawRGBBitmap(x,14,LOGO_CORAZON_RGB565,LOGO_CORAZON_ANCHO,LOGO_CORAZON_ALTO);
  tft.setTextSize(2);tft.setCursor(4,82);tft.setTextColor(WHITE,BLACK);tft.print("Vital");tft.setTextColor(CYAN,BLACK);tft.print("Watch");centered("Iniciando...",108,1,GRAY);
}

void drawMenuStatic(){
  tft.fillScreen(BLACK);drawTop();const int x=(128-LOGO_CORAZON_ANCHO)/2;tft.drawRGBBitmap(x,24,LOGO_CORAZON_TENUE_RGB565,LOGO_CORAZON_ANCHO,LOGO_CORAZON_ALTO);
  clearRect(4,43,120,59,BLACK);tft.drawRoundRect(5,43,118,59,5,BLUE);centered(menuTitle(menuIndex),52,2,WHITE);centered(menuDesc(menuIndex),77,1,CYAN);
  char page[8];snprintf(page,sizeof(page),"%u/3",menuIndex+1);centered(page,91,1,GRAY);drawFooter();
}

void drawPpgStatic(){
  tft.fillScreen(BLACK);drawTop();centered("SIGNOS VITALES",18,1,CYAN);tft.drawFastHLine(4,29,120,BLUE);
  tft.setTextSize(1);tft.setTextColor(GRAY,BLACK);tft.setCursor(7,35);tft.print("PULSO");tft.setCursor(72,35);tft.print("SpO2");
  drawFooter();
}
void drawPpgDynamic(){
  const HeartRateResult&hr=PPGService::heartRate();const SpO2Result&sp=PPGService::spo2();
  clearRect(4,45,120,66,BLACK);
  char v[18];
  tft.setTextSize(2);tft.setTextColor(WHITE,BLACK);tft.setCursor(7,47);
  if(hr.status==HeartRateStatus::VALID){snprintf(v,sizeof(v),"%.0f",hr.bpm);tft.print(v);}else tft.print("--");
  tft.setTextSize(1);tft.setTextColor(GRAY,BLACK);tft.setCursor(7,66);tft.print("bpm");
  tft.setTextSize(2);tft.setTextColor(CYAN,BLACK);tft.setCursor(72,47);
  if(sp.status==SpO2Status::EXPERIMENTAL_VALID){snprintf(v,sizeof(v),"%.0f",sp.spo2Estimate);tft.print(v);}else tft.print("--");
  tft.setTextSize(1);tft.setTextColor(GRAY,BLACK);tft.setCursor(72,66);tft.print("%");
  tft.setTextColor(YELLOW,BLACK);tft.setCursor(7,79);tft.print(nombreSesionPPG(PPGService::sessionState()));
  tft.setTextColor(GRAY,BLACK);tft.setCursor(7,91);tft.print("HR:");tft.print(nombreEstadoHR(hr.status));
  tft.setCursor(7,102);tft.print("O2:");tft.print(nombreEstadoSpO2(sp.status));
}

void drawImuStatic(){
  tft.fillScreen(BLACK);drawTop();centered("MOVIMIENTO",18,1,CYAN);tft.drawFastHLine(4,29,120,BLUE);drawFooter();
}
void drawImuDynamic(){
  clearRect(3,34,122,78,BLACK);const MotionSample&s=MotionService::latest();const MotionDiagnostics&d=MotionService::diagnostics();
  tft.setTextSize(1);
  if(!s.valid){tft.setTextColor(RED,BLACK);tft.setCursor(5,40);tft.print("IMU no disponible");tft.setCursor(5,52);tft.print(d.error);return;}
  tft.setTextColor(WHITE,BLACK);tft.setCursor(5,36);tft.printf("|a| %.2f g",s.accelerationMagnitudeG);tft.setCursor(5,48);tft.printf("dA  %.2f g",s.accelerationDeltaG);tft.setCursor(5,60);tft.printf("gyro %.2f rad/s",s.gyroMagnitudeRadS);
  tft.setTextColor(GRAY,BLACK);tft.setCursor(5,74);tft.printf("dt %lu us",(unsigned long)s.dtUs);tft.setCursor(5,86);tft.printf("jit %ld us",(long)s.jitterUs);
  tft.setCursor(5,98);tft.print((s.accelSaturated||s.gyroSaturated)?"SATURACION DETECTADA":"Sin saturacion");
}

void drawStatusStatic(){tft.fillScreen(BLACK);drawTop();centered("SYS / BIO",18,1,CYAN);tft.drawFastHLine(4,29,120,BLUE);drawFooter();}
void drawStatusDynamic(){
  clearRect(4,34,120,78,BLACK);const auto&pd=PPGService::diagnostics();const auto&md=MotionService::diagnostics();
  tft.setTextSize(1);tft.setTextColor(GRAY,BLACK);tft.setCursor(5,35);tft.printf("Target %s %s",VitalWatchConfig::FAMILIA_SISTEMA,VitalWatchConfig::VERSION_SISTEMA_OBJETIVO);
  tft.setTextColor(CYAN,BLACK);tft.setCursor(5,46);tft.printf("Activo %s %s",VitalWatchConfig::FAMILIA_BIOMEDICA,VitalWatchConfig::VERSION_BIOMEDICA);
  tft.setTextColor(systemHealth.ppgReady?GREEN:RED,BLACK);tft.setCursor(5,58);tft.print("PPG ");tft.print(systemHealth.ppgReady?"OK":"ERROR");
  tft.setTextColor(systemHealth.imuReady?GREEN:YELLOW,BLACK);tft.setCursor(5,69);tft.print("IMU ");tft.print(md.model);
  tft.setTextColor(WHITE,BLACK);tft.setCursor(5,80);tft.printf("PPG drop? %lu",(unsigned long)pd.suspectedSoftwareDrops);tft.setCursor(5,91);tft.printf("IMU miss %lu",(unsigned long)md.missedDeadlines);tft.setCursor(5,102);tft.printf("Log drop %lu",(unsigned long)BioResearch::droppedRecords());
}

void drawAlert(){
  tft.fillScreen(RED);tft.setTextColor(WHITE,RED);centered("AVISO",14,2,WHITE,RED);centered("POSIBLE",48,2,WHITE,RED);centered("IMPACTO",67,2,WHITE,RED);centered("Revise el estado",94,1,WHITE,RED);centered("OK: cerrar",111,1,WHITE,RED);
}

void renderStaticForMode(){
  const uint32_t t0=micros();
  switch(modoActual){case ModoSistema::SPLASH:drawSplashStatic();break;case ModoSistema::MENU:drawMenuStatic();break;case ModoSistema::SIGNOS_VITALES:drawPpgStatic();drawPpgDynamic();break;case ModoSistema::DIAGNOSTICO_MOVIMIENTO:drawImuStatic();drawImuDynamic();break;case ModoSistema::ESTADO_SISTEMA:drawStatusStatic();drawStatusDynamic();break;case ModoSistema::ALERTA_IMPACTO:drawAlert();break;}
  runtimeMetrics.displayRenderLastUs=micros()-t0;if(runtimeMetrics.displayRenderLastUs>runtimeMetrics.displayRenderMaxUs)runtimeMetrics.displayRenderMaxUs=runtimeMetrics.displayRenderLastUs;
  renderedMode=modoActual;viewDirty=false;topDirty=false;
}
}

namespace DisplayService {
void begin(){
  SPI.begin(VitalWatchConfig::TFT_SCLK,-1,VitalWatchConfig::TFT_MOSI,VitalWatchConfig::TFT_CS);
  tft.initR(INITR_144GREENTAB);tft.setRotation(VitalWatchConfig::ROTACION_TFT);tft.setTextWrap(false);systemHealth.displayReady=true;viewDirty=true;renderStaticForMode();
}
void invalidateView(){viewDirty=true;}
void notifyPhysicalButton(EventoFisicoBoton e){snprintf(buttonText,sizeof(buttonText),"%s",ButtonService::physicalName(e));buttonUntilMs=millis()+VitalWatchConfig::DURACION_INDICADOR_BOTON_MS;if(modoActual!=ModoSistema::SPLASH&&modoActual!=ModoSistema::ALERTA_IMPACTO)drawFooter();}
void setWeather(int v,bool valid){top.temperaturaC=v;top.climaValido=valid;topDirty=true;}
void setBattery(int v,bool valid){top.bateriaPorcentaje=constrain(v,0,100);top.bateriaValida=valid;topDirty=true;}
void setClock(uint8_t h,uint8_t m,bool valid){top.hora=h;top.minuto=m;top.horaValida=valid;topDirty=true;}
void menuPrevious(){menuIndex=(menuIndex+2)%3;viewDirty=true;}
void menuNext(){menuIndex=(menuIndex+1)%3;viewDirty=true;}
uint8_t selectedMenuIndex(){return menuIndex;}
ModoSistema selectedMenuMode(){return menuIndex==0?ModoSistema::SIGNOS_VITALES:menuIndex==1?ModoSistema::DIAGNOSTICO_MOVIMIENTO:ModoSistema::ESTADO_SISTEMA;}

void update(){
  if(viewDirty||renderedMode!=modoActual){renderStaticForMode();return;}
  const uint32_t now=millis();
  if(topDirty&&modoActual!=ModoSistema::SPLASH&&modoActual!=ModoSistema::ALERTA_IMPACTO)drawTop();
  if(buttonText[0]&&now>=buttonUntilMs&&modoActual!=ModoSistema::SPLASH&&modoActual!=ModoSistema::ALERTA_IMPACTO)drawFooter();
  if(modoActual==ModoSistema::SIGNOS_VITALES&&now-lastPpgUi>=VitalWatchConfig::INTERVALO_UI_PPG_MS){lastPpgUi=now;drawPpgDynamic();}
  else if(modoActual==ModoSistema::DIAGNOSTICO_MOVIMIENTO&&now-lastImuUi>=VitalWatchConfig::INTERVALO_UI_IMU_MS){lastImuUi=now;drawImuDynamic();}
  else if(modoActual==ModoSistema::ESTADO_SISTEMA&&now-lastStatusUi>=VitalWatchConfig::INTERVALO_UI_ESTADO_MS){lastStatusUi=now;drawStatusDynamic();}
}
}
