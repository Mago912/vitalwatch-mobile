# Glosario del laboratorio VitalWatch

## RAW

**Definición sencilla:** números originales recibidos del sensor.  
**Definición técnica:** muestras RED/IR antes del procesamiento biomédico.  
**Por qué importa:** permiten repetir el análisis sin volver a medir.

## FIFO

**Definición sencilla:** fila temporal de mediciones.  
**Definición técnica:** cola First-In, First-Out de hardware o software.  
**Por qué importa:** al llenarse puede perder muestras.

## Buffer circular

**Definición sencilla:** casilleros reutilizados en círculo.  
**Definición técnica:** arreglo fijo con índices de escritura y lectura.  
**Por qué importa:** necesita distinguir lleno de vacío.

## Sample / muestra

**Definición sencilla:** una medición RED/IR.  
**Definición técnica:** registro óptico adquirido en un intervalo configurado.  
**Por qué importa:** es la unidad básica del archivo RAW.

## Sample rate

**Definición sencilla:** cuántas mediciones se producen por segundo.  
**Definición técnica:** frecuencia de muestreo expresada en Hz.  
**Por qué importa:** determina el intervalo temporal y los BPM observables.

## Averaging

**Definición sencilla:** promedio de varias conversiones.  
**Definición técnica:** decimación con promedio realizada por el MAX30102.  
**Por qué importa:** 100 Hz/AVG4 produce aproximadamente 25 registros/s.

## Timestamp

**Definición sencilla:** hora asignada a un dato.  
**Definición técnica:** contador monotónico en microsegundos.  
**Por qué importa:** sin tiempo fiable, un IBI y su BPM pueden ser incorrectos.

## Rollover

**Definición sencilla:** el contador llega al máximo y vuelve a cero.  
**Definición técnica:** overflow modular de un entero de 32 bits.  
**Por qué importa:** puede hacer que el tiempo parezca retroceder.

## Overflow / underflow

**Definición sencilla:** overflow supera capacidad; underflow intenta retirar
algo inexistente.  
**Definición técnica:** desbordamiento o agotamiento de cola/número.  
**Por qué importa:** ambos deben registrarse, nunca ocultarse como RAW.

## I2C

**Definición sencilla:** conexión de dos cables para hablar con sensores.  
**Definición técnica:** bus síncrono SDA/SCL con direcciones.  
**Por qué importa:** una lectura corta puede corromper una muestra.

## ADC y clipping

**Definición sencilla:** ADC transforma luz en número; clipping ocurre cuando
el número alcanza el límite.  
**Definición técnica:** conversión analógico-digital y saturación de rango.  
**Por qué importa:** una onda recortada puede generar falsos eventos.

## Latencia y jitter

**Definición sencilla:** demora y variación de la demora.  
**Definición técnica:** diferencia y dispersión entre adquisición y servicio.  
**Por qué importa:** alteran la asociación temporal si no se separan.

## Queue / cola

**Definición sencilla:** fila de datos pendientes.  
**Definición técnica:** estructura FIFO entre productor y consumidor.  
**Por qué importa:** desacopla el sensor del envío Serial.

## Heap

**Definición sencilla:** memoria disponible durante la ejecución.  
**Definición técnica:** región dinámica del sistema.  
**Por qué importa:** se medirá su mínimo para detectar presión de memoria.

## Backpressure y throughput

**Definición sencilla:** backpressure aparece cuando llegan datos más rápido
de lo que salen; throughput es la cantidad transmitida por segundo.  
**Definición técnica:** presión del consumidor y caudal de datos.  
**Por qué importa:** el logger debe descartar y contar antes que frenar PPG.

## PPG

**Definición sencilla:** onda óptica asociada al pulso.  
**Definición técnica:** fotopletismografía reflectiva RED/IR.  
**Por qué importa:** es la señal de entrada para HR y SpO2 experimental.

## IBI y BPM

**Definición sencilla:** IBI es tiempo entre pulsos; BPM son pulsos por minuto.  
**Definición técnica:** BPM ≈ 60.000/IBI en milisegundos.  
**Por qué importa:** un timestamp incorrecto produce BPM incorrecto.

## SpO2 y AC/DC

**Definición sencilla:** SpO2 intenta estimar saturación; AC es variación
pulsátil y DC nivel medio.  
**Definición técnica:** estimación basada en la relación normalizada RED/IR.  
**Por qué importa:** no debe considerarse clínica sin calibración y validación.
