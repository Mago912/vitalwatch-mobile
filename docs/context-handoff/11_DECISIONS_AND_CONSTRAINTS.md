# VITALWATCH — DECISIONS AND CONSTRAINTS

## Decisiones vigentes

### 1. No reescribir desde cero

VitalWatch ya tiene flujos físicos y backend funcionales. Los cambios deben ser
incrementales, pequeños y reversibles.

### 2. El código actual tiene prioridad

La documentación puede estar adelantada o desactualizada. Si contradice el
código, registrar `CONTEXT CONFLICT`; no alterar automáticamente el código para
que coincida con el texto.

### 3. Compilar no equivale a funcionar

Cada versión de hardware necesita compilación, carga, monitor serie y regresión
física. No declarar integración completa antes.

### 4. Algoritmos biomédicos separados de funciones de producto

Cambios en WiFi, UI, medicamentos, Auth o control TFT no autorizan cambios en
filtros/umbrales de MAX30102 o IMU. Los algoritmos requieren evidencia del
Biomedical Algorithms Lab.

### 5. Lenguaje honesto

Usar “experimental”, “posible impacto” y “lectura no válida” cuando corresponda.
No usar afirmaciones de precisión clínica.

### 6. Sensores continuos

MAX30102 e IMU deben seguir procesándose con independencia de la vista TFT y de
la red.

### 7. Red fuera del camino crítico

HTTPS se mantiene en la tarea FreeRTOS separada. No introducir solicitudes
bloqueantes en `loop()`.

### 8. Un propietario de la TFT

Solo el núcleo/loop de UI toca SPI/TFT. La tarea de red comunica órdenes mediante
estado pendiente.

### 9. Prioridad local y de seguridad

SOS, impacto, botones físicos y portal WiFi tienen prioridad sobre control
remoto. Una pantalla dormida debe poder despertar para esos eventos.

### 10. No inventar datos

Sin señal válida, usar nulo o `--`. Sin circuito ADC, no fabricar batería.

### 11. WiFi configurable por usuario

El flujo principal es portal + NVS. SSID/contraseña compilados son solo respaldo
de migración. ESP32 clásico requiere 2.4 GHz.

### 12. UI diseñada para 128×128

Conservar texto corto, alto contraste, límites de caracteres y regiones fijas.
No trasladar un diseño móvil a la TFT sin adaptar.

### 13. Código educativo y sencillo

Preferir módulos claros, comentarios útiles y flujo rastreable. Evitar
abstracciones grandes sin beneficio medible.

### 14. Android primero; iOS pospuesto

No asumir que push o UI iOS funcionan. Tratarlo como una etapa separada.

### 15. Secretos fuera del repositorio

Nunca publicar `.env.local`, secretos Supabase, WiFi, token de dispositivo,
pairing code ni `vitalwatch_config.h`.

## Restricciones de cambios

| Área | Restricción |
| --- | --- |
| GPIO | cambiar solo con diagrama y prueba física |
| librerías | conservar versiones salvo problema demostrado |
| sensores | no modificar durante tareas no biomédicas |
| Supabase | migraciones reproducibles; no editar producción a mano sin registrar |
| RLS/Auth | prueba negativa y positiva obligatoria |
| push | probar con APK física Android |
| firmware | nueva carpeta/version, sin destruir históricas |
| Git | no reset/clean sobre árbol actual |
| documentación | distinguir fuente recuperada, integración y prueba física |

# DO NOT BREAK

- boot y splash de la TFT;
- configuración ST7735 `INITR_144GREENTAB` y rotación vigente;
- cableado SPI e I²C confirmado;
- botones GPIO 25/26/27 con `INPUT_PULLUP`;
- gesto SOS y OK largo contextual;
- procesamiento continuo de PPG/IMU;
- recuperación/revalidación del bus I²C;
- portal WiFi, NVS y reset de red con OK en boot;
- flujo app → Supabase → TFT → tomado → app;
- token separado del ESP32 y RLS por usuario;
- datos inválidos como nulos;
- prioridad de alertas sobre pantalla remota;
- un solo propietario de SPI/TFT;
- push Android ya funcional;
- presión y temperatura fuera del panel principal;
- versiones históricas conservadas.

# DO NOT ASSUME

- no confundir `VW-SYS 0.9.1` integrado con `VW-BIO 0.6.0`; son ejes separados;
- no asumir que `0.9.1` funciona físicamente porque su fuente esté completa;
- no asumir que el árbol 0.9.0 actual es el binario probado, aunque su fuente coincida con `49df2d5`;
- no asumir historial Git sano;
- no asumir MPU6050; leer `WHO_AM_I`;
- no asumir exactitud médica;
- no asumir prueba física a partir de compilación;
- no asumir batería o backlight controlable sin circuito;
- no asumir WiFi 5 GHz;
- no asumir que Expo Go prueba push nativo;
- no asumir iOS;
- no asumir que datos de contacto envían SMS/correo;
- no asumir que una orden TFT falló solo porque la app dejó de esperar a los 6 s;
- no asumir que las migraciones locales reconstruyen el Supabase remoto actual;
- no asumir que un archivo generado/binario es fuente de verdad.

## Manejo de una nueva versión

Para integrar `0.9.1` o crear `0.9.2` o posterior:

1. identificar la fuente exacta de partida;
2. guardar hash y resultado de regresión;
3. preservar `0.9.0` y usar la carpeta 0.9.1 recuperada sin reescribirla;
4. actualizar versión interna, scripts y documentación juntos;
5. nunca dejar scripts apuntando a una carpeta que no esté incluida en el baseline;
6. registrar flash/RAM;
7. probar físicamente antes de marcar estable.

## Seguridad mínima

- una Publishable key puede estar en la app, nunca una Secret/Service Role;
- el token de dispositivo solo en config local/NVS segura según diseño;
- no imprimir tokens en Serial o documentación;
- mantener comparación de hashes y validación de payloads;
- preservar pruebas de acceso anónimo, token incorrecto y usuario ajeno;
- reemplazar `setInsecure()` antes de un entorno no controlado;
- usar credenciales únicas de portal en un producto real.

## Cambios que requieren coordinación externa

- parámetros BPM/SpO₂/caída: Biomedical Algorithms Lab;
- divisor de batería/backlight: revisión de hardware/power;
- cambios RLS/webhooks: responsable Supabase/security;
- publicación APK: cuenta EAS/Firebase correspondiente;
- iOS: credenciales Apple y plan específico.
