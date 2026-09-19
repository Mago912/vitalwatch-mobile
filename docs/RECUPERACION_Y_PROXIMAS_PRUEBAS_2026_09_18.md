# Recuperacion y proximas pruebas - 2026-09-18

## Repositorio activo

- Carpeta principal: `F:\vitalwatch-mobile`
- Rama local: `codex/recovery-2026-09-18`
- Commit de recuperacion: `fba208e`
- Remoto: `https://github.com/Mago912/vitalwatch-mobile.git`

El repositorio activo fue clonado de GitHub y luego se incorporaron los
archivos utiles del USB. `git fsck --full` finalizo correctamente.

## Copias de seguridad

- Copia completa previa: `C:\Users\Administrator\Documents\Codex\Backups\vitalwatch-mobile-usb-before-recovery-2026-09-18`
- Repositorio Git anterior dañado: `F:\vitalwatch-mobile-corrupt-backup-2026-09-18`

No borrar estas copias hasta subir y verificar la rama recuperada en GitHub.

## Validaciones realizadas

- TypeScript: PASS.
- ESLint: PASS.
- Pruebas de lecturas de la app: 7/7.
- Pruebas de Telegram: 5/5.
- Expo Doctor: 18/18.
- Exportacion estatica Android: PASS.
- Exportacion estatica iOS: PASS.
- Laboratorio MAX30102: 26/26 pruebas.
- Compilacion del firmware experimental MAX30102: PASS.
  - Flash: 1.191.864 bytes, 90 %.
  - RAM global: 60.856 bytes, 18 %.
- Compilacion BIOSYS 1.0.8: PASS.
  - Flash: 1.178.888 bytes, 89 %.
  - RAM global: 54.704 bytes, 16 %.

La compilacion no fue cargada al ESP32 durante esta recuperacion.

## Dependencias

Se aplico `npm audit fix` sin `--force`. Los avisos bajaron de 29 a 23. Los
restantes requieren cambios mayores, principalmente saltar de Expo 54 a Expo
57. No se realizo ese salto porque debe tratarse como una migracion separada.

## Proxima prueba del MAX30102

Se necesita un pulsioximetro comercial y el ESP32 conectado por USB. Seguir:

`Laboratorio_Pruebas_MAX30102_2026-09-17/07_PROTOCOLO_REFERENCIA_MAX30102.md`

Comandos principales:

```powershell
cd F:\vitalwatch-mobile\Laboratorio_Pruebas_MAX30102_2026-09-17
python tools/capture_biomed.py --list-ports
python tools/capture_biomed.py --port COM3 --mode FULL --test-id reposo_ref_01 --subject-id P001
```

Durante la captura:

```text
BIO REF HR 72
BIO REF SPO2 98
```

Al terminar:

```powershell
python tools/analyze_reference.py RAW\CARPETA_DE_LA_SESION
```

No crear BIOSYS 1.0.9 hasta obtener varias sesiones comparables. Los valores
inestables o de calidad baja no se reemplazan ni se limitan artificialmente.

## Prueba posterior del MPU6500

Despues de cerrar el MAX30102, seguir `docs/PLAN_CALIBRACION_MPU6500.md`. La
captura de impactos necesitara al menos 100 Hz y actividades cotidianas, golpes
de mesa y caidas de un objeto de prueba sobre espuma. No realizar caidas
intencionales con una persona.
