# BIOSYS 1.0.21 - protección ante conteos FIFO corruptos

## Problema reproducido

La captura física `antebrazo-max30102-aislado-toma-1` entregó 3.118 filas
completas, pero incluyó devoluciones imposibles de `sensor.check()`: 125 y
valores cercanos a 65.535. El FIFO del MAX30102 usa punteros de cinco bits y
solo puede representar una diferencia entre 0 y 31.

La biblioteca SparkFun resta los punteros sin validar su rango. Si una lectura
I2C transitoria corrompe uno de ellos, el resultado negativo puede convertirse
en un entero sin signo enorme. BIOSYS 1.0.20 lo sumaba a la secuencia y al
tiempo fisiológico, activando `TIMING_INVALID` aunque no hubieran transcurrido
miles de segundos reales.

## Corrección

- `PpgFifoGuard.h` define el límite físico de 31 muestras.
- Los conteos mayores se rechazan antes de modificar secuencia o pérdidas.
- El evento incrementa el diagnóstico I2C, invalida temporalmente la ventana y
  limpia el FIFO para recuperar la adquisición.
- Los lotes válidos conservan el cálculo anterior de pérdidas comprobables.

No se modifican los umbrales de FC, la fusión rojo/IR, la SpO2 experimental,
la autoganancia ni la detección de caídas.

## Prueba de regresión

`esp32/tests/ppg_fifo_guard_test/ppg_fifo_guard_test.ino` comprueba los límites
0, 31 y 32, además de los valores reales 125, 65440 y 65535. También exige que
un lote válido de 31/3 conserve 28 pérdidas y que los conteos corruptos
produzcan cero pérdidas inventadas.

## Validación física del 28 de septiembre de 2026

La corrección fue probada con el MAX30102 aislado en otro protoboard y el MPU
desconectado intencionalmente.

### Antebrazo

- 3.284 muestras completas;
- cero pérdidas sospechadas;
- el mayor intervalo fue 1,12 s, frente a los saltos falsos de miles de
  segundos observados en 1.0.20;
- no reaparecieron conteos FIFO de 125 ni cercanos a 65.535;
- no hubo FC técnicamente válida por transitorios ópticos, diferencia entre
  canales y ventanas temporalmente inválidas.

Evidencia local ignorada por Git:
`measurements/biosys-1.0.21/20260928-195729-antebrazo-max30102-aislado-biosys-1-0-21-toma-1.csv`.
SHA-256:
`D94CF377ACCAE110139775665C5493A186B0669F45EC7B50E071900FE81679EC`.

### Dedo, referencia técnica sin patrón clínico

- 1.499 muestras durante 60 s a 25 Hz;
- todos los intervalos consecutivos fueron exactamente 40.000 microsegundos;
- cero pérdidas, transitorios ópticos, movimiento o ventanas temporalmente
  inválidas;
- 301 muestras `VALIDA`, distribuidas en tres tramos;
- tramo válido más largo: 7,6 s;
- FC válida: 71,43 a 93,75 lpm, mediana 78,95 lpm;
- ningún resultado válido atravesó una barrera de seguridad.

Evidencia local ignorada por Git:
`measurements/biosys-1.0.21/20260928-200329-dedo-referencia-biosys-1-0-21-toma-1.csv`.
SHA-256:
`BAA33DCD06AE2F51675921FD15C948428B2CAB80B8933FD726C7A44617FB9464`.

Conclusión: el problema de conteos FIFO quedó corregido y el recorrido de FC
puede producir resultados técnicamente válidos con señal óptica fuerte. La
limitación restante en antebrazo o muñeca es principalmente el acoplamiento
óptico. No se relajaron filtros para forzar un número. Estas pruebas no miden
exactitud ni constituyen validación clínica.

## Instalación final

El perfil normal se escribió por `COM3` el 28 de septiembre de 2026. La carga
alcanzó el 100 %, `esptool` verificó el hash y el ESP32 reinició por RTS. La
consulta serie `P` confirmó MAX30102 listo, `PART_ID=0x15` y cero pérdidas.

El aviso `IMU NACK 0x68/0x69` es esperado porque el MPU estaba desconectado. El
HTTP 400 de telemetría observado sin dedo es una incidencia separada: el
firmware envía todos los signos vitales como `null` y la función remota exige
al menos un número o un evento. No afecta la adquisición PPG y no se modificó
Supabase durante esta corrección.
