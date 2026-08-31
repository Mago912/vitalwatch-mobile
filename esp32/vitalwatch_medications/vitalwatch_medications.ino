#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include "vitalwatch_config.h"

const int BUTTON_PIN = 27;
const unsigned long POLL_INTERVAL_MS = 30000;
const int MAX_MEDICATIONS = 10;

struct Medication {
  long id;
  String name;
  String dose;
  String time;
  String status;
};

Medication medications[MAX_MEDICATIONS];
Adafruit_ST7735 tft = Adafruit_ST7735(&SPI, TFT_CS, TFT_DC, TFT_RST);
int medicationCount = 0;
unsigned long lastPoll = 0;
unsigned long lastButtonPress = 0;
int previousButtonState = HIGH;

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  setupDisplay();
  connectToWiFi();
  fetchMedications();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  if (millis() - lastPoll >= POLL_INTERVAL_MS) {
    fetchMedications();
  }

  int buttonState = digitalRead(BUTTON_PIN);
  bool buttonWasPressed = buttonState == LOW && previousButtonState == HIGH;

  if (buttonWasPressed && millis() - lastButtonPress > 800) {
    markFirstPendingMedicationAsTaken();
    lastButtonPress = millis();
  }

  previousButtonState = buttonState;
  delay(20);
}

void connectToWiFi() {
  showMessage("WiFi", "Conectando...", ST77XX_YELLOW);
  Serial.printf("Conectando a %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi conectado. IP: %s\n", WiFi.localIP().toString().c_str());
    showMessage("WiFi", "Conectado", ST77XX_GREEN);
  } else {
    Serial.println("\nNo se pudo conectar al WiFi.");
    showMessage("WiFi", "Sin conexion", ST77XX_RED);
  }
}

void fetchMedications() {
  lastPoll = millis();

  JsonDocument request;
  request["action"] = "list";
  request["deviceCode"] = DEVICE_CODE;

  String response;
  if (!sendRequest(request, response)) {
    return;
  }

  JsonDocument document;
  DeserializationError error = deserializeJson(document, response);

  if (error) {
    Serial.printf("Respuesta JSON invalida: %s\n", error.c_str());
    showMessage("Error", "Respuesta invalida", ST77XX_RED);
    return;
  }

  JsonArray list = document["medications"].as<JsonArray>();
  medicationCount = min((int)list.size(), MAX_MEDICATIONS);

  for (int index = 0; index < medicationCount; index++) {
    JsonObject item = list[index];
    medications[index].id = item["id"].as<long>();
    medications[index].name = item["name"].as<String>();
    medications[index].dose = item["dose"].as<String>();
    medications[index].time = item["time"].as<String>();
    medications[index].status = item["status"].as<String>();
  }

  showMedicationList();
}

void markFirstPendingMedicationAsTaken() {
  for (int index = 0; index < medicationCount; index++) {
    if (medications[index].status == "Pendiente") {
      JsonDocument request;
      request["action"] = "set_status";
      request["deviceCode"] = DEVICE_CODE;
      request["medicationId"] = medications[index].id;
      request["status"] = "taken";

      String response;
      if (sendRequest(request, response)) {
        Serial.printf("%s fue marcado como tomado.\n", medications[index].name.c_str());
        showMessage("Confirmado", "Medicacion tomada", ST77XX_GREEN);
        delay(900);
        fetchMedications();
      }
      return;
    }
  }

  Serial.println("No hay medicamentos pendientes para confirmar.");
  showMessage("VitalWatch", "Nada pendiente", ST77XX_GREEN);
  delay(900);
  showMedicationList();
}

bool sendRequest(JsonDocument& document, String& responseBody) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("No hay conexion WiFi.");
    showMessage("WiFi", "Sin conexion", ST77XX_RED);
    return false;
  }

  WiFiClientSecure secureClient;
  // Para el prototipo escolar se omite la validacion del certificado HTTPS.
  // En una version final conviene instalar el certificado raiz correspondiente.
  secureClient.setInsecure();

  HTTPClient http;
  String endpoint = String(SUPABASE_URL) + "/functions/v1/vitalwatch-device-medications";

  if (!http.begin(secureClient, endpoint)) {
    Serial.println("No se pudo iniciar la conexion HTTPS.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("x-device-token", DEVICE_TOKEN);

  String requestBody;
  serializeJson(document, requestBody);
  int statusCode = http.POST(requestBody);
  responseBody = http.getString();
  http.end();

  if (statusCode < 200 || statusCode >= 300) {
    Serial.printf("Supabase respondio HTTP %d: %s\n", statusCode, responseBody.c_str());
    showMessage("Supabase", "Error de conexion", ST77XX_RED);
    return false;
  }

  return true;
}

void showMedicationList() {
  Serial.println("\n--- Medicamentos de VitalWatch ---");

  if (medicationCount == 0) {
    Serial.println("No hay medicamentos programados.");
    showMessage("VitalWatch", "Sin medicamentos", ST77XX_CYAN);
    return;
  }

  for (int index = 0; index < medicationCount; index++) {
    showMedication(medications[index]);
  }

  int selectedIndex = 0;
  for (int index = 0; index < medicationCount; index++) {
    if (medications[index].status == "Pendiente") {
      selectedIndex = index;
      break;
    }
  }

  drawMedicationScreen(medications[selectedIndex]);
}

void showMedication(const Medication& medication) {
  Serial.printf(
    "%s | %s | %s | %s\n",
    medication.time.c_str(),
    medication.name.c_str(),
    medication.dose.c_str(),
    medication.status.c_str()
  );
}

void setupDisplay() {
  SPI.begin(TFT_SCK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_144GREENTAB);
  tft.setRotation(0);
  tft.setTextWrap(false);
  showMessage("VitalWatch", "Iniciando...", ST77XX_CYAN);
}

void drawMedicationScreen(const Medication& medication) {
  bool isTaken = medication.status == "Tomado";
  uint16_t statusColor = isTaken ? ST77XX_GREEN : ST77XX_YELLOW;

  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0, 0, 128, 18, ST77XX_BLUE);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(1);
  tft.setCursor(5, 5);
  tft.print("VITALWATCH");

  tft.setTextColor(ST77XX_CYAN);
  tft.setTextSize(2);
  tft.setCursor(34, 25);
  tft.print(medication.time);

  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(1);
  printTwoLines(toDisplayText(medication.name), 8, 51, 19);

  tft.setTextColor(ST77XX_CYAN);
  printTwoLines(toDisplayText(medication.dose), 8, 73, 19);

  tft.fillRoundRect(8, 96, 112, 18, 4, statusColor);
  tft.setTextColor(ST77XX_BLACK);
  tft.setCursor(isTaken ? 45 : 34, 101);
  tft.print(isTaken ? "TOMADO" : "PENDIENTE");

  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(12, 119);
  tft.print(isTaken ? "Sin acciones" : "Boton: confirmar");
}

void showMessage(const String& title, const String& message, uint16_t color) {
  tft.fillScreen(ST77XX_BLACK);
  tft.fillRect(0, 0, 128, 20, color);
  tft.setTextColor(ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setCursor(6, 6);
  tft.print(title);
  tft.setTextColor(ST77XX_WHITE);
  printTwoLines(message, 8, 48, 19);
}

void printTwoLines(String text, int x, int y, int maxCharacters) {
  text.trim();

  if ((int)text.length() <= maxCharacters) {
    tft.setCursor(x, y);
    tft.print(text);
    return;
  }

  int breakPosition = text.lastIndexOf(' ', maxCharacters);
  if (breakPosition <= 0) {
    breakPosition = maxCharacters;
  }

  String firstLine = text.substring(0, breakPosition);
  String secondLine = text.substring(breakPosition);
  secondLine.trim();

  if ((int)secondLine.length() > maxCharacters) {
    secondLine = secondLine.substring(0, maxCharacters - 3) + "...";
  }

  tft.setCursor(x, y);
  tft.print(firstLine);
  tft.setCursor(x, y + 10);
  tft.print(secondLine);
}

String toDisplayText(const String& value) {
  String result;

  for (unsigned int index = 0; index < value.length(); index++) {
    unsigned char current = value[index];

    if (current == 0xC3 && index + 1 < value.length()) {
      unsigned char next = value[++index];
      if (next == 0xA1 || next == 0x81) result += 'a';
      else if (next == 0xA9 || next == 0x89) result += 'e';
      else if (next == 0xAD || next == 0x8D) result += 'i';
      else if (next == 0xB3 || next == 0x93) result += 'o';
      else if (next == 0xBA || next == 0x9A) result += 'u';
      else if (next == 0xB1 || next == 0x91) result += 'n';
      continue;
    }

    if (current < 128) {
      result += (char)current;
    }
  }

  return result;
}
