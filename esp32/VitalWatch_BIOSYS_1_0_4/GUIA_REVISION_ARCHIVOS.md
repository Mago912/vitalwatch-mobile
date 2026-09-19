# Guía de revisión archivo por archivo

## Orden recomendado

1. `Configuracion.h`: comprobar pines, intervalos, versiones y contratos comunes.
2. `SystemState.h/.cpp`: confirmar que existe una sola TFT y un solo estado global.
3. `VitalWatch_BIOSYS_1_0_1.ino`: seguir arranque y ciclo cooperativo.
4. `I2CBusService.h/.cpp`: revisar el bus común antes de los sensores.
5. `Sensor_Oxigeno.h/.cpp`: revisar tipos, sesiones, calidad, HR y SpO2.
6. `Sensor_Movimiento.h/.cpp`: revisar unidades, muestreo, diagnóstico e impacto.
7. `Interfaz.h`: revisar lo que ve la persona y cómo se representan datos inválidos.
8. `Telemetria.h`: comprobar qué se publica y bajo qué condiciones.
9. `Botones.h`, `Control_Remoto.h`: revisar entradas locales y remotas.
10. `Configuracion_WiFi.h`, `Sincronizacion_Medicacion.h`: revisar red y tareas.
11. `BioResearch.h/.cpp`: revisar solo si se usará el perfil de laboratorio.
12. `LogoVitalWatch.h`: recurso visual generado, no lógica.

## Clasificación de criticidad

| Archivo | Criticidad | Motivo |
|---|---|---|
| `Configuracion.h` | Alta | Pines, frecuencias, versiones y estado público |
| `SystemState.*` | Alta | Propiedad única de periféricos y estado |
| `.ino` | Alta | Orden temporal y coordinación global |
| `I2CBusService.*` | Alta | Acceso físico compartido |
| `Sensor_Oxigeno.*` | Biomédica alta | Adquisición y validez PPG |
| `Sensor_Movimiento.*` | Biomédica alta | IMU y posible impacto |
| `Telemetria.h` | Alta | Datos transmitidos y eventos |
| `Sincronizacion_Medicacion.h` | Alta | Medicación, HTTPS y tarea de red |
| `Botones.h` | Alta | Control local y SOS |
| `Interfaz.h` | Media/alta | Interpretación visual de estado y mediciones |
| `Control_Remoto.h` | Media/alta | Órdenes desde la app |
| `Configuracion_WiFi.h` | Media/alta | Acceso de red y persistencia |
| `BioResearch.*` | Baja en producto | Solo instrumentación opcional |
| `LogoVitalWatch.h` | Baja | Bitmap del splash |

## Qué comprobar al editar

- Un cambio de umbral, filtro, ventana, unidad o criterio válido/inválido incrementa la versión BIO.
- Un cambio de WiFi, API, medicación, navegación, botones o SOS incrementa la versión SYS.
- Una entrega que combine nuevas versiones cambia BIOSYS y conserva ambas versiones componentes visibles.
- Nunca almacenar claves reales en `vitalwatch_config.example.h`, documentación o ZIP.
- Compilar los perfiles normal e investigación después de tocar estructuras compartidas.
- En datos biomédicos, preferir estado explícito y `--` a representar error como `0`.
- Probar durante más tiempo que los timeouts y lockouts modificados.

## Archivos privados y generados

- `vitalwatch_config.h`: privado, contiene identidad y acceso; no compartir.
- `build/` y `.arduino/build/`: generados; no son fuente.
- `.bin`, `.elf`, `.map`: resultados de compilación; sirven para cargar o auditar tamaño, no para revisar la lógica.
