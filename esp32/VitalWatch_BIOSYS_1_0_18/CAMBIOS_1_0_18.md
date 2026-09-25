# Cambios de BIOSYS 1.0.18

Fecha: 2026-09-25

Estado: **RESEARCH PENDING PHYSICAL VALIDATION**

## Hipótesis única

BIOSYS 1.0.17 confirmó que `0x18` puede sostener una frecuencia técnicamente
válida cuando el contacto óptico es estable. También mostró que una posición
inestable debe seguir siendo rechazada.

BIOSYS 1.0.18 prueba una autoganancia acotada en modo de investigación:

- comienza en `0x18`;
- puede subir hasta `0x50` en pasos de `0x08`;
- ajusta sólo antes del contacto y durante los 4 segundos de estabilización;
- al comenzar la medición mantiene fija la potencia elegida;
- el perfil normal continúa sin cambios.

El detector, la fusión rojo/IR, los límites IBI, las cuarentenas, la línea
temporal y `Sensor_Movimiento.*` son idénticos a 1.0.17.

## Puerta de aceptación

Una captura controlada de 90 segundos debe cumplir:

- al menos 2.200 registros y cero descartados;
- todos los deltas consecutivos a 40.000 us;
- cero pérdidas sospechadas y cero muestras faltantes;
- al menos 10.000 ms continuos `VALID`;
- ningún `VALID` con movimiento alto, transitorio óptico o tiempo inválido;
- al menos seis latidos rojo/IR sincronizados en cada muestra `VALID`;
- potencia LED estable una vez finalizada la estabilización.

Además se realizará una prueba separada con señal inicial débil para comprobar
que la potencia pueda subir sin publicar valores durante el ajuste.

`VALID` expresa coherencia técnica interna. No constituye validación clínica,
diagnóstico ni comparación con un instrumento certificado.

## Compilación local

Los tres perfiles compilaron sin errores:

- producto: 1.183.772 bytes de programa y 56.560 bytes de RAM global;
- investigación: 1.186.452 bytes de programa y 60.880 bytes de RAM global;
- replay: 486.680 bytes de programa y 37.252 bytes de RAM global.

SHA-256 de investigación:
`7E15173C832B9487A632E619A2CD35EA2B1689E9F515C49CB068E922480F15B5`.

Compilar no demuestra funcionamiento físico. Aún faltan replay y capturas en
el ESP32.

## Regresión física de replay

La imagen replay se escribió al 100 % en `0x10000` y finalizó con
`Hash of data verified`.

- 23 de 23 autotests: PASS;
- 4 de 4 datasets inmutables: PASS;
- señal estable histórica: 12.600 ms continuos `VALID`;
- sin dedo y cambio de contacto: cero publicaciones `VALID`;
- cero `unsafe_valid`, `single_channel_valid` o `valid_during_quarantine`.

El pipeline de seguridad permanece igual a 1.0.17. Aún faltan las pruebas
físicas específicas de autoganancia con el MAX30102.
