#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <SPI.h>

const int TFT_SCK = 18;
const int TFT_MOSI = 23;
const int TFT_DC = 2;
const int TFT_RST = 4;
const int TFT_CS = 5;

Adafruit_ST7735 tft = Adafruit_ST7735(&SPI, TFT_CS, TFT_DC, TFT_RST);

void setup() {
  Serial.begin(115200);
  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  tft.setTextWrap(false);

  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0, 0, 128, 20, ST77XX_BLUE);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(1);
  tft.setCursor(25, 6);
  tft.print("VITALWATCH TFT");

  tft.fillRect(8, 30, 34, 34, ST77XX_RED);
  tft.fillRect(47, 30, 34, 34, ST77XX_GREEN);
  tft.fillRect(86, 30, 34, 34, ST77XX_BLUE);

  tft.setCursor(11, 70);
  tft.print("ROJO");
  tft.setCursor(48, 70);
  tft.print("VERDE");
  tft.setCursor(90, 70);
  tft.print("AZUL");

  tft.setTextColor(ST77XX_CYAN);
  tft.setTextSize(2);
  tft.setCursor(46, 84);
  tft.print("OK");

  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(1);
  tft.setCursor(21, 112);
  tft.print("ST7735 128x128");

  Serial.println("Prueba TFT VitalWatch iniciada correctamente.");
}

void loop() {
  // La imagen queda fija para poder revisar colores, orientacion y cableado.
  delay(1000);
}
