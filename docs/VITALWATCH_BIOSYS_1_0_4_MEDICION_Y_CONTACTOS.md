# VitalWatch BIOSYS 1.0.4 — medición a 5 segundos y diseño de contactos

## Resultado de la entrega

Se creó una nueva fuente **BIOSYS 1.0.4** a partir de la versión 1.0.3
instalada/probada. También se ajustó la fuente de la app para consultar la
telemetría cada 5 segundos y actualizar las tarjetas de signos de la pantalla
principal en fotografías de 5 segundos. **No se flasheó el ESP32, no se instaló
un APK y no se alteró el dispositivo físico en esta entrega.**

La app sigue siendo compatible con el contrato de telemetría existente; no se
requiere crear otra aplicación para probar el firmware. Para que el nuevo
intervalo sea visible con datos reales, sí habrá que cargar el binario 1.0.4 en
una próxima sesión y verificar la configuración de red.
La APK build 9 ya instalada no cambia por editar el repositorio: para llevar el
polling de 5 s al teléfono habrá que generar una actualización de JavaScript
por Expo Updates (si el proyecto se configura para ello) o una nueva APK; eso
queda deliberadamente fuera de esta sesión.

## Cambios de versión

| Capa | Anterior | Nueva | Propósito |
|---|---:|---:|---|
| Producto | BIOSYS 1.0.3 | BIOSYS 1.0.4 | publicación coherente cada 5 s |
| Sistema | SYS 0.9.3 | SYS 0.9.4 | telemetría cada 5 s |
| Biomédica | BIO 0.6.2 | BIO 0.6.3 | mediana temporal y retención |
| App fuente | 1.0.4 build 9 | fuente ajustada | polling 5 s + retención visual |

## Cómo se corrige el salto de BPM

El MAX30102 continúa adquiriendo sin pausas a 100 Hz con promedio FIFO 4
(aproximadamente 25 registros útiles por segundo). No se baja la tasa de
muestreo ni se inventan valores. El algoritmo interno sigue calculando cada
muestra, pero la salida pública aplica estas reglas:

- se conserva una ventana de hasta cinco estimaciones de HR distintas;
- cada 5 segundos se publica la mediana, menos sensible a picos aislados;
- el resultado se mantiene entre publicaciones (sample-and-hold);
- un valor aproximado sigue marcado `INESTABLE/APROX` y nunca se publica como
  frecuencia telemétrica válida;
- el último SpO2 experimental válido se conserva hasta la siguiente fotografía;
- al retirar el dedo se limpian las ventanas y se vuelve a `SIN DEDO`.

Esto debe reducir saltos como 85 → 125 → 155 → 185 lpm, pero no sustituye la
validación clínica. Si la señal óptica está saturada, hay movimiento o el dedo
no cubre correctamente el sensor, el sistema seguirá mostrando señal baja o
sin datos.

## Cambios de la app (solo signos en Inicio)

`providers/vitalwatch-provider.tsx` consulta la instantánea remota cada 5 s.
`app/(tabs)/index.tsx` mantiene una referencia a la lectura más reciente y
actualiza las tarjetas de ritmo, oxígeno y la tendencia de pulso una vez cada
5 s. Estado, batería, medicación y navegación no se sustituyen por esta
retención visual.

La comprobación de TypeScript y ESLint terminó correctamente:

```text
npx tsc --noEmit       PASS
npm run lint           PASS
```

## Nuevo apartado de contactos (solo diseño)

El diseño pendiente se documenta en
[`CONTACTOS_ALERTA_PENDIENTE.md`](CONTACTOS_ALERTA_PENDIENTE.md). En esta
entrega no se agregó pantalla, migración, proveedor SMS, permiso de contactos
ni envío real. Allí quedan definidos el modelo `contacts`, el flujo de OK, la
idempotencia y la decisión pendiente entre push, SMS o llamada.

## Artefactos creados

- Fuente Arduino: `esp32/VitalWatch_BIOSYS_1_0_4/`.
- Paquete público: `docs/VitalWatch_BIOSYS_1_0_4_Arduino.zip`.
- Binario producto compilado (sin cargar):
  `.arduino/build/biosys-1.0.4/VitalWatch_BIOSYS_1_0_4.ino.bin`.
- Binario investigación compilado (sin cargar):
  `.arduino/build/biosys-1.0.4-research/VitalWatch_BIOSYS_1_0_4.ino.bin`.

Hash SHA-256 del binario producto: `B394C15D321C3609ED72D78242E295ADC22E751FA125E3BC4C4640769381B474`.
Hash SHA-256 del ZIP público (26 entradas, sin configuración privada):
`46063624300BD07CEDA83A4CD9A556075C7EF38AA8344458D8F73707BE06251A`.

## Próximo paso seguro

Antes de cargar, probar primero en banco: sin dedo, dedo quieto durante al
menos 30 s y luego movimiento/luz lateral bloqueada con material negro mate sin
tapar los LED. Registrar por Serial `P` los valores IR, calidad, pérdidas y
estado. Solo después de esa verificación corresponde ejecutar el comando de
upload indicado en el README de la fuente.
