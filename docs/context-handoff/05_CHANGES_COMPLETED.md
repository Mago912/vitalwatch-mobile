# VITALWATCH — CHANGES COMPLETED

## 0. Separación de ejes y perfil biomédico — `VW-SYS 0.9.1` / `VW-BIO 0.6.0`

**Problema:** 0.6 se usaba tanto para una versión histórica de medicación como
para una nueva integración biomédica, mientras el sistema conectado ya era
0.9.1.  
**Solución:** familias `VW-SYS` y `VW-BIO`, carpetas distintas y manifiesto. Se
integró/compiló SYS; se corrigió/compiló BIO normal y research/replay.  
**Estado:** software `WORKING — F`; hardware/dataset `PENDING — P`.  
**Detalle:** `../VITALWATCH_INTEGRACION_VW_SYS_0_9_1_VW_BIO_0_6_0.md`.

Esta cronología agrupa mejoras funcionales. No asigna fechas cuando el
repositorio no permite demostrarlas.

## 1. Firmware original conservado — `0.5.0`

**Problema:** era necesario preservar el punto de partida.  
**Modificación:** se mantuvo una copia completa en
`esp32/VitalWatch_FW_0_5_0/`.  
**Resultado:** comparación posible sin reescribir desde cero.  
**Estado:** `WORKING` como referencia — F.

## 2. Medicamentos desde Supabase — `0.6.0`

**Problema:** la pulsera no tenía horarios personalizados sincronizados.  
**Modificación:** se agregaron configuración privada, WiFi/HTTPS,
ArduinoJson, tarea de sincronización, pantalla de medicamentos y confirmación
con OK largo.  
**Archivos principales:** `Sincronizacion_Medicacion.h`, `Interfaz.h`, `.ino`.  
**Resultado:** medicamento creado en app apareció físicamente en TFT y el
estado “Tomado” volvió a la app.  
**Estado:** `WORKING — U`.

## 3. Telemetría real — `0.7.0`

**Problema:** la app dependía de datos simulados.  
**Modificación:** se agregó `Telemetria.h`, payload autenticado del dispositivo
y Edge Function `vitalwatch-device-telemetry`.  
**Resultado:** ESP32 envió una primera lectura; Supabase guardó impacto real y
dejó BPM/SpO₂/batería nulos cuando no eran válidos.  
**Estado:** `WORKING` para flujo inicial — U; validación biomédica `PENDING`.

## 4. Caída y SOS hacia backend — `0.7.0`

**Problema:** eventos urgentes no salían del firmware.  
**Modificación:** caída e izquierda+derecha 2.5 s encolan telemetría inmediata
con evento.  
**Resultado:** contrato backend admite `fall_detected` y `sos`.  
**Estado de comunicación:** `PARTIALLY_WORKING — F, U`.  
**Estado del algoritmo de caída:** `EXPERIMENTAL — F`.

## 5. Portal WiFi y memoria NVS — `0.8.0`

**Problema:** cambiar de casa exigía recompilar SSID/contraseña.  
**Modificación:** `Configuracion_WiFi.h` agregó AP temporal, DNS, WebServer,
escaneo, formulario, almacenamiento NVS, reconexión y borrado con OK al inicio.  
**Resultado:** el usuario configuró una red 2.4 GHz desde el celular; la TFT
mostró instrucciones y el ESP32 se conectó.  
**Estado:** `WORKING — U`.

## 6. Control remoto de TFT — `0.9.0`

**Problema:** la app no podía elegir el contenido de la pantalla física.  
**Modificación:** se añadieron columnas de estado deseado/reportado en
Supabase, API móvil, módulo `Control_Remoto.h`, prioridad local y confirmación
del ESP32.  
**Resultado:** 0.9.0 reconoce encendido lógico y vistas en la consulta general;
puede tardar hasta 30 s.  
**Estado:** `PARTIALLY_WORKING — F, U`.

## 6B. Candidato rápido con fecha — `0.9.1`

**Problema:** 0.9.0 podía tardar hasta 30 s y no mostraba fecha.  
**Modificación:** versión separada con control TFT cada 1 s, medicamentos cada
5 s, campo `fecha[11]` y fecha visible en la TFT.  
**Fuente:** snapshot completo entregado el 2026-09-01.  
**Resultado actual:** código recuperado y versionado internamente como 0.9.1.  
**Estado:** fuente `WORKING — F`; compilación histórica `U`; hardware `NOT_TESTED — P`.

## 7. Priorización de alertas y sensores continuos

**Problema:** UI o red podían interferir con la adquisición o esconder alertas.  
**Modificación:** sensores se procesan siempre; HTTPS se mueve a otra tarea;
SOS, impacto y portal tienen prioridad y pueden despertar la TFT.  
**Resultado:** arquitectura no bloqueante a nivel de diseño y prueba previa.  
**Estado:** `WORKING` como arquitectura — F, U.

## 8. UI TFT adaptada a 128×128

**Problema:** poco espacio, necesidad de alto contraste y lectura sencilla.  
**Modificación:** splash, menú de una opción, barra fija, footers, vistas de
diagnóstico, medicación, PPG y alertas rojas; redibujos parciales.  
**Resultado:** TFT físicamente visible, orientación y colores correctos.  
**Estado:** revisión probada `WORKING — U`; archivo actual `NOT_TESTED — F`.

## 9. Autenticación y aislamiento de cuentas

**Problema:** el prototipo inicial necesitaba separar datos y credenciales.  
**Modificación:** Supabase Auth, vínculo de un solo uso, hashes, RLS, función
administrativa restringida, permisos mínimos e índices.  
**Resultado:** app exige sesión/vínculo y el ESP32 usa token propio.  
**Estado:** `WORKING — F, U`.

## 10. Medicamentos personalizables en app

**Problema:** horarios fijos no representaban uso real.  
**Modificación:** crear, editar, desactivar, programar fecha/hora y registrar
pendiente/tomado, con respaldo AsyncStorage.  
**Resultado:** ida y vuelta física de medicamento confirmada.  
**Estado:** `WORKING — U`; reproducibilidad de la migración de fecha `PENDING`.

## 11. Historial, panel y simulación

**Problema:** era necesario demostrar estados antes de contar con telemetría
continua validada.  
**Modificación:** panel, historial, simulaciones, fuente visible
Simulación/Supabase y refresh periódico de 15 s.  
**Resultado:** app puede mostrar datos remotos o simulados y generar alertas
locales.  
**Estado:** `WORKING — F, U`.

## 12. Push remoto Android

**Problema:** alertas debían llegar con la app cerrada.  
**Modificación:** Expo Notifications, canal Android, token FCM/Expo, registro en
Supabase, Edge Function y webhook.  
**Resultado:** push remoto funcionó en un Android físico.  
**Estado:** Android `WORKING — U`; iOS `NOT_TESTED`.

## 13. Control de batería honesto

**Problema:** mostrar un porcentaje inventado desde firmware sería engañoso.  
**Modificación:** ADC opcional con pin `-1` por defecto y campos nulos cuando no
hay circuito.  
**Resultado:** primera telemetría no inventó batería.  
**Estado:** comportamiento seguro `WORKING — F, U`; hardware `PENDING`.

## 14. Automatización local de Arduino

**Problema:** preparar otra PC manualmente era complejo.  
**Modificación:** scripts para Arduino CLI, core ESP32, librerías, puertos,
build, upload y monitor.  
**Resultado:** versiones anteriores compilaron y se cargaron desde scripts.  
**Estado histórico:** `WORKING — U`.  
**Estado actual en snapshot completo:** rutas coherentes con 0.9.1 — F.  
**Estado en `D:\vitalwatch-mobile`:** `PENDING — F` hasta integrar la carpeta.

## 15. Pulsera virtual — app `1.0.3`

**Problema:** la pestaña estaba declarada sin sus archivos principales.  
**Modificación recuperada:** `app/(tabs)/watch.tsx` y
`components/virtual-tft.tsx`, con cinco vistas, botones locales, confirmación de
toma y envío explícito de la vista a la TFT física.  
**Resultado:** el snapshot completo pasó TypeScript y ambos archivos pasaron
ESLint.  
**Estado:** `PARTIALLY_WORKING — F`; APK Android pendiente.

## 16. Migración de fecha recuperada

**Fuente:** backup entregado y commit remoto `64577e2`.  
**Resultado:** SQL original para `scheduled_date`, backfill, default, `NOT NULL`
e índice de horario disponible.  
**Estado:** fuente `WORKING — F`; aplicación en Supabase remoto `P`.

# ERRORES RESUELTOS

## FCM no inicializado

**Problema:** `Default FirebaseApp is not initialized`.  
**Causa:** la instalación no incluía configuración nativa de Firebase.  
**Solución:** se incorporó `google-services.json` al build Android y se generó
una APK compatible.  
**Archivos:** `app.json`, configuración EAS/Firebase.  
**Importante para futuro:** Expo Go no reemplaza la prueba con APK para push
remoto.  
**Estado:** `RESOLVED — U`.

## `npm ci` en Linux/EAS

**Problema:** lockfile incompatible durante build.  
**Causa:** `package-lock.json` no estaba sincronizado con la versión de npm.  
**Solución:** se sincronizó con npm 10.9.8 y Node 22 en EAS.  
**Archivo:** `package-lock.json`, `eas.json`.  
**Importante para futuro:** no regenerar el lockfile con una versión arbitraria
sin ejecutar lint, TypeScript y build.  
**Estado:** `RESOLVED — U`.

## Puerto serie incorrecto

**Problema:** Windows puede mostrar `COM1 Unknown`, que no es la placa.  
**Causa:** puerto del sistema sin identificación del ESP32.  
**Solución:** el flujo lista puertos y excluye COM1 desconocido en la selección
automática.  
**Archivo:** `scripts/esp32-firmware.ps1`.  
**Importante para futuro:** usar cable USB de datos y cerrar Monitor Serie antes
de cargar.  
**Estado:** `RESOLVED` como protección de flujo — F, U.

## Incompatibilidad de nombre MAX30105/MAX30102

**Problema:** el nombre de clase podía interpretarse como sensor equivocado.  
**Causa:** SparkFun usa `MAX30105` para varios chips de la familia.  
**Solución:** comentarios explícitos y uso de dirección/ID del MAX30102.  
**Archivo:** `Sensor_Oxigeno.h`.  
**Importante para futuro:** no cambiar de librería solo por el nombre de clase.  
**Estado:** `RESOLVED — F`.

## IMU vendida como MPU6050 pero con otro ID

**Problema:** un driver rígido podía rechazar el sensor físico.  
**Causa:** el módulo reportó MPU6500 (`0x70`).  
**Solución:** acceso por registros comunes y aceptación de IDs 6050/6500/9250/9255.  
**Archivo:** `Sensor_Movimiento.h`.  
**Importante para futuro:** conservar detección por `WHO_AM_I`.  
**Estado:** `RESOLVED` para detección — F, U.

## Bus I²C compartido inestable durante inicialización

**Problema:** una librería podía alterar el bus y afectar al otro sensor.  
**Causa:** inicialización compartida MAX30102/IMU.  
**Solución:** recuperación del bus, reloj/timeout común y revalidación de IMU
después de iniciar MAX30102.  
**Archivos:** `Configuracion.h`, `.ino`.  
**Importante para futuro:** preservar el orden de setup.  
**Estado:** `WORKING — F, U`.

## WiFi fijo en código

**Problema:** la pulsera solo funcionaba en la casa configurada al compilar.  
**Causa:** SSID/contraseña compilados.  
**Solución:** portal cautivo + NVS + reconexión + reset con OK.  
**Archivo:** `Configuracion_WiFi.h`.  
**Importante para futuro:** la red compilada es respaldo, no flujo principal.  
**Estado:** `RESOLVED — U` para el prototipo.

# CONTEXT CONFLICTS RESUELTOS EN FUENTE

- `0.9.1` fue localizada y entregada completa.
- la migración de fecha fue recuperada desde backup y remoto.
- la Pulsera virtual fue recuperada con ruta y componente.
- el `0.9.0` actual coincide con el commit `49df2d5` y el ZIP histórico.

Sigue sin resolverse la integración de esas fuentes en un repositorio Git sano
y su validación física/runtime. Ver `09_BUGS_AND_KNOWN_ISSUES.md`.
