# Prompt para continuar VitalWatch en otra computadora

Quiero continuar el proyecto escolar VitalWatch desde el estado real de esta
carpeta, no desde una copia vieja ni solo desde GitHub. Antes de cambiar codigo,
ubica la unidad USB y la carpeta `vitalwatch-mobile`; la letra de unidad puede
ser distinta de `F:`. Lee `AGENTS.md`, `git status`, la rama, el ultimo commit,
los cambios sin commit y los archivos ignorados necesarios. No sobreescribas
cambios existentes ni publiques credenciales.

Contexto:

- VitalWatch es una app Expo/React Native SDK 54 y un firmware ESP32 para una
  pulsera de adulto mayor. La app usa Supabase y alertas remotas; el firmware
  normal instalado al terminar esta sesion fue BIOSYS 1.0.20.
- La fuente mas reciente en esta PC estaba en `F:\vitalwatch-mobile`, rama
  `codex/recovery-2026-09-18`, commit base `e732934`. La carpeta
  `C:\Users\Administrator\Documents\Codex\vitalwatch-mobile` era una copia
  antigua. Verifica de nuevo estas afirmaciones en la otra PC.
- Hay cambios locales sin commit en app, firmware, scripts y documentacion.
  Preservalos. No asumas que todo esta en GitHub. El archivo de configuracion
  del dispositivo, `.env.local`, claves y tokens deben permanecer privados.

Prueba fisica MAX30102:

- El ESP32 clasico por COM3 reconocio MAX30102 `PART_ID=0x15`. El MPU volvio a
  funcionar despues de un aviso temporal `IMU NACK 0x68/0x69`.
- La primera prueba sobre la muneca perdio contacto varias veces; no hubo FC
  valida. Su registro esta en `measurements/biosys-1.0.20/wrist-rest-take1.log`.
- En el antebrazo, con contacto continuo, 65 s de diagnostico mostraron
  SpO2 experimental pero ninguna FC valida. La razon principal fue
  `QR_CHANNEL_MISMATCH` (`0x0200`).
- Luego se cargo temporalmente `BIO_RESEARCH_MODE=1` y se capturaron 120 s:
  3.000 muestras completas a 25 Hz, cero perdidas, 87 candidatos rojos,
  61 infrarrojos, solo 2 pares sincronizados y ninguna FC valida. Evidencia:
  `measurements/biosys-1.0.20/20260926-125818-antebrazo-reposo-2.csv`.
  `node scripts/analyze-biosys-ppg-capture.mjs <ruta-al-csv>` resume la toma.
- La captura CSV esta ignorada por Git: debe viajar en la carpeta completa del
  USB si se quiere conservar. No es dato clinico ni valida la SpO2.
- Tras la captura se restauro BIOSYS 1.0.20 normal. `esptool` verifico el hash
  y el dispositivo respondio al comando serie `P` a 115200 baudios.
- El boton BOOT fue necesario para entrar en modo de carga; la carga automatica
  fallo con `No serial data received`. No cambies firmware a ciegas ni relajes
  los filtros de FC solo para obtener un numero.

Logo de la app:

- El usuario entrego el logo azul de VitalWatch. Se guardo el PNG original en
  `assets/images/vitalwatch-logo.png` y se incorporo a Inicio, acceso,
  vinculacion, icono Android/iOS y splash mediante `components/vitalwatch-logo.tsx`
  y `app.json`. El PNG y el componente pueden seguir sin commit.
- Se eliminaron las referencias a los graficos de plantilla del icono Android.
  `npx tsc --noEmit`, `npm run lint` y `npx expo config --type public --json`
  pasaron. Aun no se genero ni instalo una APK con este logo; el icono y splash
  nativos requieren una nueva compilacion.

Proximos pasos recomendados:

1. Revisar estado Git y asegurar que el PNG, el componente y los cambios
   deseados viajen a la otra PC. No incluir archivos de secretos al subir a Git.
2. Probar visualmente el logo en un celular y generar una APK de preview si se
   necesita actualizar el icono instalado.
3. Para FC de muneca, mejorar el montaje optico: modulo separado del
   protoboard con cables flexibles, presion uniforme y bloqueo de luz lateral.
   Repetir captura quieta y otra con movimiento. Si rojo/IR siguen sin pulsos
   coherentes, evaluar un sensor con LED verde para frecuencia en muneca.
4. No usar la SpO2 experimental ni FC no validada para decisiones medicas.
   Antes de cambiar el algoritmo, comparar senales crudas y pruebas fisicas.

Explica cada cambio de forma sencilla en espanol. Verifica compilacion, pruebas
y resultado fisico por separado. Respeta el `AGENTS.md` del proyecto y consulta
la documentacion exacta de Expo 54 antes de modificar codigo de la app.
