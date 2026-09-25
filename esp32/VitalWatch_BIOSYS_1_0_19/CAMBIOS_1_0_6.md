# VitalWatch BIOSYS 1.0.6

Parte de la version fisicamente validada BIOSYS 1.0.5 y no modifica BIO 0.6.3.

Cambios funcionales:

- un impacto ya no se publica directamente como caida;
- espera 1,5 s de estabilizacion y exige 3 s de inmovilidad dentro de una
  ventana total de 8 s;
- despues muestra una cuenta regresiva de 15 s;
- OK fisico o remoto cancela antes del envio;
- al finalizar la cuenta confirma la caida y encola el evento;
- caidas y SOS se conservan en NVS si no hay Internet;
- se guardan hasta ocho eventos y se reintentan al volver la conexion;
- cada evento tiene un identificador para impedir duplicados en Supabase.
- cuando NTP ya esta disponible, el evento conserva la hora en que ocurrio
  aunque se entregue despues de recuperar Internet.

Los tiempos y umbrales son experimentales. Deben calibrarse con pruebas
controladas y no constituyen una validacion medica.

Estado actual: fuente creada y compilacion aprobada. Todavia no fue cargada ni
probada fisicamente en el ESP32.
