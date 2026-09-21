# Hoja de ruta VitalWatch

Estado de referencia: app 1.0.12, firmware BIOSYS 1.0.9 y Supabase remoto.
VitalWatch es un prototipo escolar y no reemplaza un dispositivo medico.

## 1. Medicacion y responsables

Estado: implementado en software.

- Varios horarios diarios para un mismo medicamento.
- Recordatorio normal a la hora programada.
- Telegram al responsable si pasan 15 minutos sin confirmar la toma.
- Telegram cuando la toma se confirma desde la app o la pulsera.
- Eventos unicos para evitar mensajes repetidos.

Prueba pendiente: instalar la app 1.0.12 y comprobar dos horarios reales durante
un dia completo con el ESP32 conectado y desconectado de Internet.

## 2. Avisos de signos vitales

Estado: implementado, pero experimental y pendiente de validacion fisica.

Supabase ya exige tres lecturas consecutivas dentro de 30 segundos antes de
crear una alerta. Usa por ahora estos rangos de demostracion:

- frecuencia cardiaca menor a 50 o mayor a 110 lpm;
- SpO2 menor a 92%;
- espera de 10 minutos antes de repetir el mismo tipo de alerta.

Las alertas confirmadas llegan por Telegram aunque la app este cerrada. Antes de
usar esta funcion con una persona se deben comparar las mediciones contra un
dispositivo de referencia y conservar solamente lecturas con contacto y calidad
validos. Nunca se deben completar lecturas ausentes con valores simulados.

## 3. Calibracion del MAX30102

Estado: en curso.

1. Registrar reposo con dedo estable durante 2 a 3 minutos.
2. Repetir con distintas presiones y posiciones del dedo.
3. Comparar BPM y SpO2 contra un oximetro comercial, anotando la hora.
4. Medir cuantos resultados se rechazan por mala calidad, movimiento o falta de
   contacto.
5. Ajustar filtros solo despues de revisar varias sesiones, no una sola lectura.

Criterio para avanzar: valores estables, ausencia de numeros al retirar el dedo
y diferencias repetibles documentadas frente al equipo de referencia.

## 4. Calibracion de caidas con MPU6500

Estado: detector secuencial implementado; umbrales todavia experimentales.

BIOSYS 1.0.9 ya combina impacto, 1.5 segundos de estabilizacion, 3 segundos de
inmovilidad y una cuenta regresiva cancelable de 10 segundos. El problema
pendiente es calibrar sus umbrales con datos del MPU6500 real para que un golpe
de mesa no termine confirmado como caida.

Orden de trabajo:

1. Mantener BIOSYS 1.0.9 normal como firmware de referencia.
2. Cargar temporalmente BIOSYS 1.0.9 en modo research.
3. Capturar sesiones etiquetadas: quieto, caminar, sentarse, acostarse, mover el
   brazo, apoyar la pulsera, golpe leve, golpe fuerte y caida de un objeto sobre
   espuma.
4. No realizar caidas intencionales con una persona.
5. Comparar pico, delta, giro, postura e inmovilidad entre actividades.
6. Crear BIOSYS 1.0.10 candidato con umbrales obtenidos de esos datos.
7. Probar que OK fisico y OK remoto cancelan la misma cuenta regresiva.
8. Instalar 1.0.10 solo despues de compilar y pasar las pruebas controladas.

Comandos de laboratorio:

```powershell
npm run firmware:ports
npm run firmware:biosys:research:upload -- -Port COM3
powershell -ExecutionPolicy Bypass -File scripts/capture-biosys-research.ps1 `
  -Port COM3 -DurationSeconds 120 -Label caminar
```

Cada actividad debe tener su propia etiqueta. Las capturas quedan en
`measurements/biosys-1.0.9/` y no se suben a GitHub.

## 5. Funcionamiento sin Internet o sin luz

Estado: parcialmente implementado.

- El ESP32 conserva caidas y SOS en una cola persistente y los reenvia cuando
  vuelve Internet.
- Supabase marca la pulsera sin comunicacion cuando deja de recibir datos.
- La bateria interna debe sostener el sistema ante un corte de luz.

Pendiente fisico: terminar el circuito de alimentacion, medir autonomia real y
agregar lectura de bateria mediante divisor seguro a un pin ADC1. Nunca conectar
la LiPo directamente a un GPIO.

## Proximo hito recomendado

El siguiente hito es una jornada de captura, no un cambio de umbrales:

1. cinco sesiones del MAX30102 con referencia externa;
2. las actividades normales del MPU6500;
3. golpes y caidas controladas de un objeto sobre espuma;
4. analisis de falsos positivos;
5. preparacion de BIOSYS 1.0.10 candidato.
