# Cambios de BIOSYS 1.0.19

## Objetivo

Promover al perfil normal la autoganancia del MAX30102 validada físicamente en
BIOSYS 1.0.18, sin modificar los detectores, la fusión rojo/IR, las barreras de
validez, el MPU, las caídas, SOS, medicamentos ni conectividad.

## Cambio biomédico

- inicio de ambos LED en `0x18`;
- mínimo `0x18`, máximo `0x50` y paso `0x08`;
- objetivo IR entre 45.000 y 95.000;
- ajuste permitido antes de confirmar el contacto y durante cuatro segundos de
  estabilización;
- potencia congelada al comenzar la medición;
- identidad BIOSYS 1.0.19 / SYS 0.9.9 / BIO 0.7.3;
- experimento `PPG-AUTOGAIN-PRODUCT-19-A`.

## Evidencia de origen

BIOSYS 1.0.18 confirmó físicamente:

- contacto estable: 2.250 registros, cero descartados y 27.240 ms continuos
  `VALID` con LED fijo en `0x18`;
- señal débil: subida `0x18 -> 0x20 -> 0x28`, congelamiento al terminar la
  estabilización y cero publicaciones `VALID` durante ajuste o transitorios;
- replay físico: 23/23 autotests y 4/4 datasets aprobados.

La evidencia se conserva en `measurements/biosys-1.0.18`. No se atribuye como
ejecución física de 1.0.19.

## Criterio de salida

Antes de instalar el perfil normal de 1.0.19 se exige:

1. compilar producto, investigación y replay;
2. aprobar pruebas estáticas y de host;
3. ejecutar el replay en la placa;
4. cargar el producto y verificar identidad, MAX30102 y conectividad;
5. realizar una última captura estable.

`VALID` expresa validez técnica interna. No constituye validación clínica,
diagnóstico ni garantía de exactitud médica.

## Compilación reproducible

Los tres perfiles compilaron correctamente con Arduino CLI:

| Perfil | Programa | RAM global | `.bin` | SHA-256 |
|---|---:|---:|---:|---|
| Producto | 1.183.772 B | 56.560 B | 1.183.920 B | `28C3DAD38EE36DEEE3102105344F9E5D8135A20AB050300291074B01D1A3E04C` |
| Investigación | 1.186.452 B | 60.880 B | 1.186.608 B | `28CF51F7315C456F9854119F09D7860C67272079DA5879D91D52EC63DCCE2FCB` |
| Replay | 486.680 B | 37.252 B | 486.832 B | `AA7582A7BB4FE553252BA9E970617D6F1DD8838CE55860D4BC658F85D9E45A43` |

Estos datos demuestran compilación reproducible, no ejecución física.

## Replay físico

El perfil replay se escribió físicamente en el ESP32 por `COM3` al 100 % y
`esptool` verificó el hash de cada bloque. Se ejecutaron:

- 23/23 autotests internos: PASS;
- 4/4 datasets inmutables: PASS;
- cero resultados inseguros;
- cero validaciones con un solo canal;
- cero resultados válidos durante cuarentena.

El resultado completo está en
`measurements/biosys-1.0.19/replay-results.json`. Esta prueba valida la ejecución
del pipeline en la placa, pero todavía no equivale a instalar ni probar el
perfil normal de 1.0.19.

## Instalación del perfil normal

El binario normal se escribió al 100 % por `COM3` y `esptool` verificó su hash.
El arranque físico confirmó BIOSYS 1.0.19, SYS 0.9.9, BIO 0.7.3, WiFi,
telemetría, dos contactos y dos medicamentos sincronizados.

El diagnóstico PPG confirmó MAX30102 `PART_ID=0x15`, servicio listo, LED inicial
en `0x18`, 932 muestras procesadas y cero pérdidas sospechadas. El MPU6500 en
`0x68` se recuperó después de un timeout inicial y continúa identificado como
variante todavía no validada.

Pendiente: prueba de contacto real ejecutando el perfil normal.

### Contacto normal, toma 1

Una consulta de 60 segundos obtuvo 60/60 diagnósticos con contacto, LED fijo en
`0x18`, rojo mediano 70.584, IR mediano 80.430 y cero pérdidas sospechadas.
No produjo estado `VALIDA`: 32 diagnósticos fueron `INESTABLE`, 24 `SIN DATOS`
y 4 `SENAL BAJA`.

Resultado: **FAIL de validez técnica; repetir posición sin cambiar umbrales**.
El rechazo confirma que no se promovieron valores dudosos, pero todavía falta
demostrar una frecuencia válida con el perfil normal.

### Contacto normal, toma 2

La repetición de 90 segundos volvió a confirmar contacto y cero pérdidas, pero
no produjo estado `VALIDA`. La autoganancia quedó fija en `0x20`, con IR mediano
108.856 y modulación IR mediana 0,107 %. La referencia estable de 1.0.18 había
obtenido 0,241 % con LED `0x18`.

Resultado: **FAIL de validez técnica**. La menor pulsación relativa pese a una
señal DC mayor apunta primero a presión o apoyo del dedo. Se repetirá con la
yema apenas apoyada antes de proponer cambios al firmware.

### Contacto normal, toma 3

La prueba comenzó con una referencia sin dedo y luego se apoyó la yema completa
sin presión. En 58 diagnósticos limpios con contacto, la autoganancia pasó de
`0x20` a `0x18` durante la estabilización y permaneció en `0x18`. No hubo
pérdidas sospechadas. La modulación mediana fue 0,185 % en IR y 0,093 % en rojo.

Se obtuvo una racha de cinco diagnósticos consecutivos `VALIDA`, entre las
23:44:16 y 23:44:20, por lo que el recorrido técnico sensor-firmware del perfil
normal queda **PASS**. Los resultados de esa racha variaron entre 78 y 214 lpm;
como no se usó un instrumento de referencia, esto no demuestra exactitud y la
estabilidad temporal continúa pendiente de mejora.

Evidencia: `measurements/biosys-1.0.19/product-contact-take4.log` y
`product-contact-take4-acceptance.json`.
