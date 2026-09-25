# Cambios BIOSYS 1.0.14

Durante la prueba manual de 1.0.13 no se abrio ninguna alerta, incluso con
picos de `3,10 g`. Sin embargo, el movimiento logro mantener `0,43 g` durante
ocho muestras y armo temporalmente la etapa de caida libre.

Esta revision exige una firma mas cercana a una caida libre real:

- `<= 0,25 g` durante al menos diez muestras consecutivas, unos 100 ms;
- impacto posterior de `>= 2,80 g` dentro de 500 ms;
- tres segundos de inmovilidad;
- cuenta regresiva cancelable.

El giro sigue siendo solo diagnostico y nunca inicia la alerta.
