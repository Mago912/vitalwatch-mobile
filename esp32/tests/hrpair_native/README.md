# Pruebas nativas HRPAIR — CODEX REPRODUCTION TESTS

Ejecutan C++ en la PC sin abrir COM ni modificar la placa. No son tests
originales de Cowork ni una simulación validada de fisiología.

## Ejecución

Desde la raíz de `vitalwatch-mobile`:

```powershell
node scripts/run-hrpair-native-tests.mjs
node scripts/run-hrpair-native-tests.mjs --require-immediate
node scripts/run-hrpair-native-tests.mjs --version=1.0.22 --require-immediate
```

La primera orden comprueba la reproducción del **comportamiento actual**.
Que pase no significa que ese comportamiento sea deseable. La segunda exige
un contrato propuesto: publicación inmediata de cambio de validez y exclusión
de historial inestable al publicar un resultado válido. Es esperable que
falle en el baseline; no se cambia el firmware para ocultar ese resultado.
La tercera orden comprueba la corrección de 1.0.22; sus informes quedan en
`.arduino/build/hrpair-native-1.0.22`, separados del baseline. El contrato
ampliado tiene 36 casos; la caracterización histórica sigue teniendo 16.

## Qué código ejecutan

- `PpgBeatFusion.cpp` se compila directamente desde BIOSYS 1.0.21, junto con
  sus cabeceras originales. Solo `Arduino.h` se sustituye por tipos enteros
  de ancho fijo y `min/max`, necesarios para ejecutar esta unidad en la PC.
- El runner extrae literalmente las funciones de publicación, su estado,
  estructuras, enumeraciones y constantes de las fuentes actuales. No las
  traduce a JavaScript ni mantiene una copia manual de su implementación.
- `millis()` se controla desde la prueba. No se compila el bucle completo de
  adquisición, ni I2C, TFT, Wi-Fi, telemetría o el detector óptico.
- Las entradas son sintéticas: resultados de FC ya calculados o candidatos
  de pulsos rojo/IR ya detectados. Esto prueba componentes, no exactitud
  clínica, rendimiento en tiempo real ni la causa física de un pulso perdido.

La extracción de funciones es deliberadamente pequeña y falla si no encuentra
una declaración única. Si las funciones se reorganizan, hay que revisar el
runner. No es un parser C++ general. Los archivos generados y los informes con
hashes quedan en `.arduino/build/hrpair-native`, ignorado por Git.

## Compilador portátil

Zig 0.13.0, Windows x86_64, en `.tools/zig-windows-x86_64-0.13.0/zig.exe`.
Puede indicarse otro ejecutable compatible mediante `VITALWATCH_ZIG`.
No se instala globalmente y no cambia PATH ni el compilador del ESP32.

Distribución oficial: https://ziglang.org/download/0.13.0/zig-windows-x86_64-0.13.0.zip

SHA256 publicado en https://ziglang.org/download/index.json y comprobado antes
de extraer: `d859994725ef9402381e557c60bb57497215682e355204d754ee3df75ee3c158`.
El archivo comprimido ocupa 79.163.968 bytes. Compilador y caché permanecen
locales en `.tools`; no contienen ni necesitan credenciales del dispositivo.

## Casos

- Un intervalo VALID corto puede no publicarse antes de terminar.
- Un resultado UNSTABLE numérico puede conservar el estado VALID previo.
- UNSTABLE con NaN y pérdida de contacto se propagan de inmediato cuando se
  invoca la función de publicación.
- Entradas solo UNSTABLE no se convierten por sí solas en VALID.
- La mediana publicada puede mezclar números UNSTABLE anteriores con el
  estado de un nuevo resultado VALID.
- Pulsos emparejados a 1000 ms construyen el historial esperado.
- Un intervalo de 2000 ms reinicia el historial; la recuperación parte de cero.
- Se prueban los bordes 1600/1601 ms y 329/330 ms y el desacuerdo de canales.

Los resultados de la toma física de 120 s están documentados por separado.
Estos casos sintéticos no atribuyen todos sus reinicios a una sola causa.
