# Protocolo de referencia para el MAX30102

Este protocolo sirve para comparar VitalWatch con un pulsioximetro comercial.
No convierte el proyecto en un dispositivo medico ni reemplaza una validacion
clinica.

## Preparacion

1. Mantener BIOSYS 1.0.8 y el laboratorio separados.
2. Sentar a la persona y esperar cinco minutos en reposo.
3. Usar manos tibias, sin esmalte y sin apretar el MAX30102.
4. Colocar el pulsioximetro y el MAX30102 al mismo tiempo, preferentemente en
   dedos distintos de la misma mano.
5. Anotar sujeto anonimo, posicion, dedo, dispositivo de referencia y cualquier
   movimiento. No guardar nombre, telefono ni otra informacion personal.

## Captura recomendada

Desde la carpeta del laboratorio:

```powershell
python tools/capture_biomed.py --list-ports
python tools/capture_biomed.py --port COM3 --mode FULL --test-id reposo_ref_01 --subject-id P001
```

Durante dos minutos, leer el pulsioximetro cada diez segundos y escribir
inmediatamente ambos valores:

```text
BIO REF HR 72
BIO REF SPO2 98
```

Registrar tambien cambios importantes:

```text
BIO MARK dedo_colocado
BIO MARK movimiento_involuntario
BIO MARK dedo_retirado
STOP
```

Realizar como minimo tres sesiones de reposo. Luego hacer sesiones separadas
con movimiento leve para comprobar que el algoritmo rechaza el artefacto en
lugar de mostrar un numero confiable.

## Analisis

```powershell
python tools/analyze_reference.py RAW\CARPETA_DE_LA_SESION
```

Se generan:

- `reference_comparison.csv`: comparacion individual de cada referencia.
- `reference_summary.json`: cobertura y errores resumidos.

El analizador solo usa valores con estado valido y calidad `GOOD` o `FAIR`.
Los valores `UNSTABLE`, `POOR` o ausentes quedan documentados, pero nunca se
promueven ni se reemplazan por un valor aparentemente normal.

## Puerta provisoria para BIOSYS 1.0.9

Antes de copiar cambios al firmware de producto se necesita:

1. Adquisicion sin huecos, duplicados ni drops.
2. Al menos diez referencias comparables por sesion.
3. Tres sesiones de reposo repetibles.
4. Cobertura suficiente: la mayoria de referencias debe tener una lectura
   confiable cercana.
5. Como objetivo escolar inicial, error absoluto medio de hasta 5 BPM y hasta
   2 puntos de SpO2. Esto es un criterio de ingenieria, no clinico.
6. Las sesiones con movimiento deben producir rechazo o baja calidad, no
   valores falsamente confiables.

Si falla un criterio, se conserva el dataset y se corrige el algoritmo. No se
recortan valores ni se fuerzan promedios hacia rangos normales.
