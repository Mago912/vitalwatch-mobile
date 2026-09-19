# VITALWATCH — UI STATUS

## Alcance

VitalWatch tiene dos interfaces:

1. TFT física de 128×128 en la pulsera;
2. aplicación móvil Expo.

La TFT prioriza legibilidad y estado inmediato. La app ofrece administración,
historial y diagnóstico más detallado.

# TFT ST7735

## Principios visuales

- fondo negro;
- texto blanco/cian;
- verde para operativo/resultado;
- amarillo para espera o advertencia;
- rojo para error, impacto o SOS;
- fuente clásica Adafruit GFX;
- tamaño 1 para información secundaria;
- tamaño 2–3 solo para datos centrales;
- una opción de menú por pantalla;
- redibujo completo solo cuando cambia la vista;
- barra/footer actualizados por regiones pequeñas.

Estado visual probado anteriormente: `WORKING — U`.  
Estado de `Interfaz.h` 0.9.0: reproducible contra `49df2d5` — F.  
Estado de `Interfaz.h` 0.9.1: fuente recuperada, prueba física pendiente — F, P.

## Distribución general

```text
┌─────────────────────┐  y=0..11: WiFi | batería | hora
│ WIFI    --%   --:-- │
├─────────────────────┤
│                     │  y=14..116: contenido
│      CONTENIDO      │
│                     │
├─────────────────────┤
│ <  OK elegir  >     │  y=117..127: ayuda/botón
└─────────────────────┘
```

La batería y hora muestran `--%` y `--:--` mientras no existan datos reales.
Esto es intencional.

## Pantallas implementadas

### 1. Splash

- corazón RGB565 centrado;
- marca “VitalWatch” en blanco/cian;
- texto “Iniciando...”;
- duración 2.8 s;
- sin barra ni footer.

Estado: `WORKING — U`.

### 2. Menú

```text
┌─────────────────────┐
│ WIFI    --%   --:-- │
│       (corazón)     │
│       SIGNOS        │
│    Pulso y SpO2     │
│         1/4         │
│ <  OK elegir  >     │
└─────────────────────┘
```

Opciones: Signos, Movimiento, Estado, Medicación.  
Estado: `WORKING — U`.

### 3. Signos vitales

Estados visibles:

- “COLOQUE EL DEDO”;
- “CALIBRANDO” + valor IR;
- “MIDIENDO” + segundos restantes;
- resultado BPM/SpO₂;
- calidad de señal;
- lectura estable/experimental;
- sensor no disponible.

Ejemplo:

```text
┌─────────────────────┐
│ WIFI    --%   --:-- │
│   SIGNOS VITALES    │
│ PULSO        SpO2   │
│  72           97%   │
│   Calidad BUENA     │
│  LECTURA ESTABLE    │
│ OK volver | OK+ test│
└─────────────────────┘
```

Estado de pantalla: `WORKING — U`.  
Estado de los valores: `EXPERIMENTAL — F`.

### 4. Movimiento

Muestra modelo IMU, fuerza en g, cambio, giro e I²C. Termina con
“Umbrales: experimental”. Si falla, muestra diagnóstico y OK largo para
reintentar.

Estado: `WORKING` como diagnóstico — F, U; caída `EXPERIMENTAL`.

### 5. Estado del equipo

Muestra:

- IMU OK/ERROR;
- MAX30102 OK/ERROR;
- WiFi OK/OFF;
- versión de firmware;
- detalle breve del primer error.

Estado: `WORKING — F, U`.

### 6. Medicación

Versión estable 0.9.0:

- estado de sincronización y posición;
- hora grande;
- nombre y dosis truncados;
- placa PENDIENTE/TOMADO;
- izquierda/derecha recorren;
- OK corto vuelve;
- OK largo confirma toma.

```text
┌─────────────────────┐
│ WIFI    --%   --:-- │
│     MEDICACION      │
│ CONECTADO 1/2       │
│       09:00         │
│ Losartan 50 mg      │
│ 1 comprimido        │
│     PENDIENTE       │
│ OK volver | OK+ toma│
└─────────────────────┘
```

Versión candidata 0.9.1 recuperada:

- guarda `fecha[11]` desde el campo `date`;
- muestra `DD/MM/YYYY` sobre la hora;
- sincroniza medicamentos cada 5 s;
- mantiene nombre, dosis y placa PENDIENTE/TOMADO.

Estado 0.9.0 anterior: `WORKING — U`.  
Estado visual 0.9.1: `NOT_TESTED — P`.

### 7. Configurar WiFi

Muestra tres pasos: red temporal, clave del portal y `192.168.4.1`. Durante el
portal se pausa la navegación normal, pero SOS conserva prioridad.

Estado: `WORKING — U`.

### 8. Alerta de impacto

- fondo rojo;
- doble borde;
- “AVISO IMPACTO DETECTADO”;
- pico en g;
- OK para cerrar;
- no se cierra sola por defecto.

UI: `WORKING — F, U`. Detección: `EXPERIMENTAL — F`.

### 9. SOS

- fondo rojo;
- “SOS ACTIVADO” grande;
- “Enviando a la app”;
- OK para cerrar.

Estado: `PARTIALLY_WORKING — F, U` hasta regresión completa de push/evento.

## Texto y caracteres

La fuente clásica no soporta UTF-8 completo. En medicamentos, el firmware
convierte vocales acentuadas y ñ a caracteres ASCII y trunca a 19 caracteres.
No asumir que se pueden imprimir emojis o Unicode directamente.

## Control remoto

La app puede solicitar `menu`, `vitals`, `movement`, `status` o `medication`.
La tarea de red guarda la orden; el loop la aplica para evitar acceso SPI desde
dos núcleos.

La orden de apagar duerme el controlador. Con LED directo a 3V3, el panel puede
seguir iluminado.

# APP MÓVIL

## Navegación implementada

- Inicio — panel y simulaciones.
- Historial — eventos.
- Medicación — CRUD, fecha/hora y estado.
- Configuración — perfil, conexión, push y control TFT.
- Sign-in — cuenta.
- Pair-device — vinculación.

La fuente entregada contiene `app/(tabs)/watch.tsx` y
`components/virtual-tft.tsx`. Implementa cinco vistas, navegación local,
actualización, confirmación de toma y envío explícito de la vista actual a la
TFT física. El snapshot pasó TypeScript y ambos archivos pasaron ESLint — F.
Estado APK: `NOT_TESTED — P`.

## Inicio

- estado grande con color;
- frecuencia cardíaca y SpO₂;
- movimiento y tendencia;
- batería;
- hora/fuente de última actualización;
- estado de notificaciones;
- actualización manual;
- botones para simular normal, caída, SOS, batería y medicación;
- últimos tres eventos.

Presión y temperatura no aparecen en Inicio, conforme a la decisión anterior.

## Historial

Lista eventos remotos y locales con tipo, descripción y fecha. El texto todavía
dice “Eventos simulados” aunque también puede contener eventos Supabase; es una
inconsistencia menor de UX.

## Medicación

- nombre, dosis, fecha `YYYY-MM-DD`, hora `HH:MM`;
- validación de fecha/hora;
- agregar, editar, eliminar lógicamente;
- marcar tomado/volver a pendiente;
- botón Actualizar;
- respaldo local si no hay red.

Estado: `WORKING — U`; la migración local de `scheduled_date` fue recuperada,
pero su despliegue remoto todavía debe verificarse — P.

## Configuración

- control y confirmación de TFT;
- selección de vista;
- advertencia de backlight;
- perfil y contacto;
- datos descriptivos de conexión;
- diagnóstico de push y versión instalada;
- abrir permisos Android;
- cerrar sesión.

La app espera confirmación ocho veces cada 750 ms, aproximadamente 6 s. El
firmware 0.9.0 puede tardar hasta 30 s; 0.9.1 consulta control cada 1 s y está
diseñado para responder dentro de esa espera. La latencia real requiere prueba.

## Autenticación

Las rutas están protegidas:

```text
sin sesión             → sign-in
con sesión, sin vínculo→ pair-device
con sesión y vínculo   → tabs
```

Estado: `WORKING — F, U`.

## Pendientes UI

- integrar la ruta Pulsera y `virtual-tft.tsx` desde la fuente entregada;
- probar APK 1.0.3 física;
- alinear espera de confirmación con el firmware elegido;
- corregir textos que todavía dicen simulación cuando hay datos remotos;
- revisar accesibilidad/tamaños en Android real;
- probar nombres/dosis largos y caracteres no ASCII en TFT;
- mantener visualmente separada una lectura experimental de una alerta real.

## DO NOT BREAK

- alto contraste y dimensiones 128×128;
- prioridad visual de SOS/impacto/portal;
- sensores activos aunque cambie la vista;
- un solo propietario de TFT/SPI;
- indicadores `--` cuando faltan datos;
- control físico disponible aunque exista control remoto;
- presión y temperatura fuera de Inicio salvo nueva decisión explícita.
