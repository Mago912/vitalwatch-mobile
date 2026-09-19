# VitalWatch BIOSYS 1.0.5

Esta version parte de BIOSYS 1.0.4 y conserva sin cambios los algoritmos
biomedicos BIO 0.6.3.

Cambios funcionales:

- una pulsacion larga de OK en Medicacion alterna entre `TOMADO` y `PENDIENTE`;
- Supabase informa `reminderDue` cuando llega el horario de una toma pendiente;
- la TFT abre automaticamente el medicamento y muestra `HORA DE TOMAR`;
- queda preparada `activarAvisoMedicacionHardware()` para integrar el motor
  vibrador cuando se definan transistor, diodo de proteccion y GPIO;
- SYS avanza a 0.9.5 y la app compatible a 1.0.6.

La version 1.0.4 permanece como respaldo fisicamente probado. BIOSYS 1.0.5
debe compilarse, cargarse y probarse en el ESP32 antes de declararla validada.
