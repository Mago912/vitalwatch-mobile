# Plan de calibracion del MPU6500

Hardware detectado en las pruebas actuales: MPU6500 en `0x68`, con
`WHO_AM_I=0x70`. Este plan se ejecutara despues de cerrar la calibracion del
MAX30102.

## Problema actual

El firmware puede iniciar una posible caida por un impacto fuerte y luego
confirmarla si el dispositivo queda quieto. Un golpe sobre una mesa puede
cumplir ambas condiciones sin que exista una caida real.

## Datos que se deben registrar

1. Sesenta segundos inmovil para medir offset y ruido de cada eje.
2. Caminar normalmente durante dos minutos.
3. Diez repeticiones de sentarse, levantarse y acostarse.
4. Diez movimientos normales del brazo.
5. Diez apoyos del dispositivo sobre una mesa.
6. Diez golpes leves y diez golpes fuertes sobre la mesa.
7. Caidas controladas de un objeto de prueba sobre espuma. No realizar caidas
   intencionales con una persona.

Cada registro debe conservar aceleracion X/Y/Z, giroscopio X/Y/Z, magnitud,
orientacion, tiempo monotono y la etiqueta de la actividad. Para estudiar un
impacto se recomienda al menos 100 Hz; el registro biometrico actual de 25 Hz
puede perder el pico.

## Detector candidato

Una alerta no debe depender de un solo umbral. La secuencia candidata es:

1. Cambio brusco de aceleracion o perdida momentanea de apoyo.
2. Impacto dentro de una ventana temporal limitada.
3. Cambio de orientacion respecto del estado anterior.
4. Inmovilidad sostenida durante varios segundos.
5. Cuenta regresiva visible y cancelable con el boton `OK` o desde la app.

Los umbrales se calcularan a partir de los registros. No se copiaran valores
genericos de Internet y no se reducira la sensibilidad solamente hasta que las
pruebas de mesa dejen de dispararse.

## Criterios antes de instalarlo

- Ninguna actividad cotidiana registrada debe generar una caida confirmada.
- Los golpes de mesa pueden registrarse como impactos, pero no como caidas.
- Las caidas controladas deben recorrer toda la secuencia y mostrar la cuenta
  regresiva.
- `OK` en el dispositivo y en la app deben cancelar el mismo evento remoto.
- Si falta el MPU6500 o falla I2C, el sistema debe informar sensor no disponible
  y no inventar una caida.

La implementacion se hara en una version nueva del firmware. BIOSYS 1.0.8 se
mantiene como referencia y no se modifica.
