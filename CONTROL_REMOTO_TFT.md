# Control remoto de la TFT

VitalWatch 0.9.0 permite elegir desde la app que muestra la pantalla ST7735:

- menu principal;
- signos vitales;
- movimiento y caidas;
- estado del equipo;
- medicacion.

Tambien se puede encender o dormir el controlador de la TFT. La orden se guarda
en Supabase y el ESP32 la consulta junto con los medicamentos cada 5 segundos.
La app distingue la orden solicitada del estado confirmado por la pulsera.

## Prioridades de seguridad

Los botones fisicos, una posible caida, SOS y el portal de configuracion WiFi
tienen prioridad. Si la TFT estaba dormida, esos eventos la despiertan de forma
temporal. Los sensores y la telemetria continuan trabajando con la pantalla
dormida.

## Limite electrico actual

En el modulo actual el pin `LED` esta conectado directamente a `3V3`. El
firmware puede dormir el controlador ST7735, pero no puede cortar esa luz. La
app tampoco puede corregir una fuente que entregue poca corriente.

Para apagar la iluminacion de verdad, usa un MOSFET de canal P o un load switch
en el pin `LED` y controla su entrada con un GPIO, por ejemplo GPIO 32. No
conectes el LED directamente al GPIO. Despues cambia en `Configuracion.h`:

```cpp
static constexpr int8_t PIN_TFT_BACKLIGHT = 32;
static constexpr bool TFT_BACKLIGHT_ACTIVO_ALTO = false;
```

La polaridad depende del circuito elegido. Antes de conectarlo, confirma el
pinout y la corriente del modulo TFT. La pantalla y el ESP32 deben compartir
GND y usar una alimentacion de 3.3 V estable.

## Prueba

1. Despliega las migraciones y la Edge Function actualizadas.
2. Carga firmware 0.9.0 en el ESP32.
3. Abre Configuracion en la app.
4. Toca una vista en `Mostrar en la pulsera`.
5. Espera hasta 5 segundos.
6. Comprueba la TFT y el texto `Confirmado por el ESP32`.

El firmware anterior no reconoce estas ordenes. La app necesita que el ESP32
tenga instalada la version 0.9.0.
