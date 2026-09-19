# VITALWATCH — FIRMWARE ARCHITECTURE

## Vista general

Firmwares inspeccionados:

```text
D:\vitalwatch-mobile\esp32\VitalWatch_FW_0_9_0\VitalWatch_FW_0_9_0.ino
C:\Users\Usuario\Downloads\VitalWatch_APP_1.0.3_FW_0.9.1_PARA_OTRA_PC\
└── esp32\VitalWatch_FW_0_9_1\VitalWatch_FW_0_9_1.ino
```

La arquitectura es la misma en ambas versiones. `0.9.0` es el estable histórico;
`0.9.1` es el candidato recuperado y todavía no probado físicamente.

Arquitectura:

```text
setup()
├── botones
├── SPI + TFT
├── I²C compartido
├── IMU
├── MAX30102
├── preparación WiFi
├── tarea de medicamentos/red
└── telemetría

loop() — núcleo principal
├── aplica control remoto de TFT
├── procesa botones y serie
├── procesa IMU
├── procesa MAX30102
├── consume cambios de medicación/WiFi
├── encola telemetría
├── prioriza impacto y SOS
└── renderiza UI

tarea vitalwatch_med — núcleo 0
├── conecta/reconecta WiFi
├── atiende portal cautivo
├── consulta medicamentos/control TFT
├── marca medicamentos tomados
├── reporta estado de TFT
└── envía telemetría HTTPS
```

Principio central: sensores y UI no deben quedar bloqueados por una solicitud
HTTPS lenta.

## Flujo de inicio

1. Abre Serial a 115200.
2. Configura botones y detecta si OK está pulsado.
3. Inicia SPI/TFT y muestra splash.
4. Recupera e inicia bus I²C a 100 kHz.
5. Detecta/configura IMU.
6. Detecta/configura MAX30102.
7. Restablece contrato I²C y revalida IMU.
8. Si OK estaba pulsado, solicita borrar WiFi guardado.
9. Crea mutex, cola y tarea FreeRTOS de red.
10. Inicializa telemetría y deja batería deshabilitada si no hay ADC.

## Máquina de estados de interfaz

```text
SPLASH
  ↓
MENU ──► SIGNOS_VITALES
  ├────► DIAGNOSTICO_MOVIMIENTO
  ├────► ESTADO_SISTEMA
  └────► MEDICACION

Estados prioritarios:
CONFIGURACION_WIFI
ALERTA_IMPACTO
ALERTA_SOS
```

Impacto, SOS y portal WiFi pueden interrumpir una vista normal. El firmware
conserva la vista previa para volver después de cerrar la alerta.

## Módulos

### `VitalWatch_FW_0_9_0.ino` / `VitalWatch_FW_0_9_1.ino`

Responsabilidad:

- orden de inicialización;
- orquestación de módulos;
- navegación general;
- prioridad de alertas;
- comandos de monitor serie.

Entradas: eventos de botones, sensores, control remoto y Serial.  
Salidas: cambios de modo, alertas, llamadas a telemetría/UI.  
Estado 0.9.0: `PARTIALLY_WORKING — F, U`.  
Estado 0.9.1: fuente completa `NOT_TESTED` en hardware — F, P.

### `Configuracion.h`

Responsabilidad:

- versión;
- pines;
- tiempos generales;
- objeto global TFT;
- estados de navegación;
- utilidades y recuperación I²C.

Dependencias: Arduino, Wire, SPI, Adafruit GFX/ST7735.  
Estado: `WORKING — F`.

### `Botones.h`

Responsabilidad:

- `INPUT_PULLUP` en GPIO 25/26/27;
- antirrebote;
- eventos corto/largo;
- gesto SOS.

Entrada: niveles GPIO.  
Salida: un evento pendiente.  
Estado: `WORKING — F, U`.

La cola actual admite un solo evento pendiente. Es suficiente para interacción
humana simple, no para alta concurrencia.

### `Sensor_Movimiento.h`

Responsabilidad:

- detectar un MPU compatible;
- configurar acelerómetro/giroscopio;
- leer 14 bytes por I²C;
- convertir a g, m/s² y rad/s;
- detectar un impacto experimental;
- reintentar si falla el bus.

Entrada: registros I²C.  
Salida: `movimientoActual`, picos y `impactoPendiente`.  
Estado del hardware: `WORKING — U`.  
Estado del algoritmo de caída: `EXPERIMENTAL — F`.

### `Sensor_Oxigeno.h`

Responsabilidad:

- iniciar MAX30102;
- detectar dedo;
- ajustar potencia LED;
- procesar FIFO en bloques limitados;
- detectar intervalos de pulso;
- calcular SpO₂ con algoritmo SparkFun;
- clasificar calidad y conservar último resultado.

Entrada: muestras IR/rojo del MAX30102.  
Salida: estado PPG y `ultimoResultadoVital`.  
Estado del hardware: `WORKING — U`.  
Estado biomédico: `EXPERIMENTAL — F`.

### `Configuracion_WiFi.h`

Responsabilidad:

- cargar/guardar/borrar SSID y contraseña en NVS;
- intentar red conocida;
- migrar una red compilada;
- crear AP, DNS y servidor web;
- recibir una nueva red desde el celular.

Entrada: NVS, configuración privada y formulario local.  
Salida: conexión WiFi disponible y cambios para la UI.  
Estado: `WORKING — F, U`.

El intento de una red dura hasta 12 s dentro de la tarea de red, no en el loop
principal.

### `Control_Remoto.h`

Responsabilidad:

- traducir vistas remotas a modos locales;
- guardar una orden pendiente sin tocar SPI desde la tarea de red;
- aplicar encendido lógico, sueño o cambio de vista desde `loop()`;
- reportar el estado realmente aplicado;
- permitir que alertas/botones despierten la TFT.

Entrada: `displayOn` y `displayView` de Supabase.  
Salida: modo/UI y confirmación pendiente.  
Estado: `PARTIALLY_WORKING — F, U`.

La versión 0.9.0 obtiene estas órdenes dentro de la sincronización de 30 s.
La fuente recuperada 0.9.1 implementa un sondeo separado de control cada 1 s.

### `Sincronizacion_Medicacion.h`

Responsabilidad:

- mantener hasta 8 medicamentos en RAM;
- protegerlos con mutex;
- recibir acciones por cola FreeRTOS;
- consultar/listar medicamentos;
- marcar tomado;
- transportar telemetría;
- enviar/reportar control TFT.

Entradas: cola, WiFi, Supabase.  
Salidas: lista local, estado de red y cambios de UI.  
Estado probado anteriormente: `WORKING — U`.  
Contenido 0.9.0: coincide con el commit `49df2d5` — F.  
Contenido 0.9.1: fuente recuperada, prueba física pendiente — F, P.

Intervalos del código 0.9.0:

- sincronización general: 30 s;
- reintento WiFi: 5 s;
- timeout HTTP: 7 s;
- pausa de tarea: 100 ms;
- stack de tarea: 16,384 bytes.

Intervalos del código 0.9.1:

- control de pantalla: 1 s;
- sincronización de medicamentos: 5 s;
- reintento WiFi: 5 s;
- timeout HTTP: 7 s;
- pausa de tarea: 100 ms;
- stack de tarea: 16,384 bytes.

La estructura `MedicamentoVitalWatch` de 0.9.0 guarda ID, nombre, dosis, hora y
estado. `0.9.1` agrega `fecha[11]`, consume `date` del JSON y la muestra en TFT.

### `Telemetria.h`

Responsabilidad:

- crear una fotografía pequeña de sensores;
- validar antigüedad de signos;
- leer batería opcional;
- encolar telemetría periódica;
- encolar caída/SOS inmediatamente.

Entradas: resultados PPG, movimiento y ADC opcional.  
Salida: `TelemetriaVitalWatch` hacia la cola de red.  
Estado: `PARTIALLY_WORKING — F, U`.

Intervalo: 30 s. Los signos deben tener menos de 60 s. Batería no válida se
envía nula.

### `Interfaz.h`

Responsabilidad:

- dibujar todas las pantallas;
- truncar/simplificar texto UTF-8 para la fuente clásica;
- mostrar barra, contenido, footer y alertas;
- reducir redibujos completos.

Entrada: estados globales de sensores/red/medicación.  
Salida: operaciones Adafruit GFX sobre TFT.  
Estado probado anteriormente: `WORKING — U`.  
Contenido 0.9.0: reproducible contra `49df2d5` — F.  
Contenido 0.9.1: fecha visible recuperada, prueba visual física pendiente — F, P.

### `LogoVitalWatch.h`

Responsabilidad: bitmaps RGB565 del corazón normal y tenue.  
Estado: `WORKING — F, U`.  
Precaución: archivo grande; no regenerar sin necesidad.

### `vitalwatch_config.example.h`

Responsabilidad: plantilla sin valores reales para URL/clave publicable,
código/token del dispositivo y WiFi opcional.  
Estado: `WORKING — F`.

`vitalwatch_config.h` es privado y está fuera de control de versiones.

## Concurrencia y propiedad de recursos

| Recurso | Propietario principal | Protección |
| --- | --- | --- |
| TFT/SPI | `loop()` | tarea de red solo deja órdenes pendientes |
| Lista de medicamentos | UI + tarea red | mutex |
| Acciones de red | productores del loop | cola FreeRTOS de 4 elementos |
| I²C | loop de sensores | secuencial; restablece configuración |
| Estado WiFi | tarea de red | banderas `volatile` simples |

No dibujar directamente desde la tarea de red. Rompería el acuerdo de un solo
propietario de SPI.

## Flujo de medicamentos

```text
Tarea red POST action=list
          ↓
Edge Function valida x-device-token
          ↓
JSON: control + medications
          ↓
guardarRespuestaMedicamentos()
          ├─ deja orden TFT pendiente
          └─ reemplaza lista bajo mutex
                       ↓
Interfaz marca pantalla sucia y redibuja
```

OK largo en Medicación encola `MARCAR_TOMADO`. La tarea envía
`action=set_status`, luego vuelve a guardar la lista recibida.

## Flujo de telemetría

```text
Telemetria.h
  ├─ BPM/SpO₂ solo si válidos y recientes
  ├─ batería solo si ADC válido
  ├─ impacto si IMU válida
  └─ evento opcional caída/SOS
             ↓ cola
Sincronizacion_Medicacion.h
             ↓ HTTPS
vitalwatch-device-telemetry
             ↓
sensor_readings + devices + device_events
```

## Riesgos arquitectónicos

- Cola de red de cuatro elementos puede llenarse si la red se bloquea.
- `setInsecure()` elimina validación del certificado del servidor.
- Varias banderas `volatile` no equivalen a sincronización completa entre
  núcleos; funcionan para este patrón simple, pero requieren cuidado.
- En 0.9.0, control y medicamentos comparten la frecuencia de 30 s.
- En 0.9.1, el sondeo 1 s/5 s aumenta tráfico y debe medirse en regresión.
- El portal puede mantener ocupada la tarea de red hasta recibir credenciales.
- Código en headers con muchos `static` es simple para un único `.ino`, pero no
  debe repartirse sin comprender la unidad de compilación.
