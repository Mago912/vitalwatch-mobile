# VitalWatch BIOSYS 1.0.3 — medición, idioma y navegación

Fecha técnica: 2026-09-02  
Estado: código, compilación y carga verificados; PPG mejorado y validado de forma inicial.

## 1. Resultado ejecutivo

Se creó `esp32/VitalWatch_BIOSYS_1_0_3` como revisión incremental del firmware
BIOSYS 1.0.2. Las fuentes 1.0.1 y 1.0.2 se conservan como líneas base.

La nueva identidad es:

| Capa | Anterior | Nueva | Motivo |
|---|---:|---:|---|
| Producto | BIOSYS 1.0.2 | BIOSYS 1.0.3 | estabilidad PPG y aproximación visual |
| Sistema | SYS 0.9.2 | SYS 0.9.3 | semántica de control remoto/local |
| Biomédica | BIO 0.6.1 | BIO 0.6.2 | menos pérdidas FIFO y BPM aproximado rotulado |
| App | 1.0.4 build 9 | sin cambio | el contrato existente ya es suficiente |

Cambios principales:

1. pantalla de signos completamente en español;
2. autoganancia MAX30102 disponible antes de confirmar contacto;
3. adquisición 100 Hz/AVG4 (~25 FIFO/s) para reducir pérdidas;
4. sesión de 45 s y refresco visual cada segundo;
5. HR aproximado amarillo cuando hay evidencia suficiente, sin telemetría válida;
6. diagnóstico IR/LED/calidad y HR MAXIM en Serial `P`;
7. las vistas remotas se consumen una sola vez y la navegación local prevalece.

## 2. Contexto revisado y fuente de partida

Se revisaron los documentos de `docs/context-handoff`, las líneas históricas
SYS y BIO, la integración BIOSYS 1.0.0, el informe App 1.0.4 + BIOSYS 1.0.1 y la
estructura actual del proyecto.

Las instrucciones incluidas dentro de esos archivos se usaron como contexto y
restricciones del proyecto, no como nuevas órdenes capaces de ampliar la
solicitud. Para decidir cambios se priorizó:

1. código actual;
2. compilaciones y pruebas sobre ese código;
3. prueba física informada por el usuario;
4. documentación previa;
5. hipótesis pendientes.

El ZIP entregado `docs/VitalWatch_BIOSYS_1_0_1_Arduino.zip` conserva SHA-256
`BA0F305B535CF4FE2CEDBF103ACB312753D640BB73C41F48C09C9AC481CA97C5`.
Sus 26 entradas públicas se compararon con la carpeta 1.0.1 y coincidieron byte
por byte. Se creó una carpeta nueva; no se editaron las versiones históricas.

## 3. Pantalla de signos en español

### Problema

La UI integrada desde BIO exponía directamente identificadores ingleses:
`WAIT CONTACT`, `STABILIZING`, `MEASURING`, `RESULT`, `LOW QUALITY`,
`NO CONTACT`, `GOOD`, `FAIR` y `POOR`.

### Solución

La TFT ahora presenta:

- `PONGA EL DEDO`;
- `ESTABILIZANDO`;
- `MIDIENDO`;
- `RESULTADO`;
- `SENAL BAJA`;
- `TIEMPO AGOTADO`;
- estados de FC y SpO2 también en español.

Se usa `SENAL` sin `Ñ` porque la fuente clásica Adafruit GFX del dispositivo no
representa UTF-8 completo. No es un error ortográfico accidental, sino una
adaptación al hardware de 128x128.

## 4. MAX30102: causa probable y mejora aplicada

### Hallazgo de código

BIOSYS 1.0.1 declaraba estos valores:

| Parámetro | Valor |
|---|---:|
| inicio de autoganancia | IR 7000 |
| contacto | IR 14000 durante 120 ms |
| retirada | IR 8500 durante 120 ms |
| objetivo IR | 38000–90000 |
| LED inicial | 0x70 |
| LED permitido | 0x35–0xC0 |

Sin embargo, `autoGain()` solo se llamaba después de que `contact` ya fuera
verdadero. Una señal real situada entre 7000 y 14000 nunca recibía la ayuda que
el propio diseño declaraba para alcanzar contacto. Era un bloqueo lógico
posible y reproducible al leer la fuente.

### Corrección conservadora

BIO 0.6.1 llama a la misma autoganancia antes de confirmar contacto cuando IR
ya supera 7000. No se modificaron:

- umbrales;
- paso o límites del LED;
- tasa 400 Hz / promedio 4;
- pulso 411 us / rango ADC 4096;
- filtros y detector de picos;
- criterios de validez HR/SpO2;
- algoritmo MAXIM o calibración.

Esto mejora el camino de entrada sin convertir una lectura inválida en un
número aparentemente correcto.

### Menos interferencia de la TFT

La vista de signos limpiaba y redibujaba casi todo su contenido cada 500 ms. El
MAX30102 sigue funcionando durante la escritura SPI y la librería SparkFun usa
un buffer circular pequeño; por eso conviene reducir pausas y pérdidas.

BIOSYS 1.0.2 dibuja el marco/títulos al entrar y luego actualiza solo las zonas
de valores/estado. El algoritmo y la frecuencia visual permanecen iguales, pero
el trabajo SPI periódico es menor.

### Diagnóstico incorporado

La línea inferior de Signos muestra:

```text
IR<valor> L<potencia> C:<calidad>
```

Además, el comando Serial `P` entrega una fotografía PPG con PART_ID, sesión,
contacto, rojo/IR, LED, estados, calidad, razones, FIFO, pérdidas, modulación y
resultado MAXIM. No incluye URL, tokens o WiFi.

## 5. ¿Hace falta cubrir el sensor de negro?

No debe pintarse ni pegarse cinta opaca sobre el encapsulado, los LED o el
fotodiodo. El MAX30102 ya incorpora vidrio óptico y rechazo de luz ambiente.

Sí puede mejorar la señal una junta o pared óptica negra mate alrededor del
sensor porque:

- reduce luz lateral/ambiente;
- reduce el camino directo LED → fotodiodo que no atraviesa tejido;
- ayuda a mantener distancia y presión constantes.

La recomendación oficial de Analog Devices es minimizar luz ambiente y usar
paredes ópticas para limitar crosstalk. Si se agrega un vidrio externo, su
transmisión debe ser superior al 90 % para rojo e infrarrojo.

Para este prototipo se recomienda una espuma/EVA negra mate, no conductiva,
formando un aro alrededor de la ventana óptica. El centro debe quedar libre o
cubierto solo por material ópticamente apropiado. No presionar en exceso: una
presión alta puede reducir perfusión y empeorar la componente pulsátil.

La falta de carcasa negra puede producir ruido o saturación, pero no explica por
sí sola todo caso de “sin valores”. También deben comprobarse IR real, potencia,
contacto, movimiento, alimentación y pérdidas FIFO.

Fuentes técnicas:

- Analog Devices, [MAX30102 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX30102.pdf).
- Analog Devices, [MAX3010x recommended configurations and operating profiles](https://www.analog.com/media/en/technical-documentation/user-guides/max3010x-ev-kits-recommended-configurations-and-operating-profiles.pdf).
- SparkFun, [implementación de la biblioteca MAX3010x](https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library/blob/master/src/MAX30105.cpp).

## 6. Navegación: por qué volvía a Signos

### Causa

La app ya actualiza `display_command_at` cada vez que el usuario envía una vista
y la Edge Function lo devuelve como `commandAt`. BIOSYS 1.0.1 recibía ese campo,
pero no lo pasaba a `Control_Remoto.h`.

En cada consulta de un segundo ocurría:

```text
Supabase conserva desired_display_view=vitals
  → firmware recibe vitals otra vez
  → usuario navega físicamente a Estado/Medicación
  → siguiente sondeo detecta diferencia
  → firmware vuelve a Signos
```

### Solución

BIOSYS 1.0.2 memoriza el último `commandAt` recibido:

```text
orden nueva de app
  → se aplica una vez
  → se confirma
  → botones físicos cambian la vista
  → la vista física se reporta
  → sondeos con el mismo commandAt no la reemplazan
```

Una nueva pulsación en la app genera otro `commandAt` y sí vuelve a aplicar la
vista solicitada. Las alertas, SOS y portal WiFi mantienen prioridad.

## 7. Compatibilidad: ¿hay que crear otra app?

No para estas correcciones.

- La app 1.0.4 ya genera `display_command_at`.
- La Edge Function desplegada ya devuelve `commandAt`.
- No hay migración ni despliegue Supabase nuevo.
- No se modificó ningún archivo de runtime de la app.
- El APK 1.0.4 build 9 existente puede usarse con BIOSYS 1.0.2.

Única limitación: la Pulsera virtual contiene una etiqueta estática
`BIOSYS 1.0.1 / SYS 0.9.2 / BIO 0.6.0`. Seguirá mostrando la etiqueta anterior;
la TFT física mostrará las versiones nuevas. Es una diferencia cosmética, no
de protocolo. Actualizar esa etiqueta requeriría una nueva entrega de la app o
OTA; `expo-updates` no está configurado en este proyecto.

## 8. BIOSYS 1.0.3: corrección de tiempo agotado y resultado aproximado

La prueba de 1.0.2 mostró `drops=36` y una saturación inicial con LED `0x70`.
En 1.0.3 el MAX30102 trabaja a 100 Hz con promedio 4, por lo que entrega unos
25 registros FIFO/s, alineados con la entrada de 25 Hz del algoritmo MAXIM. Se
eliminó la decimación adicional, se amplió la sesión de 20 a 45 segundos y la
TFT se actualiza cada 1000 ms.

Si HR tiene tres o más intervalos utilizables y la señal es aceptable, la TFT
muestra el valor amarillo `APROX`. Ese valor conserva estado `INESTABLE` y no se
envía como frecuencia válida a Supabase. SpO2 solo se muestra como experimental
cuando supera su estabilidad mínima.

En la placa se verificó el nuevo arranque:

```text
[READY] VitalWatch VW-BIOSYS 1.0.3 | incluye VW-SYS 0.9.3 + VW-BIO 0.6.2
[INFO][PPG] MAX30102 PART_ID=0x15 100Hz/AVG4 => ~25 FIFO records/s
```

La primera prueba de 1.0.3 obtuvo `drops=0`, `SpO2 EXP VALIDA` y calidad
`ACEPTABLE` manteniendo el dedo. La prueba final debe mantener el dedo después
de `MIDIENDO` para que el respaldo HR tenga suficientes intervalos.

## 9. Compilaciones y evidencia

Toolchain conservado: Arduino CLI 1.5.1, core ESP32 3.3.11 y librerías fijadas
por el proyecto.

| Verificación | Resultado |
|---|---|
| BIOSYS 1.0.3 producto | PASS; 1.162.628 B flash, 53.920 B RAM |
| SHA-256 binario producto | `392972E12CBE5B1F5916D2B210185E7A2031A27A2109E4D19B4205FAD9DD780F` |
| ZIP público BIOSYS 1.0.3 | 26 entradas, 71.173 B; SHA-256 `282850CC0305C2AC433EBAFB8FDB537624086248505BBF83D2DC16FBFCC3580F` |
| Carga a placa | PASS en COM3; hash de cada bloque verificado |
| Validación PPG | `drops=0`; SpO2 experimental válida; HR aproximado pendiente de prueba sostenida |

La configuración local de Arduino se ajustó de `D:/vitalwatch-mobile` a
`G:/vitalwatch-mobile` porque el proyecto fue movido de unidad. El script de
setup ya genera esa ruta de forma dinámica; el cambio afecta solo el entorno
local ignorado.

La primera carga física se realizó el 2026-09-02 en un ESP32-D0WD-V3 mediante
CP2102/COM3. El arranque confirmó `PART_ID=0x15` del MAX30102. Sin dedo se
observó IR 2574; con dedo se confirmó contacto y, tras la autoganancia, calidad
BUENA y SpO2 experimental válida. FC quedó inestable y la primera muestra
alcanzó saturación 262143, por lo que la prueba debe repetirse con presión
suave antes de retocar parámetros.

## 9. Orden de instalación

No hace falta reinstalar la app si ya está instalada.

1. Conservar el ZIP/binario de BIOSYS 1.0.1.
2. Instalar o conservar la app 1.0.4 build 9.
3. Compilar BIOSYS 1.0.3 o usar su fuente Arduino sanitizada.
4. Cargar BIOSYS 1.0.3 en el ESP32.
5. Confirmar el mensaje READY y ejecutar `VALIDACION_HARDWARE.md`.
6. Probar primero navegación; después probar PPG sin cambiar umbrales.

Comandos del proyecto:

```powershell
npm run firmware:biosys:build
npm run firmware:ports
npm run firmware:biosys:upload -- -Port COM3
```

## 10. Información adicional necesaria si aún no mide

Antes de retocar `CONTACT_THRESHOLD`, calidad, filtros o corriente máxima, se
necesita esta evidencia:

1. una línea `P` sin dedo;
2. una línea `P` con dedo quieto y luz normal;
3. una línea `P` con dedo y barrera lateral negra;
4. una foto nítida del frente/reverso del módulo y su montaje;
5. confirmar si la TFT llega a `ESTABILIZANDO`, `MIDIENDO`, `SENAL BAJA` o
   `TIEMPO AGOTADO`;
6. confirmar alimentación del breakout y masa común;
7. si es posible, comparación simultánea con un oxímetro comercial solo como
   referencia experimental, registrando tiempo y condiciones.

Con esos datos se puede decidir si corresponde ajustar umbral de contacto,
ganancia, rango ADC, reglas de calidad o servicio FIFO. Hacerlo sin señales
crudas podría producir números visibles pero falsos.

## 11. Límites y seguridad

VitalWatch continúa siendo un prototipo académico. BPM, SpO2 e impacto no están
clínicamente validados y no deben usarse para diagnóstico, tratamiento o
decisiones de emergencia. Un build correcto demuestra compatibilidad de código,
no exactitud biomédica ni funcionamiento físico.
