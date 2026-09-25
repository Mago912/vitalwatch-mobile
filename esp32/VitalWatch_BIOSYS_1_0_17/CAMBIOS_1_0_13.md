# Cambios BIOSYS 1.0.13

La prueba fisica de 1.0.12 demostro que manipular el protoboard puede producir
picos de `4,62 g` y giros de mas de `9 rad/s` sin una caida. Por ese motivo se
elimino por completo la ruta de impacto directo.

El detector ahora exige esta secuencia completa:

1. aceleracion de `<= 0,45 g` durante al menos ocho muestras consecutivas;
2. impacto de `>= 2,50 g` dentro de los siguientes 700 ms;
3. inmovilidad sostenida durante tres segundos;
4. cuenta regresiva cancelable antes de enviar la alerta.

Mover, girar o apoyar el protoboard puede generar registros diagnosticos, pero
no debe abrir la alerta si antes no hubo una caida libre clara.

La correccion de telemetria de FC valida incorporada en 1.0.12 se conserva sin
cambios.
