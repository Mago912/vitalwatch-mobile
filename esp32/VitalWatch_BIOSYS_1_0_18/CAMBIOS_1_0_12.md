# Cambios BIOSYS 1.0.12

## Caidas

BIOSYS 1.0.11 todavia aceptaba `1,32 g` cuando habia giro rapido. En el
prototipo se observaron alertas al mover el protoboard con aproximadamente
`1,37 g`, por lo que esa ruta se elimino.

La version 1.0.12 solo inicia una posible caida cuando ocurre uno de estos
patrones:

- al menos dos muestras de baja gravedad (`<= 0,75 g`) y luego un impacto de
  `>= 1,80 g` dentro de un segundo;
- impacto directo de `>= 2,60 g` acompañado por giro de `>= 0,80 rad/s`.

Despues siguen siendo obligatorias la inmovilidad sostenida y la cuenta
regresiva cancelable. Los movimientos menores se registran como ignorados para
seguir calibrando, pero no abren la alerta.

## Frecuencia cardiaca en la app

Una FC valida podia existir menos de los cinco segundos entre envios y quedar
oculta por la siguiente fila con valor nulo. El firmware conserva la ultima FC
realmente valida durante su ventana de antiguedad y la app busca la ultima
medicion valida reciente entre las filas recibidas. No se publican valores
inestables ni se inventan mediciones.
