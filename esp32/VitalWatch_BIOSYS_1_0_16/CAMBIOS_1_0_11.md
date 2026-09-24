# Cambios BIOSYS 1.0.11

## Falsas caidas en reposo

La version 1.0.10 podia iniciar una posible caida por una sola muestra de
aceleracion igual o superior a `1,70 g`. Si el dispositivo estaba quieto
despues de ese pico aislado, la verificacion posterior interpretaba el reposo
como inmovilidad posterior a una caida.

La version 1.0.11 agrega una etapa de armado antes del impacto:

- exige al menos tres muestras consecutivas de movimiento;
- conserva ese armado durante un segundo;
- una muestra de impacto no puede armarse a si misma;
- un impacto extremo solo evita el armado cuando acelerometro y giroscopio
  aportan evidencia al mismo tiempo;
- rechaza valores no finitos y registra los picos aislados ignorados.

La verificacion de inmovilidad durante tres segundos, la cuenta regresiva de
diez segundos y la cancelacion con OK se mantienen sin cambios.

## Signos vitales

No se relajaron los criterios de calidad del MAX30102. `FC INESTABLE`,
`SENAL BAJA` y `TIEMPO AGOTADO` siguen evitando que una lectura dudosa se
publique como valida. La exactitud necesita comparacion posterior con un
oximetro o una medicion manual confiable.

