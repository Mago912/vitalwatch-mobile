# Cambios desde SYS 0.9.2 y BIO 0.6.0

## Regla de integración

Se creó una carpeta nueva. No se sobrescribieron `VitalWatch_FW_0_9_1` ni `VitalWatch_BIO_0_6_0`. Esto permite comparar, retroceder y volver a construir cualquiera de las tres ramas.

## Conservado de SYS 0.9.2

- Arranque, splash, menú y navegación completa de TFT.
- Control físico con izquierda, OK, derecha, pulsación larga y combinación SOS.
- Portal WiFi, guardado NVS, reconexión y borrado de red al arrancar con OK.
- Sincronización de medicación por HTTPS en tarea separada.
- Control remoto de encendido/vista y reconocimiento OK de alertas desde Supabase.
- Cola y transporte de eventos, SOS, posibles caídas y signos vitales.
- Comandos Serial de diagnóstico y pruebas manuales.

## Sustituido por BIO 0.6.0

- La adquisición MAX30102 anterior fue reemplazada por `PPGService`.
- La adquisición MPU anterior fue reemplazada por `MotionService`.
- HR y SpO2 ahora tienen resultados y estados de validez independientes.
- Se incorporaron sesión de medición, calidad y motivos de rechazo.
- Se incorporaron tiempos de muestra, huecos sospechosos, saturación y deadlines perdidos.
- El bus I²C se centralizó en `I2CBusService`, incluyendo recuperación manual.
- La detección se presenta como `posible impacto`; no se afirma caída clínicamente confirmada.

## Adaptaciones BIOSYS

- `SystemState` concentra las instancias únicas de TFT y del estado compartido.
- La vista Estado muestra BIOSYS, SYS, BIO y salud de sensores.
- Signos vitales muestra `--` cuando el dato no es válido y expone sesión/calidad.
- Movimiento muestra modelo de IMU, aceleración, giro, `dt` y saturación.
- La telemetría no convierte un dato biomédico inválido en un cero aparentemente válido.
- Se agregaron actualizaciones parciales de contenido para evitar limpiar toda la pantalla.
- La app 1.0.4 identifica `BIOSYS 1.0.1` y desglosa `SYS 0.9.2 + BIO 0.6.0`.
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

- Los umbrales PPG e IMU conservan BIO 0.6.0 para mantener trazabilidad; requieren prueba física.
- El temporizador base `micros()` del ESP32 clásico se desborda aproximadamente cada 71 minutos; la ampliación local a 64 bits no crea por sí sola un reloj monotónico eterno. Se recomienda corregirlo en BIO 0.6.1 con una prueba de larga duración.
- El MPU6500 puede aparecer como variante no validada aunque responda y entregue muestras. No se cambió esa clasificación sin evidencia.
- La partición disponible deja poco margen de flash (aprox. 12 %). La optimización debe hacerse con mapa de enlace y pruebas, no suprimiendo diagnósticos al azar.
