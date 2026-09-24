# VitalWatch BIOSYS 1.0.11 - filtro de falsas caidas

Firmware corregido para la pulsera VitalWatch:

- producto: `VW-BIOSYS 1.0.11`;
- sistema conectado: `VW-SYS 0.9.9`;
- capa biomédica: `VW-BIO 0.6.5`;
- app compatible: VitalWatch `1.0.12`.

La carpeta `VitalWatch_BIOSYS_1_0_1` y su ZIP permanecen intactos como línea
base instalada y probada. Esta revisión es incremental y no duplica sensores,
pantalla ni estado global.

Las versiones 1.0.9 y 1.0.10 quedan intactas como respaldo. Los cambios propios
de esta entrega estan resumidos en `CAMBIOS_1_0_11.md`; los documentos
anteriores permanecen como historial.

## Boton SOS fisico

El boton SOS se conecta entre `GPIO14` y `GND` y usa `INPUT_PULLUP`. Una
pulsacion corta y firme activa la alerta; no es necesario mantenerlo apretado
durante 2,5 segundos. El firmware aplica antirrebote, ignora pulsaciones
menores a 80 ms y bloquea nuevas alertas durante 5 segundos.

## Diagnóstico del IMU

BIOSYS 1.0.11 conserva el funcionamiento de 1.0.10 y evita que una sola
muestra alta del acelerometro inicie una falsa caida cuando el equipo estaba
quieto. El detector exige movimiento previo sostenido o evidencia extrema
combinada del acelerometro y el giroscopio.

BIOSYS 1.0.10 conserva el funcionamiento de 1.0.9 y agrega continuidad PPG,
offsets del giroscopio e instrumentacion de laboratorio reproducible.

BIOSYS 1.0.9 conserva el funcionamiento de 1.0.8 y agrega el botón SOS físico;
la instrumentación I2C del IMU y el diagnóstico de 1.0.8 permanecen activos.

BIOSYS 1.0.8 conserva el funcionamiento de 1.0.7 y amplía únicamente la
observabilidad I2C del MPU. En el primer fallo de arranque y al ejecutar OK
largo registra los retornos de `0x68/0x69`, la lectura de `WHO_AM_I`, un
escaneo `0x01..0x7E` y el estado lógico de SDA/SCL. Los reintentos periódicos
siguen siendo livianos para no interferir con PPG, interfaz o red.

## Mensajeria

`MENSAJERIA` es la primera opcion del menu y contiene `MENSAJE` y `LLAMADA`.
La pulsera sincroniza como maximo ocho contactos activos y recibe solamente
`contact_id + display_name`. El telefono nunca se guarda ni se muestra en el
ESP32. Las solicitudes se envian desde la tarea de red existente y Supabase
responde `ACEPTADO`; ese estado no afirma que un SMS o una llamada ya hayan
ocurrido. OK elige/confirma y OK largo vuelve al paso anterior.

## Caidas y funcionamiento sin Internet

Tres muestras de movimiento arman el detector durante un segundo. Luego un
impacto coherente inicia una verificacion de inmovilidad y una cuenta regresiva
de 10 segundos. OK fisico o remoto cancela el aviso durante esa cuenta. Si no
hay respuesta, al finalizar los 10 segundos se confirma y envia la caida sin
exigir OK; despues OK solo cierra el aviso local de la TFT. Caidas y SOS
pendientes se guardan en NVS y se reintentan al recuperar Internet,
conservando su hora cuando NTP estaba disponible.

## Qué corrige

### Pantalla de signos en español

Los estados visibles del MAX30102 ahora dicen `PONGA EL DEDO`,
`ESTABILIZANDO`, `MIDIENDO`, `RESULTADO`, `SENAL BAJA` y `TIEMPO AGOTADO`.
Los estados de frecuencia cardíaca, SpO2 y calidad también se presentan en
español ASCII, compatible con la fuente clásica de la TFT.

La última línea muestra diagnóstico compacto:

```text
IR<valor> L<LED> C:<calidad>
```

Esto permite distinguir falta de contacto, señal débil y saturación sin
inventar un valor fisiológico.

### Adquisición MAX30102

Se conservan los umbrales, ventanas, corriente máxima y algoritmo MAXIM de
BIOSYS 1.0.2. La adquisición pasa a 100 Hz/AVG4 (~25 registros FIFO/s), que es
la frecuencia útil esperada por MAXIM, para reducir pérdidas del buffer. El
cambio también corrige el orden de la autoganancia: antes solo
podía ajustarse después de declarar contacto; ahora puede ayudar cuando una
señal real supera `7000` IR pero aún no alcanza el umbral de contacto `14000`.

También se redujo el borrado periódico de la TFT y se amplió la sesión a 45 s.
La adquisición continúa sin bloqueo, pero la salida visible se actualiza cada
5 segundos. En cada publicación se usa la mediana de hasta cinco estimaciones
distintas de HR y se conserva el ultimo SpO2 experimental válido; así se evita
que un pico aislado salte de 85 a 185 lpm en la pantalla.

Si hay al menos tres intervalos utilizables y la señal es aceptable, HR puede
mostrarse en amarillo como `APROX`; no se publica como frecuencia válida.

El comando Serial `P` imprime un diagnóstico PPG puntual y seguro: estado,
PART_ID, contacto, rojo/IR, LED, calidad, FIFO, pérdidas y resultado MAXIM. No
imprime credenciales.

### Navegación local

Cada orden remota de vista usa el `commandAt` que la app y el backend ya
envían. La vista se aplica una sola vez. Después, una selección realizada con
los botones físicos permanece visible y se reporta a Supabase; el sondeo de un
segundo no vuelve a imponer una orden antigua.

Encendido/apagado mantiene semántica convergente. Si una alerta despierta una
pantalla solicitada como apagada, la orden de energía puede volver a apagarla.

## Compatibilidad con la app

La app 1.0.11 y las Edge Functions comparten el estado `Pendiente/Tomado`. Cuando
Supabase informa `reminderDue`, la TFT abre la medicacion correspondiente y
muestra `HORA DE TOMAR`. La app mantiene la telemetria cada 5 segundos sin
bloquear el formulario de creacion de medicamentos.

## Compilar

Desde la raíz del proyecto:

```powershell
npm run firmware:biosys:build
npm run firmware:biosys:research
```

Resultado verificado el 2026-09-14:

| Perfil | Flash | RAM global | Resultado |
|---|---:|---:|---|
| Producto | 1.169.864 B (89 %) | 54.456 B (16 %) | PASS |

Binario de producto:
`.arduino/build/biosys-1.0.6/VitalWatch_BIOSYS_1_0_6.ino.bin`.

## Cargar

```powershell
npm run firmware:ports
npm run firmware:biosys:upload -- -Port COM3
```

Sustituir `COM3` si la placa aparece en otro puerto. La carga requiere el
`vitalwatch_config.h` privado local. Ese archivo está excluido del ZIP público.

## Probar el MAX30102

1. Abrir Signos y anotar IR sin dedo.
2. Apoyar la yema directamente, sin moverla ni presionar en exceso.
3. Esperar `ESTABILIZANDO` y luego `MIDIENDO`; la primera fotografia visible
   puede tardar unos 5 segundos adicionales y nunca se reemplaza por un numero
   inventado.
4. Repetir bloqueando solamente la luz lateral con una espuma o junta negra
   mate; no tapar con cinta los LED ni el fotodiodo.
5. Si continúa en `PONGA EL DEDO` o `SENAL BAJA`, abrir Serial a 115200, enviar
   `P` y conservar una línea sin dedo, otra con dedo y otra con luz lateral
   bloqueada.

Los valores deben seguir tratándose como experimentales. VitalWatch no es un
dispositivo médico y no posee validación clínica.
