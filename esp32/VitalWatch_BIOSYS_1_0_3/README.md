# VitalWatch BIOSYS 1.0.3

Firmware corregido para la pulsera VitalWatch:

- producto: `VW-BIOSYS 1.0.3`;
- sistema conectado: `VW-SYS 0.9.3`;
- capa biomédica: `VW-BIO 0.6.2`;
- app compatible: VitalWatch `1.0.4` build 9.

La carpeta `VitalWatch_BIOSYS_1_0_1` y su ZIP permanecen intactos como línea
base instalada y probada. Esta revisión es incremental y no duplica sensores,
pantalla ni estado global.

El nuevo paquete Arduino sanitizado está en
`docs/VitalWatch_BIOSYS_1_0_3_Arduino.zip`; su hash se registra en el informe
raíz.

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
Durante la medición solo se actualizan las regiones dinámicas cada segundo,
dejando más margen al servicio del FIFO PPG.

Si hay al menos tres intervalos utilizables y la señal es aceptable, HR puede
mostrarse en amarillo como `APROX`; no se publica como frecuencia válida.

El comando Serial `P` imprime un diagnóstico PPG puntual y seguro: estado,
PART_ID, contacto, rojo/IR, LED, calidad, FIFO, pérdidas y resultado MAXIM. No
imprime credenciales.

### Navegación local

Cada orden remota de vista usa el `commandAt` que la app 1.0.4 y el backend ya
envían. La vista se aplica una sola vez. Después, una selección realizada con
los botones físicos permanece visible y se reporta a Supabase; el sondeo de un
segundo no vuelve a imponer una orden antigua.

Encendido/apagado mantiene semántica convergente. Si una alerta despierta una
pantalla solicitada como apagada, la orden de energía puede volver a apagarla.

## Compatibilidad con la app

No se cambió el esquema Supabase, la Edge Function ni el código de la app. La
APK 1.0.4 build 9 existente es funcionalmente compatible y no necesita ser
recompilada o reinstalada si ya está instalada.

La app 1.0.4 tiene una etiqueta estática que dice `BIOSYS 1.0.1`; seguirá
mostrando ese texto aunque el firmware físico sea 1.0.3. Es una diferencia
cosmética. Corregir esa etiqueta sí requeriría una entrega posterior de la app
o un mecanismo OTA que este proyecto no tiene configurado.

## Compilar

Desde la raíz del proyecto:

```powershell
npm run firmware:biosys:build
npm run firmware:biosys:research
```

Resultados verificados el 2026-09-02:

| Perfil | Flash | RAM global | Resultado |
|---|---:|---:|---|
| Producto | 1.162.628 B (88 %) | 53.920 B (16 %) | PASS |

Binario de producto:
`.arduino/build/biosys-1.0.3/VitalWatch_BIOSYS_1_0_3.ino.bin`.

SHA-256: `392972E12CBE5B1F5916D2B210185E7A2031A27A2109E4D19B4205FAD9DD780F`.

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
3. Esperar `ESTABILIZANDO` y luego `MIDIENDO`; una lectura válida puede tardar
   varios segundos y nunca se reemplaza por un número inventado.
4. Repetir bloqueando solamente la luz lateral con una espuma o junta negra
   mate; no tapar con cinta los LED ni el fotodiodo.
5. Si continúa en `PONGA EL DEDO` o `SENAL BAJA`, abrir Serial a 115200, enviar
   `P` y conservar una línea sin dedo, otra con dedo y otra con luz lateral
   bloqueada.

Los valores deben seguir tratándose como experimentales. VitalWatch no es un
dispositivo médico y no posee validación clínica.
