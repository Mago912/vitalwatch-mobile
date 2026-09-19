# VITALWATCH — PROJECT OVERVIEW

## Qué es VitalWatch

VitalWatch es un prototipo académico de supervisión remota para una persona
adulta mayor. Combina una pulsera electrónica, una aplicación móvil y servicios
en la nube.

```text
Persona usuaria
      │
      ▼
Pulsera ESP32 ──WiFi/HTTPS──► Supabase ◄──Auth/RLS── App móvil
      │                          │                       │
      ├─ TFT y botones           ├─ datos               ├─ panel
      ├─ MAX30102                ├─ medicamentos        ├─ historial
      └─ IMU                     └─ alertas push        └─ configuración
```

## Público objetivo

- Persona adulta mayor que usa la pulsera.
- Familiar o responsable que consulta la app.
- Equipo académico que desarrolla y valida el prototipo.

La interfaz intenta usar textos grandes, alto contraste y acciones simples.

## Funciones principales

### Pulsera

- Muestra menú, signos, movimiento, estado y medicamentos.
- Procesa MAX30102 e IMU aunque el usuario esté en otra pantalla.
- Permite navegar con tres botones.
- Permite marcar una medicación como tomada manteniendo OK.
- Genera SOS con izquierda + derecha durante 2.5 s.
- Envía telemetría periódica y eventos urgentes a Supabase.
- Configura WiFi mediante un portal desde el celular y guarda la red en NVS.
- Acepta una orden remota para dormir/mostrar la TFT y elegir vista.

### Aplicación móvil

- Registro/inicio de sesión con Supabase Auth.
- Vinculación de una pulsera con código de un solo uso.
- Panel de frecuencia cardíaca, SpO₂, movimiento y batería.
- Historial de eventos.
- CRUD de medicamentos y estados pendiente/tomado.
- Notificaciones locales y push remotas.
- Control remoto de la pantalla física.
- Simulación de estados para demostración.

### Backend

- RLS por cuenta vinculada.
- Credencial propia del ESP32, separada de la contraseña del usuario.
- Edge Functions para vinculación, push, medicamentos y telemetría.
- Tablas de dispositivos, lecturas, eventos, medicamentos, logs y tokens push.

## Alcance actual

VitalWatch demuestra un flujo de extremo a extremo:

```text
App crea medicamento
       ↓
Supabase lo guarda
       ↓
ESP32 lo consulta
       ↓
TFT lo muestra
       ↓
OK largo marca tomado
       ↓
App recibe el estado actualizado
```

Ese flujo fue probado físicamente en una revisión anterior — `WORKING — U`.

También se registró telemetría real inicial del ESP32 hacia Supabase, con
frecuencia/SpO₂ nulos cuando no había una lectura válida y sin inventar batería
— `WORKING — U`.

## Estado por componente

| Componente | Estado | Observación |
| --- | --- | --- |
| Firmware 0.9.0 probado anteriormente | `WORKING` | prueba física informada |
| Firmware 0.9.0 actual | `PARTIALLY_WORKING` | fuente exacta del commit `49df2d5`; falta revalidación actual |
| Firmware 0.9.1 | `NOT_TESTED` | fuente completa recuperada; compilación histórica U, hardware pendiente |
| App 1.0.3 | `PARTIALLY_WORKING` | Pulsera virtual recuperada; TypeScript/ESLint pasan; APK nuevo no probado |
| Supabase desplegado | `PARTIALLY_WORKING` | funcionó antes; migración local recuperada, despliegue por verificar |
| Medicamentos físicos | `WORKING` | ida y vuelta comprobada |
| Portal WiFi | `WORKING` | configurado con una red 2.4 GHz |
| Push Android | `WORKING` | comprobado en Android físico |
| Push iOS | `NOT_TESTED` | iOS pospuesto |
| BPM/SpO₂ | `EXPERIMENTAL` | sin validación clínica ni repetida |
| Caídas | `EXPERIMENTAL` | umbrales de demostración |
| Batería real | `PENDING` | no hay circuito ADC confirmado |

## Limitaciones

- No es un dispositivo médico.
- No hay evidencia de precisión clínica.
- Un “build correcto” no prueba sensores ni comportamiento físico.
- El ESP32 clásico solo usa WiFi 2.4 GHz.
- HTTPS omite validación de certificado en el firmware actual.
- El portal de prototipo usa una clave común.
- Con LED TFT conectado a 3V3 no se puede apagar la iluminación por software.
- La app conserva simulaciones junto con datos remotos; debe quedar claro qué
  fuente está activa.
- La fuente completa 0.9.1 ya fue recuperada, integrada y compilada. El
  historial Git local sigue incompleto, por lo que un commit/release final debe
  prepararse desde una copia Git sana sin descartar el árbol actual.

## Criterio de finalización de integración

No declarar completa una versión nueva solo porque compile. Debe pasar:

1. compilación limpia;
2. carga en el ESP32;
3. monitor serie sin errores relevantes;
4. TFT y botones;
5. MAX30102 e IMU;
6. WiFi y reconexión;
7. medicamentos en ambas direcciones;
8. telemetría y eventos;
9. notificaciones;
10. regresión de funciones ya estables.

Ver `10_TESTING_STATUS.md`.
