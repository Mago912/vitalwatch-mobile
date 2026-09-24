# Cambios BIOSYS 1.0.10

Estado: candidato experimental, todavia no reemplaza a BIOSYS 1.0.9 estable.

## MAX30102

- El entorno portable amplía el buffer SparkFun de 4 a 32 muestras.
- La prueba fisica a 25 Hz paso de 56 perdidas en 75 s a 0 perdidas en 45 s.
- El modo de investigacion usa 460800 baudios y valida cada fila CSV.
- La potencia LED reducida sigue limitada al modo de investigacion hasta
  compararla con un oximetro de referencia y con mas personas.

## MPU6500

- El CSV incluye `gx`, `gy` y `gz` por separado.
- Se compensan offsets de giroscopio repetidos en tres sesiones quietas:
  X `-0.02346`, Y `+0.03572`, Z `-0.01245` rad/s.
- La validacion posterior redujo la magnitud quieta promedio de `0.04446` a
  `0.00092 rad/s`, sin saturaciones.
- El CSV conserva los maximos del MPU entre filas PPG para observar golpes
  breves sin perderlos por la diferencia entre 100 Hz y 25 Hz.
- El acelerometro permanece sin correccion: una sola posicion no permite
  separar correctamente offset y escala de los tres ejes.
- Cinco golpes suaves sobre la mesa alcanzaron `1.33 g`, delta `0.94 g` y
  giro `0.036 rad/s`: no cumplieron las condiciones combinadas de impacto.
- La prueba de mesa mantuvo 25 Hz PPG efectivos, sin perdidas ni saturacion.

## Seguridad de interpretacion

- HR, SpO2 e impacto siguen siendo mediciones experimentales.
- La TFT ya no muestra un numero de pulso cuando el resultado es inestable;
  presenta `--` y el estado `INESTABLE` hasta obtener una lectura valida.
- No se modifican aun los umbrales de caida ni se declara validacion clinica.
