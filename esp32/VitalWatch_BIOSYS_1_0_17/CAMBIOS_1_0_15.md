# Cambios BIOSYS 1.0.15 — candidato experimental PPG LED-35-TIMELINE-A

Estado: laboratorio; no reemplaza todavía a BIOSYS 1.0.14.

## Objetivo

Investigar `FC INESTABLE` y `SEÑAL BAJA` en el ESP32 NodeMCU clásico de
38 pines sin modificar la detección de caídas ni relajar los criterios que
impiden publicar una frecuencia cardíaca dudosa.

## Evidencia de partida

Con el perfil normal, el LED llegó al mínimo permitido `0x35` mientras la
señal IR permaneció alrededor de 192000, por encima del objetivo de 90000.
Durante la misma colocación la modulación IR osciló entre 0,249 % y
0,046 %, cruzando el mínimo de calidad de 0,06 %. MAXIM produjo estimaciones
internas contradictorias, por lo que el firmware hizo correctamente en no
publicarlas como FC válida.

Las capturas previas también muestran que bajar el LED reduce el componente
DC, pero no demuestra por sí solo una FC más estable. Por eso esta versión no
promueve aún el perfil reducido a producto: lo activa únicamente al compilar
con `BIO_RESEARCH_MODE=1`.

La captura física `20260924-191832-dedo-quieto-led-range-a-toma-2.csv` no tuvo
pérdidas, desbordamientos ni errores I2C. Sin embargo, sus intervalos de
muestra variaron entre 26706 y 54825 microsegundos pese a la tasa nominal de
25 Hz. Se confirmó que el firmware reanclaba cada lote al tiempo variable del
loop y trasladaba ese jitter artificial al cálculo de IBI.

## Cambios

- identidad separada `BIOSYS 1.0.15 / SYS 0.9.9 / BIO 0.6.9`;
- identificador de ensayo actual `PPG-LED-35-TIMELINE-A`;
- perfil research con LED inicial `0x20`, mínimo `0x08`, paso `0x08` y objetivo
  IR 45000–95000;
- reloj de servicio PPG monotónico de 64 bits mediante `esp_timer_get_time()`;
- tiempo de muestra continuo: después del primer lote avanza exactamente
  40000 microsegundos por número de secuencia, incluyendo huecos confirmados;
- versión del algoritmo HR `0x0605` para distinguir esta reconstrucción;
- cada fila CSV se transmite con una única escritura UART para evitar que
  mensajes concurrentes rompan el registro;
- herramientas de compilación y captura apuntan a carpetas 1.0.15 separadas.

## Intencionalmente sin cambios

- detector de caídas y calibración MPU6050/6500;
- detección de picos, límites IBI, filtros y umbrales de calidad;
- resultados SpO₂/FC y su condición experimental;
- app, telemetría, Wi-Fi, medicación y mensajería.

La promoción de cualquier corrección óptica exige una nueva captura física
repetible. Sin oxímetro o ECG de referencia sólo puede evaluarse integridad y
consistencia interna, no exactitud clínica.

Los resultados físicos de la corrección temporal están documentados en
`RESULTADOS_TIMELINE_A_2026-09-24.md`.

Después de validar 2250/2250 intervalos exactos de 40000 us, el siguiente
ensayo conserva TIMELINE-A y fija el LED de laboratorio en `0x35`. No cambia
el detector, los filtros ni los umbrales: busca determinar si una mayor
amplitud óptica permite alcanzar una FC realmente `VALID`.
