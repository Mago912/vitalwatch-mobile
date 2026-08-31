# VitalWatch: medicamentos y ESP32

## Que hace el firmware 0.9.0

La version 0.9.0 conserva la telemetria y configuracion WiFi de 0.8.0, y agrega control de la TFT
desde el celular. Incluye:

- medicion continua con MAX30102;
- lectura de movimiento con MPU compatible;
- aviso visual experimental de impacto;
- tres botones de navegacion;
- interfaz completa en la ST7735.

Ademas, el ESP32 consulta los medicamentos de Supabase por WiFi cada 5 segundos.
La red corre en una tarea separada para que una conexion HTTPS lenta no detenga
la adquisicion de los sensores. Desde el nuevo menu `MEDICACION` se pueden
recorrer tratamientos y confirmar una toma con una pulsacion larga de OK.

La carpeta `esp32/VitalWatch_FW_0_5_0` conserva el codigo recibido sin cambios.
La version 0.6.0 conserva la primera integracion de medicamentos que ya fue
probada en el ESP32. La telemetria inicial queda en 0.7.0 y la version actual
esta en `esp32/VitalWatch_FW_0_9_0`.

El firmware 0.9.0 envia cada 30 segundos la frecuencia cardiaca, SpO2 y fuerza
de aceleracion realmente disponibles en los sensores. Una posible caida se
envia inmediatamente. Para activar SOS se mantienen presionados izquierda y
derecha al mismo tiempo durante 2.5 segundos.

AsyncStorage sigue guardando una copia local en el celular. No es la fuente
principal cuando hay Internet.

## Preparar Arduino IDE

1. Instala el soporte para placas ESP32.
2. En el gestor de bibliotecas instala:
   - `ArduinoJson` de Benoit Blanchon.
   - `Adafruit GFX Library`.
   - `Adafruit ST7735 and ST7789 Library`.
   - `SparkFun MAX3010x Pulse and Proximity Sensor Library`.
3. Abre `esp32/VitalWatch_FW_0_9_0/VitalWatch_FW_0_9_0.ino`.
4. Copia `esp32/VitalWatch_FW_0_9_0/vitalwatch_config.example.h` como
   `esp32/VitalWatch_FW_0_9_0/vitalwatch_config.h`.
5. Completa la clave publicable de Supabase y el token privado del ESP32. El
   WiFi se configura despues desde el celular.
6. Conecta los tres pulsadores indicados en la seccion de cableado.
7. Carga el programa y abre el Monitor Serie a 115200 baudios.

`esp32/VitalWatch_FW_0_9_0/vitalwatch_config.h` esta ignorado por Git. No
publiques el token privado.

## Compilar y cargar desde este proyecto

Arduino CLI 1.5.1, el nucleo ESP32 3.3.11 y las bibliotecas necesarias quedan
instalados localmente en las carpetas ignoradas `.tools/` y `.arduino/`.
En una computadora nueva, todo el entorno se instala con:

```powershell
npm run firmware:setup
```

```powershell
# Opcional: dejar una red de respaldo para una instalacion anterior
npm run firmware:configure

# Comprobar que Windows detecta el ESP32 y conocer su puerto COM
npm run firmware:ports

# Probar primero colores, orientacion y cableado de la pantalla
npm run firmware:tft:upload

# Compilar el firmware para ESP32 Dev Module
npm run firmware:build

# Cargar el firmware completo
npm run firmware:upload

# Ver los mensajes del ESP32
npm run firmware:monitor
```

Los comandos detectan automaticamente el puerto cuando hay un unico dispositivo
USB ademas de `COM1`. Si Windows muestra varios puertos, se puede indicar uno con
`npm run firmware:upload -- -Port COM3`.

La configuracion de respaldo pide la contrasena sin mostrarla. La carga ya no
exige WiFi en el codigo: valida Supabase y el token del dispositivo. El binario
completo generado queda en
`.arduino/build/vitalwatch-0.9.0/VitalWatch_FW_0_9_0.ino.merged.bin`.

La prueba TFT no necesita WiFi ni Supabase. Debe mostrar un encabezado azul, tres
cuadrados rojo, verde y azul, y el texto `OK`. Cuando esa imagen se vea bien, se
puede cargar el firmware completo.

## Probar la vinculacion

1. Crea una cuenta en la app y confirma el correo si Supabase lo solicita.
2. Vincula la pulsera `VW-001` con su codigo de un solo uso.
3. Agrega o edita un medicamento desde la app.
4. En la pulsera, busca `MEDICACION` con izquierda/derecha y entra con OK.
5. Espera hasta 5 segundos o reinicia el ESP32.
6. Comprueba que el medicamento aparece en la pantalla y el Monitor Serie.
7. Manten presionado OK para marcar la toma.
8. En la app, entra a Medicacion y toca `Actualizar` si el cambio todavia no
   aparecio. La app tambien actualiza los datos automaticamente.

## Pantalla TFT ST7735 de 1.44 pulgadas

La placa de las fotos es SPI, 128x128 y usa la inicializacion
`INITR_144GREENTAB`. El cableado propuesto es:

| Pantalla | ESP32 | Funcion |
| --- | --- | --- |
| `LED` | `3V3` | Iluminacion |
| `SCK` | `GPIO 18` | Reloj SPI |
| `SDA` | `GPIO 23` | Datos SPI/MOSI |
| `A0` | `GPIO 2` | Datos o comandos (`DC`) |
| `RESET` | `GPIO 4` | Reinicio de pantalla |
| `CS` | `GPIO 5` | Seleccion SPI |
| `GND` | `GND` | Tierra |
| `VCC` | `3V3` | Alimentacion |

Usa 3.3 V para mantener las senales al mismo nivel logico del ESP32. La pantalla
muestra el primer medicamento pendiente, su fecha, hora, dosis y estado. Los botones
izquierdo y derecho permiten recorrer toda la lista.

## Botones y sensores

Los tres botones se conectan entre el GPIO indicado y GND. El firmware usa
`INPUT_PULLUP`, por lo que no necesitan una resistencia externa para esta prueba.

| Control | ESP32 | Accion |
| --- | --- | --- |
| Izquierda | `GPIO 25` | Vista o elemento anterior |
| OK | `GPIO 26` | Entrar o volver |
| Derecha | `GPIO 27` | Vista o elemento siguiente |
| OK largo | `GPIO 26` | Confirmar toma o diagnostico manual |
| Izquierda + derecha 2.5 s | `GPIO 25` + `GPIO 27` | Activar SOS |

El MAX30102 y el MPU comparten el bus I2C:

| Sensor | ESP32 |
| --- | --- |
| `SDA` | `GPIO 21` |
| `SCL` | `GPIO 22` |
| `VCC` | Segun el modulo utilizado |
| `GND` | `GND` |

El MAX30102 usa la direccion `0x57`. El firmware busca el MPU en `0x68` y `0x69`.

## Telemetria real y bateria

La frecuencia cardiaca y SpO2 solo se envian cuando el MAX30102 tiene una
lectura disponible. Si no hay un dedo o la senal no es suficiente, Supabase
recibe esos campos como vacios en lugar de valores inventados.

El ESP32 Dev Module no incluye una medicion automatica de la bateria. Para leer
una LiPo se necesita un divisor resistivo que mantenga la entrada ADC por debajo
de 3.3 V y un pin ADC1 libre. Cuando exista ese cableado, configura
`PIN_BATERIA_ADC`, `FACTOR_DIVISOR_BATERIA` y los voltajes minimo/maximo en
`Configuracion.h`. Mientras el pin sea `-1`, la bateria queda sin dato.

La Edge Function `vitalwatch-device-telemetry` valida el token privado de la
pulsera, guarda `sensor_readings`, actualiza el estado del dispositivo y crea
eventos `fall_detected` o `sos`. La app consulta esos datos con RLS y puede
recibir las alertas push existentes.

## Seguridad de esta version escolar

La app usa Supabase Auth con correo y contrasena. Cada cuenta solo puede consultar
y modificar sus propios datos mediante politicas RLS de Supabase.

La vinculacion usa un codigo de un solo uso: despues de asociar `VW-001` con una
cuenta, el codigo se elimina de la base de datos. El ESP32 tiene una credencial
distinta, guardada solamente en
`esp32/VitalWatch_FW_0_9_0/vitalwatch_config.h`, para consultar sus
medicamentos y marcar una toma. El repositorio guarda unicamente los hashes
SHA-256 de esas credenciales.

El firmware no contiene la contrasena de la cuenta ni una clave administrativa de
Supabase. Si se cambia de placa ESP32, tambien se debe generar una nueva
credencial del dispositivo.
