# Cambios — VitalWatch VW-BIO 0.6.0

## Recibidos de Biomedical/Firmware Lab

- estado mutable trasladado de headers monoliticos a `.cpp`;
- resultados HR y SpO2 independientes con estado, calidad y version;
- timestamps de muestra reconstruidos y secuencia monotona;
- observabilidad de `check()`, `available()`, punteros y overflow FIFO;
- peaks custom, SparkFun y accepted separados;
- un IBI aislado deja de considerarse HR valido;
- SpO2 Maxim requiere `MaximValid AND quality`;
- formula `110 - 25R` confinada a research, sin `constrain()`;
- contacto expresado en tiempo;
- IMU con dt, jitter, deadlines perdidos y saturacion;
- salida `POSSIBLE_IMPACT` desacoplada de la UI;
- variantes MPU alternativas marcadas `UNVALIDATED_HARDWARE_VARIANT`;
- boton presionado durante boot ignorado hasta liberacion estable;
- interfaz incremental y `--` para valores invalidos;
- servicio I2C central y recuperacion con `Wire.end()/begin()`.

## Correcciones de esta integracion

- nombre separado `VW-BIO 0.6.0`; se elimina la ambiguedad con el historico
  `VitalWatch_FW_0_6_0` y con `VW-SYS 0.9.1`;
- un gap maximo historico ya no invalida para siempre nuevas muestras;
- una sospecha de perdida FIFO invalida una ventana finita y luego se recupera;
- el CSV ahora incluye el esquema minimo completo de la auditoria, IMU,
  estados y profiler;
- research registra tambien espera de contacto y estabilizacion;
- se agrego replay por Serial usando el pipeline real;
- replay es el unico consumidor de Serial en ese modo, evitando que los
  comandos de UI absorban las filas CSV;
- se agregaron builds npm normal, research y replay;
- la ruta Arduino CLI se hizo local al workspace y portable entre PCs.

## No realizado deliberadamente

- no se porto VW-BIO dentro de VW-SYS 0.9.1 sin regresion física;
- no se retunearon LED, AVG, sample rate, pulse width, ADC, contacto, IBI,
  calidad, impacto, rangos o DLPF;
- no se afirmo SpO2 clínicamente valido;
- no se implementaron FFT, ML, presion arterial ni clasificacion de caida.
