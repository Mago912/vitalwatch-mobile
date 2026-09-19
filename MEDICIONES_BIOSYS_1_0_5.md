# Mediciones para BIOSYS 1.0.5

El objetivo es mejorar pulso y SpO2 con registros reales del MAX30102 y la IMU. Estos datos son
experimentales y no sirven para diagnostico medico.

## 1. Cargar el modo de investigacion

Con el ESP32 conectado, identifica el puerto y carga BIOSYS 1.0.4 con salida CSV:

```powershell
npm run firmware:ports
npm run firmware:biosys:research:upload -- -Port COM3
```

Si aparece `Wrong boot mode`, manten presionado `BOOT`, inicia nuevamente la carga y soltalo cuando
comience a escribir.

## 2. Capturar sesiones

En cada sesion manten la mano apoyada, el dedo quieto y una presion similar sobre el sensor.

```powershell
npm run firmware:biosys:capture -- -Port COM3 -DurationSeconds 90 -Label reposo-dedo-1
npm run firmware:biosys:capture -- -Port COM3 -DurationSeconds 90 -Label reposo-dedo-2
npm run firmware:biosys:capture -- -Port COM3 -DurationSeconds 90 -Label sin-dedo
npm run firmware:biosys:capture -- -Port COM3 -DurationSeconds 90 -Label movimiento-suave
```

Los archivos quedan en `measurements/biosys-1.0.4/`. Cada CSV tiene un JSON con puerto, duracion,
etiqueta y cantidad de registros.

## 3. Restaurar el firmware normal

Al terminar, vuelve a instalar el firmware que usa la pulsera normalmente:

```powershell
npm run firmware:biosys:upload -- -Port COM3
```

No crear BIOSYS 1.0.5 hasta revisar las sesiones y documentar que parametros cambian, por que se
cambian y que prueba fisica valida el resultado.
