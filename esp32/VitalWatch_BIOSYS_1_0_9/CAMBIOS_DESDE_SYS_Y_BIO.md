# Cambios de BIOSYS 1.0.3 a BIOSYS 1.0.4

## Correcciones de esta revisión

- `SYS 0.9.4` conserva el consumo de cada `commandAt` de vista una sola vez y
  alinea la telemetria con una cadencia de 5 s. Una vista elegida
  con botones físicos ya no es reemplazada cada segundo por una orden antigua.
- Los cambios de vista locales se reportan a Supabase como estado confirmado.
- `BIO 0.6.3` conserva esa autoganancia y añade una ventana de mediana de 5 s
  para HR, con un modo visual `APROX` prudente
  cuando existen tres o más intervalos utilizables, sin marcarlo como válido en
  telemetría.
- Una medición HR/SpO2 inválida reemplaza inmediatamente la fotografía retenida
  y limpia la ventana de BPM. Un fallo o reinicio del MAX30102 tampoco conserva
  resultados de una sesión anterior.
- El MAX30102 pasa de 400/AVG4 (~100 registros FIFO/s) a 100/AVG4 (~25
  registros FIFO/s), alineado con los 25 Hz que necesita el algoritmo MAXIM.
- La sesión pasa de 20 a 45 segundos y la pantalla actualiza signos cada
  segundo, dando más tiempo y menos pérdidas al llenar ventanas.
- El LED inicial baja de `0x70` a `0x50` por la saturación observada en la
  primera prueba física; la autoganancia puede subirlo si hace falta.
- La pantalla de signos muestra todos los estados en español y añade IR, LED y
  calidad abreviada.
- El refresco PPG actualiza regiones dinámicas y reduce el trabajo SPI.
- El comando Serial `P` aporta diagnóstico PPG sin mostrar credenciales.
- La app 1.0.4 conserva el contrato y el backend; su fuente solo cambia el
  sondeo remoto a 5 s y la retención visual de las tarjetas de Inicio.

## Bases conservadas

## Regla de integración

Se creó una carpeta nueva. No se sobrescribieron `VitalWatch_FW_0_9_1` ni `VitalWatch_BIO_0_6_0`. Esto permite comparar, retroceder y volver a construir cualquiera de las tres ramas.

### Conservado de SYS 0.9.2

- Arranque, splash, menú y navegación completa de TFT.
- Control físico con izquierda, OK, derecha, pulsación larga y combinación SOS.
- Portal WiFi, guardado NVS, reconexión y borrado de red al arrancar con OK.
- Sincronización de medicación por HTTPS en tarea separada.
- Control remoto de encendido/vista y reconocimiento OK de alertas desde Supabase.
- Cola y transporte de eventos, SOS, posibles caídas y signos vitales.
- Comandos Serial de diagnóstico y pruebas manuales.

### Sustituido originalmente por BIO 0.6.0

- La adquisición MAX30102 anterior fue reemplazada por `PPGService`.
- La adquisición MPU anterior fue reemplazada por `MotionService`.
- HR y SpO2 ahora tienen resultados y estados de validez independientes.
- Se incorporaron sesión de medición, calidad y motivos de rechazo.
- Se incorporaron tiempos de muestra, huecos sospechosos, saturación y deadlines perdidos.
- El bus I²C se centralizó en `I2CBusService`, incluyendo recuperación manual.
- La detección se presenta como `posible impacto`; no se afirma caída clínicamente confirmada.

### Adaptaciones BIOSYS heredadas

- `SystemState` concentra las instancias únicas de TFT y del estado compartido.
- La vista Estado muestra BIOSYS, SYS, BIO y salud de sensores.
- Signos vitales muestra `--` cuando el dato no es válido y expone sesión/calidad.
- Movimiento muestra modelo de IMU, aceleración, giro, `dt` y saturación.
- La telemetría no convierte un dato biomédico inválido en un cero aparentemente válido.
- Se agregaron actualizaciones parciales de contenido para evitar limpiar toda la pantalla.
- La app 1.0.4 sigue siendo compatible; la actualización de signos no exige
  migración de esquema ni una instalación para compilar el firmware.
- La alerta visible se reporta explícitamente; al cerrarla física o remotamente, la app deja de mostrar caída.

## No integrado deliberadamente

- La interfaz TFT autónoma de BIO: duplicaría la máquina visual de SYS.
- Los botones autónomos de BIO: omiten parte del contrato SOS de SYS.
- `BioReplay` dentro de BIOSYS: es una herramienta de laboratorio y permanece en BIO 0.6.0.
- Dos instancias simultáneas de MAX30102 o MPU: competirían por el bus y duplicarían el procesamiento.
- Dos objetos TFT o estados globales: provocarían divergencia entre módulos.

Nada de lo anterior fue borrado de sus carpetas originales; simplemente no forma parte del binario unificado.

## Eliminaciones y recortes

No se eliminó una función crítica del producto. Dentro de BIOSYS se evita compilar la implementación antigua de sensores SYS porque fue reemplazada, y el modo de investigación queda desactivado por defecto. El bitmap del logo se conserva porque forma parte del splash vigente, aunque es un candidato no crítico para optimización futura.

## Riesgos conocidos que no se retocaron

- Los umbrales PPG e IMU conservan los valores de BIO 0.6.0 para mantener
  trazabilidad; BIO 0.6.3 cambia cadencia de publicación y presentación
  aproximada, por lo que requiere nueva prueba física.
- El temporizador base `micros()` del ESP32 clásico se desborda aproximadamente cada 71 minutos; la ampliación local a 64 bits no crea por sí sola un reloj monotónico eterno. Se recomienda corregirlo en BIO 0.6.1 con una prueba de larga duración.
- El MPU6500 puede aparecer como variante no validada aunque responda y entregue muestras. No se cambió esa clasificación sin evidencia.
- La partición disponible deja poco margen de flash (aprox. 12 %). La optimización debe hacerse con mapa de enlace y pruebas, no suprimiendo diagnósticos al azar.
