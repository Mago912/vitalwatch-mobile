# Arquitectura y bloques comentados — BIOSYS 1.0.2

## Cómo usar esta guía

Busque en el código una etiqueta como `[BIOSYS-C4]` y consulte aquí el identificador correspondiente. Las “líneas” se describen por su función ejecutable, no por número fijo, porque el número cambia al agregar comentarios. Se documentan todas las unidades lógicas; las llaves, declaraciones repetitivas y miles de bytes del bitmap no necesitan una explicación artificial por cada renglón.

## Flujo completo

```text
Botones/app ──> máquina de vistas SYS ──> TFT
     │                    │
     └──── SOS/órdenes ───┤
                          │
MAX30102 ─> PPGService ───┼─> validez ─> UI + telemetría
MPU ──────> MotionService ┼─> impacto ─> UI + evento remoto
              ▲           │
              └── I2CBusService

WiFi/NVS ─> tarea HTTPS ─> medicación/control remoto/telemetría
```

## Serie A — configuración y contratos (`Configuracion.h`)

### A1 — configuración central

- Las guardas `#ifndef/#define` impiden incluir dos veces el archivo.
- Las bibliotecas TFT aportan el tipo de pantalla y sus colores base.
- El encabezado declara que las constantes siguientes son el contrato común de BIOSYS.

### A2 — identidad de versiones

- `FAMILIA_PRODUCTO` y `VERSION_PRODUCTO` producen `VW-BIOSYS 1.0.2`.
- `FAMILIA_SISTEMA/VERSION_SISTEMA` identifican SYS 0.9.3.
- `FAMILIA_BIOMEDICA/VERSION_BIOMEDICA` identifican BIO 0.6.1.
- `VERSION_FIRMWARE` es un alias de compatibilidad; módulos SYS antiguos obtienen la versión del producto.
- Las versiones de algoritmo/calibración permiten distinguir código de producto de ajustes biomédicos.

### A3 — instrumentación BIO

- Si el compilador no define `BIO_RESEARCH_MODE`, queda en cero.
- En cero no se crea el flujo CSV de laboratorio.
- En uno, el código de investigación se activa sin mantener un segundo firmware divergente.

### A4 — semántica de calidad

- `SignalQuality` separa sin señal, pobre, aceptable y buena.
- `QualityReason` es una máscara: varias causas pueden coexistir.
- La UI, los algoritmos y la telemetría leen el mismo significado.

### A5 — TFT única

- `extern Adafruit_ST7735 tft` declara, pero no construye, la pantalla.
- La instancia real vive en `SystemState.cpp`; todos los módulos dibujan sobre el mismo objeto.
- Los temporizadores de refresco también son compartidos y evitan estados duplicados.

### A6 — estado de aplicación único

- Las variables `extern` describen modo, selección, alertas, SOS y tiempos.
- La definición única evita que cada `.cpp` tenga una copia privada.
- `picoImpactoG` transfiere la magnitud BIO a las vistas y eventos SYS.

## Serie B — estado global (`SystemState.h/.cpp`)

### B1 — salud y rendimiento

- `SystemHealth` indica si pantalla, PPG e IMU están listos y cuenta errores I²C.
- `RuntimeMetrics` guarda duración del loop y render; no altera los algoritmos.
- `inicializarEstadoSistema()` establece un punto de inicio explícito y repetible.

### B2 — definiciones únicas

- Se construye la TFT con los pines de `VitalWatchConfig`.
- Se definen una sola vez modo, índices, flags, temporizadores y métricas.
- La función de inicialización limpia estados transitorios antes de iniciar periféricos.

## Serie C — orquestador (`VitalWatch_BIOSYS_1_0_1.ino`)

### C1 — composición

- Los `#include` reúnen configuración, estado, sensores BIO y servicios SYS.
- El archivo principal coordina; no reimplementa los algoritmos.
- Los comandos Serial permiten probar sensores/eventos y ver diagnóstico.

### C2 — rearme controlado

- El comando de prueba no modifica directamente variables internas del detector.
- `rearmImpactDemo()` respeta la API BIO y limpia el evento pendiente.
- Esto reduce acoplamiento y evita saltarse el lockout por accidente.

### C3 — arranque

- Serial se inicia a 115200 y el pequeño retardo estabiliza el puerto.
- El estado compartido y los botones se inicializan primero.
- Leer OK al arrancar decide si debe borrarse/abrirse la configuración WiFi.
- SPI y TFT se inician; `displayReady=true` registra la salud de pantalla.
- Se muestra el splash antes de red y sensores para respuesta visual inmediata.

### C4 — sensores y bus únicos

- `I2CBusService::begin()` fija pines, reloj y timeout.
- `MotionService::begin()` y `PPGService::begin()` crean una sola ruta por sensor.
- Tras inicializar MAX30102 se restaura la configuración común del bus.
- La IMU se revalida/reconecta si una biblioteca alteró el bus.
- Luego arrancan WiFi, tarea de medicación, telemetría e investigación opcional.
- El mensaje READY publica producto y componentes.

### Loop cooperativo

- Primero aplica órdenes remotas en el núcleo que controla TFT.
- Después atiende botones y Serial.
- Sensores se actualizan siempre, sin depender de la vista abierta.
- Medicación, WiFi y telemetría procesan cambios sin sustituir el muestreo.
- Un posible impacto se consume una vez y se convierte en alerta/evento SYS.
- Finalmente se actualizan UI, investigación y métricas del ciclo.

## Serie D — interfaz (`Interfaz.h`)

### D1 — Estado compuesto

- Limpia solo el área de contenido.
- Dibuja BIOSYS, luego las versiones SYS y BIO.
- Informa IMU, MAX30102, WiFi, pérdidas PPG y deadlines IMU.
- No presenta un sensor “OK” si el servicio no está listo.

### D2 — Movimiento BIO

- Lee `MotionSample` y `MotionDiagnostics` sin acceder al sensor directamente.
- Muestra aceleración, giro, modelo, intervalo de muestra y saturación.
- Las unidades vienen convertidas por el servicio BIO.

### D3 — signos vitales con validez independiente

- HR solo se dibuja como número con `HeartRateStatus::VALID`.
- SpO2 solo se dibuja como número con `EXPERIMENTAL_VALID`.
- En los demás estados se usa `--` y se muestra sesión/calidad.
- Evita que falta de contacto o error aparezcan como una medición cero.

### D4 — refresco por contenido

- Temporizadores separados limitan el refresco de PPG, IMU y Estado.
- Solo se redibuja la región cambiante y se conserva el marco/navegación.
- La renderización medida alimenta los diagnósticos de rendimiento.

## Serie E/N — telemetría (`Telemetria.h`)

### E1 — validez biomédica

- Obtiene HR y SpO2 desde las APIs BIO independientes.
- Verifica estado y antigüedad antes de encolar.
- No inventa un valor sustituto cuando uno de los resultados falta.
- La muestra IMU asociada al evento procede del mismo servicio que la UI.

### N1 — cadencia y contrato

- Las constantes limitan frecuencia y antigüedad aceptable.
- La capa decide cuándo publicar; el transporte HTTPS está separado.
- Esta separación permite optimizar red sin cambiar el cálculo biomédico.

## Serie F — bus I²C (`I2CBusService.cpp`)

### F1 — configuración eléctrica

- `restoreConfig()` fija reloj y timeout conocidos.
- `begin()` asigna SDA/SCL y registra la configuración por Serial.
- Se puede repetir después de bibliotecas que cambien `Wire`.

### F2 — operaciones comprobadas

- `addressResponds()` realiza una transmisión vacía y comprueba el resultado.
- `readRegister8()` escribe dirección de registro sin STOP y solicita un byte.
- Cada fallo incrementa `systemHealth.i2cErrors`.

### F3 — recuperación

- Termina `Wire` antes de manipular pines.
- Si SDA está baja, emite hasta nueve pulsos SCL para liberar un esclavo trabado.
- Genera una condición STOP manual.
- Reconstruye siempre `Wire`, restaura el contrato y verifica SDA.

## Serie G — PPG/MAX30102 (`Sensor_Oxigeno.cpp`)

### G1 — adquisición y ventanas

- Declara dirección, corriente LED, promedio FIFO, tasa, ancho de pulso y ADC.
- La tasa efectiva esperada es 100 Hz después del promedio por cuatro.
- Umbrales separados confirman contacto y retirada con histéresis.
- Ventanas IBI y SpO2 limitan los datos que pueden considerarse.

### G2 — estado de sesión

- `HeartRateResult` y `SpO2Result` son independientes.
- Contadores de sesión, secuencia y huecos permiten auditar continuidad.
- Filtros, picos y buffers son privados; nadie externo puede alterarlos.
- `resetAlgorithms()` reinicia una medición sin necesariamente borrar el último resultado visible.

### G3 — picos

- El filtro separa componente DC/AC y rastrea envolvente/valle.
- Se comparan detector personalizado y SparkFun.
- `acceptPeak()` impone intervalo y amplitud antes de aceptar un latido.
- Los IBI recientes se agregan de forma robusta para HR.

### G4 — calidad explicable

- Comprueba contacto, timing, amplitud, huecos, estabilidad y límites.
- Acumula bits de razón para diagnóstico.
- Produce una categoría que UI y telemetría pueden interpretar consistentemente.

### G5 — SpO2 experimental

- Mantiene una ventana roja/IR y ejecuta el algoritmo MAXIM cuando está llena.
- Conserva validez y valor crudo de laboratorio.
- Aplica historia/estabilidad antes de publicar estimación experimental.
- No constituye calibración clínica.

### G6 — contacto y sesión

- Suaviza IR y exige tiempo de confirmación para entrar/salir.
- La autoganancia también puede actuar antes del contacto cuando IR supera el
  umbral de inicio; así puede ayudar a alcanzar el umbral de confirmación.
- `onContact()` abre sesión y período de estabilización.
- `onLostContact()` invalida resultados actuales y vuelve a espera.
- El autoajuste LED trabaja dentro de límites declarados.

### G7 — procesamiento único de muestra

- Registra inicio para medir costo.
- Actualiza continuidad, contacto, filtros, calidad, HR y SpO2 en orden.
- Finaliza el registro opcional de investigación.
- No realiza operaciones HTTPS ni dibuja TFT en esta ruta.

### G8 — servicio no bloqueante

- `begin()` intenta detectar/configurar MAX30102.
- `update()` llama `check()`, consume FIFO limitada y contabiliza posibles pérdidas.
- Los getters devuelven referencias de solo lectura al resultado más reciente.
- `forceReconnect()` y las funciones replay quedan detrás de una API explícita.

## Serie H — IMU (`Sensor_Movimiento.cpp`)

### H1 — contrato físico

- Registros y WHO_AM_I cubren las variantes previstas.
- Acelerómetro usa ±8 g y giroscopio ±500 °/s.
- El objetivo de muestreo es cercano a 100 Hz.
- Umbrales de posible impacto se conservan de BIO 0.6.0.

### H2 — estado y diagnóstico

- Se conserva última muestra, diagnóstico y un solo evento pendiente.
- Contadores de errores y reconexión controlan fallos persistentes.
- Magnitudes previas permiten calcular cambios bruscos.

### H3 — configuración

- Despierta el MPU y configura divisor, filtro y rangos.
- Cada escritura se verifica; un fallo evita anunciar el sensor como listo.

### H4 — adquisición e impacto

- Lee el bloque de acelerómetro, temperatura y giroscopio.
- Convierte a m/s², g y rad/s; guarda timestamp y `dt` real.
- Detecta saturación cerca del límite crudo.
- Combina magnitud, delta y giro para emitir “posible impacto”.
- Lockout evita múltiples eventos por el mismo golpe.

### H5 — identificación

- Prueba `0x68` y `0x69`.
- Lee WHO_AM_I, registra modelo y clasificación de hardware.
- No oculta una variante todavía no validada.

### H6 — servicio no bloqueante

- `update()` respeta la próxima fecha de muestreo y cuenta deadlines perdidos.
- Tras errores consecutivos marca el servicio no listo e intenta reconexión.
- `consumePossibleImpact()` entrega el evento una sola vez.
- Los getters exponen muestra/diagnóstico sin acceso I²C adicional.

## Serie I — investigación (`BioResearch.cpp`)

### I1 — registro acotado

- Solo existe cuando `BIO_RESEARCH_MODE=1`.
- `Record` captura PPG, IMU, resultados y tiempos correlacionados.
- La cola fija de ocho entradas evita asignación dinámica.
- Si se llena, incrementa `dropped` en vez de bloquear sensores.

### I2 — CSV diferido

- `buildLine()` toma una entrada y forma una línea con encabezado estable.
- `update()` consulta espacio Serial y escribe solo lo disponible.
- La salida lenta no detiene directamente la adquisición.

### I3 — API condicional

- `begin()` imprime columnas solo en investigación.
- `logPPG()` encola o se convierte en no-op en producto.
- `droppedRecords()` hace visible la pérdida de instrumentación.

## Serie J — botones (`Botones.h`)

- Define pines con `INPUT_PULLUP`: reposo HIGH, pulsado LOW.
- Cada botón tiene lectura cruda, estado estable, cambio e inicio de pulsación.
- El antirrebote exige estabilidad antes de emitir.
- OK largo y combinación izquierda+derecha tienen temporizadores distintos.
- La combinación SOS se emite una sola vez hasta soltar.

## Serie K — WiFi (`Configuracion_WiFi.h`)

- Guarda SSID/clave en NVS, no en el sketch público.
- Si no conecta, crea portal cautivo VitalWatch-Setup.
- DNS y servidor web permiten seleccionar otra red desde el móvil.
- El procesamiento ocurre incrementalmente desde el ciclo principal.

## Serie L — control remoto (`Control_Remoto.h`)

- Traduce cadenas remotas a una enumeración cerrada de vistas.
- La tarea de red solo deja una orden pendiente.
- El loop dueño de TFT aplica la orden, evitando SPI desde dos núcleos.
- Mantiene último estado para informar a la app.
- Compara `commandAt` y aplica cada orden de vista una sola vez.
- Una navegación física posterior prevalece y se reporta a Supabase.
- Recibe una entrada virtual `OK` separada de las órdenes de vista.
- El loop solo aplica ese OK a una alerta activa y confirma después su procesamiento.
- Reporta `none`, `fall` o `sos` para que la app no dependa de un evento histórico.

## Serie M — medicación/red (`Sincronizacion_Medicacion.h`)

- Define estructuras de medicamentos, acciones y eventos.
- La tarea separada ejecuta HTTPS para no bloquear PPG/IMU.
- Las colas desacoplan producción de eventos del transporte.
- Timeouts y límites de cantidad evitan crecimiento sin cota.
- La configuración privada aporta URL, token e identidad del dispositivo.

## Recurso visual (`LogoVitalWatch.h`)

- Contiene un arreglo constante de píxeles usado por el splash.
- Cada valor representa color, no una instrucción ejecutable.
- Puede comprimirse o simplificarse en una versión SYS futura, verificando primero el ahorro real y el costo de descompresión.
