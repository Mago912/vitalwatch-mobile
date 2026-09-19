# Control remoto y navegación local de la TFT

## Versiones compatibles

- App: VitalWatch 1.0.4 build 9.
- Firmware recomendado: BIOSYS 1.0.2 / SYS 0.9.3 / BIO 0.6.1.
- Backend: contrato ya desplegado por la entrega App 1.0.4 + BIOSYS 1.0.1.

La app permite solicitar menú, signos vitales, movimiento, estado o medicación,
además de encender o dormir el controlador ST7735.

## Significado de una orden de vista

La app guarda `desired_display_view` y actualiza `display_command_at`. La Edge
Function entrega ambos como `displayView` y `commandAt`.

BIOSYS 1.0.2 aplica una vista solo cuando `commandAt` es nuevo. Después de esa
aplicación, los botones físicos pueden cambiar a otra vista y esa selección se
mantiene. La consulta de control que ocurre aproximadamente cada segundo ya no
repite indefinidamente la orden anterior.

Ejemplo:

```text
App solicita Signos (commandAt A)
  → BIOSYS abre Signos y confirma
  → botón físico abre Estado
  → BIOSYS reporta Estado
  → Supabase sigue conservando Signos + A
  → BIOSYS reconoce A como consumido y permanece en Estado
```

Si la app vuelve a pulsar Signos, genera `commandAt B`; BIOSYS aplica la nueva
orden una vez.

## Encendido y seguridad

El estado encendido/apagado sigue convergiendo con la orden remota. Esto permite
que una pantalla solicitada como apagada, pero despertada temporalmente por una
alerta o botón, vuelva a apagarse.

Prioridades que no cambian:

1. SOS;
2. posible impacto;
3. portal WiFi;
4. botones físicos;
5. orden remota normal.

El OK remoto solo cierra una alerta activa. No se usa para navegar una vista
normal a distancia.

## Estado solicitado y confirmado en la app

Después de navegar físicamente puede ser correcto ver:

```text
Solicitado: Signos vitales
Confirmado por BIOSYS: Estado del equipo
```

`Solicitado` conserva la última orden de la app; `Confirmado` representa la
vista física actual. La diferencia demuestra que la selección local prevaleció.

## Límite eléctrico del backlight

Si el pin `LED` de la TFT está conectado directamente a 3V3, el firmware puede
dormir el controlador pero no cortar la iluminación. Para apagarla realmente se
necesita un MOSFET o load switch diseñado para la corriente del módulo. Nunca
alimentar el LED completo desde un GPIO.

## Prueba de aceptación

1. Seleccionar Signos desde la app y esperar confirmación.
2. Cambiar físicamente a Estado y esperar al menos 10 segundos.
3. Confirmar que la TFT no vuelve a Signos.
4. Repetir con Medicación.
5. Enviar una vista distinta desde la app; debe aplicarse una sola vez.
6. Cambiar otra vez con botones y verificar que permanece.
7. Probar Encender/Apagar.
8. Probar una alerta controlada y su cierre con OK físico y remoto.

No se requiere una nueva APK ni una migración Supabase para esta corrección. El
detalle técnico está en
`docs/VITALWATCH_BIOSYS_1_0_2_MEDICION_Y_NAVEGACION.md`.

