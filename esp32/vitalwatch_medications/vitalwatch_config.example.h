#pragma once

// Copia este archivo como vitalwatch_config.h y completa los datos reales.
// vitalwatch_config.h esta ignorado por Git para no publicar las credenciales.
const char* WIFI_SSID = "NOMBRE_DE_TU_WIFI";
const char* WIFI_PASSWORD = "CLAVE_DE_TU_WIFI";

const char* SUPABASE_URL = "https://sehuynlvfvgfhelqpbrx.supabase.co";
const char* SUPABASE_KEY = "TU_CLAVE_PUBLICABLE_DE_SUPABASE";
const char* DEVICE_CODE = "VW-001";
const char* DEVICE_TOKEN = "TOKEN_PRIVADO_DEL_ESP32";

// Cableado de la pantalla ST7735 SPI 1.44 pulgadas (128x128).
const int TFT_SCK = 18;
const int TFT_MOSI = 23;  // El pin SDA de esta pantalla funciona como MOSI.
const int TFT_DC = 2;     // En la placa de la pantalla aparece como A0.
const int TFT_RST = 4;
const int TFT_CS = 5;
