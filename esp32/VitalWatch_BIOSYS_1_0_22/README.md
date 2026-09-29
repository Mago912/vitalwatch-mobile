# VitalWatch BIOSYS 1.0.22 — publicación de FC

Versión candidata para ESP32 clásico NodeMCU de 38 pines. Integra SYS 0.9.9 y
BIO 0.7.5. BIO cambia por su capa de publicación, **no por un cambio en el
detector ni por una nueva validación médica**.

## Qué cambia

- Los cambios de estado de FC se reflejan en `hrDisplay` sin esperar cinco
  segundos; la TFT los consume en su siguiente actualización habitual.
- Al dejar de ser válida una FC se retira ese estado y se limpia el historial
  de suavizado inmediatamente al ejecutar la publicación.
- La mediana usa únicamente valores VALID del tramo válido actual. Al volver
  a VALID se publica el nuevo valor sin mezclar números inestables anteriores.
- El número dentro de un tramo VALID sigue suavizándose con la cadencia de
  cinco segundos. SpO2 conserva su comportamiento anterior.

Detector rojo/IR, fusión, umbrales IBI, confirmación temporal, FIFO, MPU,
alertas, comunicaciones y app se conservan. **El mecanismo independiente
`heartRateForTelemetry()` no cambia:** no se promete actualización inmediata
del estado de la app o la nube con esta corrección.

## Compilar y preparar la prueba

Desde `D:\vitalwatch-mobile`:

```powershell
node scripts/run-hrpair-native-tests.mjs --version=1.0.22 --require-immediate
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-compare-build -BiosysVersion 1.0.22
```

El perfil HRPAIR-1 añade el diagnóstico `Q` a 115200 baudios sin activar
Research ni Replay. Su esquema es el mismo que en 1.0.21 para comparar tomas.
Los binarios van a `.arduino/build/biosys-1.0.22-hrpair` y no reemplazan los
de 1.0.21. Para compilar el perfil normal sin `Q`, usar `-Action biosys-build`
con el mismo `-BiosysVersion 1.0.22`; esa compilación es independiente.

Solo después de compilar y coordinar BOOT/IO0 se puede cargar el diagnóstico:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-compare-upload -BiosysVersion 1.0.22 -Port COM3
```

La carga valida el recibo de hashes y no recompila. Confirmar el puerto real,
mantener BOOT hasta comenzar `Writing...` y soltarlo entonces. No tocar RESET.
La herramienta efectúa su reinicio automático al finalizar la carga.

Después de verificar la instalación y de preparar el dedo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-biosys-hr-pair.ps1 -Port COM3 -FirmwareVersion 1.0.22 -DurationSeconds 120 -Label dedo-luz-habitual-toma-1
```

`FirmwareVersion` es una declaración del operador: el esquema HRPAIR-1 no
incluye la versión de firmware. Verificar el arranque/la carga antes de
etiquetar una toma. Los registros nuevos quedan separados en
`measurements/biosys-1.0.22-hrpair`.

**Importante:** omitir `-BiosysVersion` o `-FirmwareVersion` conserva el valor
predeterminado anterior, 1.0.21. Es intencional para no cambiar los flujos
existentes de Research/Replay ni confundir capturas históricas.

## Validación y privacidad

Ver [cambios y evidencia](CAMBIOS_1_0_22.md). Una prueba nativa exitosa y una
compilación correcta no sustituyen la carga y prueba física. La exactitud de
FC y SpO2 sigue sin validación clínica.

`vitalwatch_config.h` se conserva solamente en la copia local y sigue ignorado
por Git. No compartirlo ni compartir binarios que integren credenciales.
BIOSYS 1.0.21 y sus binarios permanecen disponibles para comparación/retorno.
