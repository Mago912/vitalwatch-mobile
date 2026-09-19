# Modulos — VitalWatch VW-BIO 0.6.0

| Archivo | Responsabilidad | No realiza |
|---|---|---|
| `VitalWatch_BIO_0_6_0.ino` | orquestacion cooperativa | matematica de sensores |
| `Configuracion.h` | constantes, tipos y versionado dual | estado mutable de drivers |
| `SystemState.*` | estado y latencias globales de aplicacion | adquisicion |
| `I2CBusService.*` | propietario del bus y recuperacion | algoritmos |
| `Sensor_Oxigeno.*` | MAX30102, timing, peaks, HR, SpO2 y calidad | dibujo TFT |
| `Sensor_Movimiento.*` | MPU, dt/jitter, saturacion y posible impacto | alerta visual |
| `Botones.*` | debounce, corto/largo y held-at-boot | navegacion |
| `Interfaz.*` | TFT y dirty rectangles | lectura directa de sensores |
| `BioResearch.*` | CSV no bloqueante de PPG/IMU/profiler | decision biomédica |
| `BioReplay.*` | entrada de dataset por Serial al pipeline real | algoritmo alternativo |
| `LogoVitalWatch.h` | bitmap RGB565 | logica |

Los servicios publican estructuras semanticas. La interfaz consume resultados
y el orquestador decide cambios de pantalla; los sensores no escriben modos UI.
