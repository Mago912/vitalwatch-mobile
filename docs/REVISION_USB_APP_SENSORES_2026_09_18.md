# Revision del USB, app y sensores - 2026-09-18

## Fuente revisada

La fuente principal y mas avanzada es `F:\vitalwatch-mobile`.
La carpeta `F:\VitalWatch-V2` es un proyecto web separado con Vite y un backend
local SQLite. No debe mezclarse con la app Expo y Supabase sin una migracion
planificada.

La copia de `C:\Users\Administrator\Documents\Codex\vitalwatch-mobile` esta
atrasada respecto del USB. La comparacion encontro 627 archivos relevantes
nuevos y 44 modificados en el USB, excluyendo dependencias, compilaciones,
credenciales y binarios grandes.

## Estado encontrado

- App fuente: VitalWatch 1.0.9, Expo SDK 54 y React Native 0.81.5.
- APK candidata existente: App 1.0.9 build 17.
- Firmware de producto mas nuevo: BIOSYS 1.0.8.
- BIOSYS 1.0.8 fue compilado, cargado y arranco en el ESP32.
- El IMU fisico fue identificado como MPU6500, `WHO_AM_I=0x70`.
- Existe un laboratorio separado del MAX30102 con captura real de 90 segundos.
- La adquisicion del laboratorio logro 2250 muestras a 25 Hz sin huecos,
  duplicados, lecturas cortas ni drops del logger.
- La exactitud de frecuencia cardiaca y SpO2 no esta validada clinicamente.

## Limpieza aplicada a la app

- Se quitaron los botones visibles de simulacion de caida, SOS, bateria y
  estado normal.
- Se quito el recordatorio simulado de medicacion.
- Se retiro la configuracion ficticia de Bluetooth, API e IP local.
- Se elimino el modal de ejemplo de Expo y sus componentes de plantilla sin uso.
- Se retiraron nombres, telefonos, medicamentos y eventos de demostracion.
- Historial e Inicio muestran estados vacios claros.
- `Pulsera virtual` paso a llamarse `Control de pulsera`.
- Las capturas biometricas `RAW` quedaron excluidas por `.gitignore`.
- Se conservo el control TFT, medicamentos reales, contactos, Telegram,
  notificaciones, historial y sincronizacion Supabase.

## Validacion de la app

- TypeScript: PASS.
- ESLint: PASS.
- Expo Doctor: 18/18 PASS.
- Pruebas de lecturas: 7/7 PASS.
- Pruebas Telegram: 5/5 PASS.
- Exportacion Android: PASS.
- Exportacion iOS: PASS.

Esto valida el codigo fuente y los bundles. Todavia hace falta generar una APK
nueva e instalarla en un telefono para validar la interfaz final.

## MAX30102

La adquisicion y el registro ya son confiables, pero el algoritmo de pulso aun
no lo es. En la captura real hubo BPM entre 75 y 150, un tramo sin resultado y
otro con mediana de 136 BPM. No se debe corregir esto limitando valores ni
inventando un promedio normal.

Orden recomendado:

1. Capturar al menos tres sesiones quietas con un pulsioximetro comercial como
   referencia simultanea.
2. Capturar movimiento leve, cambio de presion del dedo y luz lateral para
   etiquetar artefactos.
3. Comparar los picos custom, SparkFun y MAXIM contra la referencia.
4. Rechazar dobles picos y armonicos antes de producir un BPM.
5. Exigir varias ventanas concordantes antes de mostrar o enviar una lectura.
6. Nunca generar alertas con un valor `APROX`, `UNSTABLE` o sin calidad buena.
7. Integrar el driver corregido en una nueva BIOSYS solamente despues de pasar
   el protocolo, conservando el laboratorio y BIOSYS 1.0.8 intactos.

## MPU6500 y caidas

Los umbrales actuales son experimentales. Un impacto mayor a 1.70 g puede abrir
la verificacion aun sin una caida. Si el dispositivo queda quieto luego de un
golpe en la mesa, la inmovilidad posterior puede completar el flujo y causar
un falso positivo.

Orden recomendado:

1. Medir offsets y ruido del MPU6500 inmovil en seis orientaciones.
2. Registrar actividades normales: caminar, sentarse, apoyar la pulsera, mover
   el brazo, golpear una mesa y dejar caer un objeto cercano.
3. Guardar tambien orientacion previa/posterior y variacion temporal, no solo
   magnitud de aceleracion y giroscopio.
4. Confirmar una caida con una secuencia: cambio brusco o baja gravedad,
   impacto, cambio de postura e inmovilidad sostenida.
5. Ajustar umbrales usando las capturas y medir falsos positivos antes de
   activar Telegram automatico.
6. Implementar estos cambios en una nueva version BIOSYS, nunca dentro de la
   carpeta 1.0.8 ya validada.

## Riesgos de organizacion

- El repositorio Git del USB tiene 30 objetos faltantes. Los archivos actuales
  son legibles, pero el historial no es confiable y algunos comandos Git fallan.
- Antes de reparar Git se debe copiar todo el arbol de trabajo a un respaldo.
- `Laboratorio_Pruebas_MAX30102_2026-09-17/RAW` contiene biometria y no debe
  subirse a un repositorio publico.
- Los directorios `build` dentro de firmwares antiguos y las copias completas
  de bibliotecas ocupan espacio; deben conservarse fuera del arbol de fuente o
  en paquetes de evidencia, sin borrar las versiones estables hasta tener dos
  respaldos.

## Proximo objetivo recomendado

Crear una rama limpia de trabajo desde una copia respaldada, recuperar Git y
preparar dos lineas separadas:

- App 1.0.10: limpieza final, prueba visual en telefono y APK.
- BIOSYS 1.0.9: candidato biometrico solo despues de comparar MAX30102 con una
  referencia externa. La calibracion MPU debe continuar como etapa posterior.
