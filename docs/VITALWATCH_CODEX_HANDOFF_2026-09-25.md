# VitalWatch — transferencia a Codex en otra computadora

## Cómo trasladar el proyecto

La opción más segura es copiar de forma privada la carpeta completa
`D:\vitalwatch-mobile`, incluida su carpeta oculta `.git`. Hay cambios y carpetas
locales todavía no confirmados en Git; clonar solamente el último commit no
reproducirá todo el estado de trabajo.

Transferir de forma separada y segura, sin publicarlos ni adjuntarlos a un ZIP
público:

- `.env.local`;
- `google-services.json`;
- `esp32/VitalWatch_BIOSYS_1_0_16/vitalwatch_config.h`;
- cualquier token o configuración privada necesaria para Supabase/Expo.

Los directorios `.arduino/build` y `.tools` son prescindibles si se reinstalan
las herramientas y se recompila, pero conservarlos puede ahorrar tiempo. En la
otra PC el ESP32 puede aparecer con otro puerto; no asumir `COM3` sin ejecutar
primero `npm run firmware:ports`.

## Prompt listo para copiar

```text
Quiero continuar el proyecto VitalWatch exactamente desde el estado técnico que
se describe aquí. Lee primero todo este contexto, inspecciona el repositorio y
no reinicies ni reconstruyas trabajo ya completado.

PROYECTO Y ESTADO GIT

- Repositorio esperado: vitalwatch-mobile.
- En la PC anterior estaba en D:\vitalwatch-mobile.
- Rama: codex/recovery-2026-09-18.
- Commit funcional/documental requerido como mínimo:
  773a8f66d7000df3ed7c375b0626cfc56cfd7d49
  docs: finalize BIOSYS 1.0.16 PPG candidate
- Cadena relevante de commits, del más reciente al más antiguo:
  - 773a8f6 docs: finalize BIOSYS 1.0.16 PPG candidate
  - ac5a767 test: validate dual-channel PPG against physical replays
  - 2d1e2ca feat: gate technical heart-rate validity
  - 8c1465a feat: quarantine PPG contact and motion artifacts
  - decbebe feat: fuse synchronized red and IR beats
  - 17fc7f2 feat: add adaptive PPG channel detector
  - 96f2f39 test: reproduce PPG validity failure through firmware replay
  - 0d12622 chore: start BIOSYS 1.0.16 PPG candidate
  - b7a4262 docs: plan BIOSYS 1.0.16 PPG validity
  - bac1715 docs: specify BIOSYS 1.0.16 PPG validity

IMPORTANTE SOBRE EL WORKTREE

El repositorio no estaba limpio. Existen cambios o carpetas locales de la app,
Waveshare y versiones históricas que pertenecen al usuario. No ejecutar
`git reset --hard`, `git clean`, `git checkout --` ni borrar carpetas para
"limpiar" el proyecto. Inspeccionar `git status --short`, preservar todo y hacer
commits sólo con rutas explícitamente relacionadas con esta tarea.

Entre el estado local no confirmado había modificaciones en app.json,
app/(tabs)/watch.tsx, app/pair-device.tsx, app/sign-in.tsx,
constants/vitalwatch.ts, lib/vitalwatch-api.ts, lib/vitalwatch-readings.ts,
scripts/esp32-firmware.ps1, scripts/esp32-setup.ps1 y
scripts/test-vitalwatch-readings.mjs. También había carpetas históricas BIOSYS
1.0.10–1.0.15, ESP32_S3_NATIVE y trabajo Waveshare sin seguimiento. No asumir
que esos cambios son descartables ni incluirlos accidentalmente en commits.

HARDWARE Y VERSIONES ACTUALES

- Hardware objetivo actual: ESP32 clásico NodeMCU de 38 pines.
- Sensor óptico: MAX30102, dirección I2C 0x57, PART_ID esperado 0x15.
- MPU6050/MPU6500: fuera de alcance de esta mejora PPG; no modificarlo.
- Producto candidato: BIOSYS 1.0.16.
- Componentes: SYS 0.9.9 + BIO 0.7.0.
- Experimento: PPG-DUAL-CHANNEL-A.
- App actual del repositorio: 1.0.12, Expo SDK 54.
- Antes de escribir código Expo hay que consultar la documentación exacta de
  https://docs.expo.dev/versions/v54.0.0/ como exige AGENTS.md.
- No hay oxímetro comercial disponible para comparación simultánea.
- `VALID` significa validez técnica interna; nunca afirmar validación clínica,
  diagnóstico médico ni exactitud certificada.

OBJETIVO

Continuar mejorando la estabilidad y confiabilidad técnica de la frecuencia
cardíaca del MAX30102, conservando las barreras de seguridad y la trazabilidad.
No inventar resultados. No relajar varias compuertas a la vez. Cada cambio debe
partir de una irregularidad reproducida, modificar una hipótesis concreta y
volver a ejecutar pruebas negativas y positivas.

TRABAJO YA COMPLETADO

1. BIOSYS 1.0.16 integra un detector nativo de memoria fija por canal:
   - FIR corto de 7 muestras y largo de 20;
   - supresión no máxima de 320.000 microsegundos;
   - umbral de candidato `noise + 0.05 * (signal - noise)`;
   - rechazo de prominencia >6 veces la mediana fusionada.
2. La fusión exige coincidencia rojo/IR dentro de 120.000 microsegundos.
3. La publicación técnica exige, entre otras barreras:
   - SNR >= 1.50 en ambos canales;
   - al menos 6 IBI y 6 coincidencias rojo/IR;
   - MAD/mediana <= 0.12;
   - rango IBI <= 300 ms;
   - 5 segundos limpios;
   - cuarentena de 4 segundos ante artefactos o tiempo inválido.
4. Pérdida de contacto, RESET o cuarentena eliminan inmediatamente la FC
   publicada.
5. El MPU, detección de caídas y `PpgSampleTimeline.h` permanecen idénticos a
   BIOSYS 1.0.15. Confirmar por hash antes de cualquier entrega.

EVIDENCIA YA SUPERADA

- 23/23 autotests físicos pasaron en el ESP32 real.
- Pruebas Python de firmware: 9/9.
- Pruebas Node de replay/evidencia: 6/6.
- App: readings 8/8, medications 5/5, Telegram 5/5 y ESLint con exit 0.
- Cuatro replays inmutables fueron ejecutados como CODEX REPRODUCTION TESTS:
  - sin dedo: fused=0, valid=0;
  - timeline estable: valid=390, tramo continuo=12.600 ms,
    mediana=86 lpm, unsafe_valid=0, single_channel_valid=0 y
    valid_during_quarantine=0;
  - LED 35: single_channel_valid=0;
  - cambio de contacto: 4 cuarentenas, 4 recalibraciones y 0 válidos durante
    cuarentena.
- Conclusión documentada: INDEPENDENTLY REPRODUCED.

DATASETS INMUTABLES

- Sin dedo, 500 filas:
  68A60CFDF93E00FA14D018C970167D6B6CF97E75BA4629B5949D6536A33F4D96
- Timeline estable, 2251 filas:
  D8920392C7C2B51BACB70328321596278B78D51315B1BC49D37C4BAC66C1FCE1
- LED 35 estable, 2252 filas:
  F59C90CD88C80594BD540C003B8A352A4CBC2938FFC0FF54EBF5AF3EC68EF6A0
- Cambio de contacto, 2250 filas:
  2FB5E581DE1247BA5DA287E8FE6F999245CA1B4765A5516E7B1F7D4DFDE1E716

No modificar estos CSV. Si se crean pruebas nuevas, identificarlas como
CODEX REPRODUCTION TESTS. `FINAL_BIOMED_CANDIDATE` continúa NOT_AVAILABLE: no
inventar su contenido, no reconstruirlo y no atribuir pruebas nuevas a Cowork.

COMPILACIONES Y MEMORIA VERIFICADAS

- Producto: flash 1.183.772 B, RAM 56.560 B.
  Binario 1.183.920 B, SHA-256:
  DB42D196777ADA4804F68CD1CC98F4037AE4BD53591B7F97DFD3F341373CCED0
- Research: flash 1.186.452 B, RAM 60.880 B.
  Binario 1.186.608 B, SHA-256:
  F14C2DB67D0FF1683D36BD846619C6D119E447B61BA39ABD412A9433CF2CA2E4
- Replay: flash 486.680 B, RAM 37.252 B.
  Binario 486.832 B, SHA-256:
  7F78CAA3B1F8614C5FAAF235DB2B7A7E0867F634CAC4D1962B69EBC059335953
- Research creció +4.380 B de flash y +1.840 B de RAM contra 1.0.15, dentro
  de los límites aprobados de +12.288/+2.048.

ARCHIVOS QUE HAY QUE LEER ANTES DE ACTUAR

- docs/superpowers/specs/2026-09-24-biosys-1-0-16-ppg-validity-design.md
- docs/superpowers/plans/2026-09-24-biosys-1-0-16-ppg-validity.md
- esp32/VitalWatch_BIOSYS_1_0_16/README.md
- esp32/VitalWatch_BIOSYS_1_0_16/MANIFEST.md
- esp32/VitalWatch_BIOSYS_1_0_16/CAMBIOS_1_0_16.md
- esp32/VitalWatch_BIOSYS_1_0_16/RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md
- measurements/biosys-1.0.16/replay-results.json

PUNTO EXACTO DONDE SE INTERRUMPIÓ

Las tareas 1–8 del plan están completas. La tarea 9, aceptación física nueva,
todavía no comenzó. El ESP32 conserva la imagen REPLAY 1.0.16 verificada. Se
había confirmado que aparecía como COM3 en la PC anterior y se pidió mantener
IO0/BOOT y pulsar EN para cargar RESEARCH, pero la transferencia a otra PC se
solicitó antes de iniciar ese comando. Por tanto:

- no afirmar que research ya fue cargado;
- no afirmar que existe una captura física nueva de 90 segundos;
- no instalar ni declarar la imagen normal como liberada todavía.

SIGUIENTE ACCIÓN OBLIGATORIA

1. Verificar el estado del repositorio y los hashes anteriores.
2. Detectar el puerto real con `npm run firmware:ports`; puede no ser COM3.
3. Confirmar o recompilar research:
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-research-build`
4. Cargar research en el mismo ESP32. Esta placa/cable fue confiable usando el
   cargador ROM, 57.600 baudios, sin stub, sin compresión y escribiendo la app en
   0x10000. Secuencia física usada:
   - mantener IO0/BOOT;
   - pulsar y soltar EN/RESET;
   - conservar IO0 hasta que Codex confirme conexión/escritura;
   - soltar IO0;
   - después de `Hash of data verified`, con IO0 suelto pulsar EN una vez.
5. Verificar por Serial a 460800:
   - VitalWatch VW-BIOSYS 1.0.16;
   - VW-SYS 0.9.9;
   - VW-BIO 0.7.0;
   - PPG-DUAL-CHANNEL-A;
   - MAX30102 PART_ID=0x15.
6. Cerrar cualquier monitor que posea el puerto.
7. Pedir al usuario mano apoyada, dedo quieto, presión constante y no moverlo
   durante 90 segundos.
8. Ejecutar:
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-biosys-research.ps1 -Port <PUERTO> -DurationSeconds 90 -Label dedo-quieto-dual-channel-a-toma-1`
9. No sobrescribir capturas anteriores. Conservar CSV y JSON nuevos como
   artefactos inmutables y calcular SHA-256.

ACEPTACIÓN DE LA CAPTURA NUEVA

Sólo aprobar si se cumplen todas:

- al menos 2.200 registros;
- cero registros descartados;
- deltas de 40.000 us para cada secuencia consecutiva;
- `suspected_drops=0`;
- mayor segmento `VALID` >=10.000 ms;
- cero `VALID` con `QR_HIGH_MOTION`;
- cero `VALID` con `QR_OPTICAL_TRANSIENT`;
- cero `VALID` con `QR_TIMING_INVALID`;
- contribución fusionada rojo/IR en cada publicación `VALID`.

Si una condición falla, mantener research, documentar una única hipótesis
fallida y no cargar la imagen normal. Si todas pasan, compilar y cargar producto
normal, verificar su hash, registrar el veredicto en
RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md y crear un commit de evidencia con
rutas explícitas.

REGLAS PARA MEJORAS POSTERIORES DEL MAX30102

- No modificar nada crítico o vital fuera del PPG sin autorización explícita.
- No tocar MPU/caídas durante una corrección exclusiva del MAX30102.
- No usar SparkFun/MAXIM como única autoridad de FC; pueden seguir como
  diagnóstico/SpO2 experimental.
- No aceptar una FC sólo porque sea plausible visualmente.
- No relajar a la vez SNR, coherencia IBI, fusión y cuarentena.
- Mantener memoria fija y auditar flash/RAM después de cada cambio importante.
- Probar primero con replay inmutable y negativos; después hacer captura real.
- Un `VALID` corto de 400 ms en LED 35 no demuestra rendimiento sostenido.
- Sin referencia comercial, describir estabilidad técnica, nunca exactitud
  clínica.
- Documentar cada cambio, evidencia, hash y limitación en español claro.

FORMA DE TRABAJO SOLICITADA

Trabaja con máxima precisión y detalle, pero comunica avances breves. Antes de
editar, inspecciona AGENTS.md, git status, los documentos indicados y el código
actual. Usa apply_patch para cambios. Ejecuta pruebas antes de declarar éxito.
Preserva cambios ajenos. Solicita la interacción del usuario únicamente cuando
haya que pulsar IO0/BOOT, EN/RESET, colocar el dedo o realizar otra acción
física. Continúa desde la tarea 9; no repitas las tareas 1–8 salvo verificaciones
necesarias en la nueva computadora.
```

## Nota sobre el primer arranque en la otra PC

Si sólo se copió el repositorio y no `.arduino`/`.tools`, permitir que Codex
revise primero `scripts/esp32-setup.ps1` y reconstruya las dependencias. No
copiar credenciales dentro del prompt. Si se usa otro ESP32 o una memoria flash
borrada, una escritura app-only en `0x10000` no es suficiente: debe utilizarse
la carga Arduino completa para instalar bootloader y particiones. El método
app-only documentado corresponde al mismo ESP32 que ya conserva esas regiones.
