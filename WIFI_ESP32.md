# Configurar WiFi en la pulsera VitalWatch

Los firmwares 0.9.0 y 0.9.1 permiten configurar el WiFi desde un celular. Ya no es
necesario escribir la red y la contrasena en el codigo cada vez que la pulsera
cambia de casa.

## Primera configuracion

1. Enciende la pulsera.
2. Si no conoce una red, la TFT mostrara `CONFIGURAR WIFI`.
3. En el celular, abre la configuracion de WiFi.
4. Conectate a `VitalWatch-VW-001`.
5. Escribe la clave `VitalWatch123`.
6. El portal puede abrirse automaticamente. Si no aparece, abre el navegador y
   entra en `http://192.168.4.1`.
7. Selecciona el WiFi donde funcionara la pulsera.
8. Escribe su contrasena y toca `Guardar y conectar`.
9. La red temporal desaparecera y la pulsera se conectara al WiFi elegido.

El ESP32 clasico funciona con redes de 2.4 GHz. Si el router separa las bandas,
selecciona la red de 2.4 GHz.

## Uso diario

La red queda guardada en NVS, una memoria interna que conserva datos aunque se
apague la pulsera o se actualice el firmware. En los siguientes arranques,
VitalWatch intenta conectarse automaticamente.

Si el router tarda en iniciar, el ESP32 sigue intentando la red conocida. Si no
puede usarla, vuelve a mostrar el portal para permitir otra configuracion.

## Cambiar de casa o de router

1. Apaga la pulsera.
2. Manten presionado el boton OK.
3. Enciende o reinicia el ESP32 sin soltar OK.
4. Cuando aparezca la configuracion WiFi, suelta el boton.
5. Repite los pasos de la primera configuracion.

Mantener OK durante el arranque borra solamente el nombre y la contrasena WiFi.
No elimina medicamentos, la vinculacion con Supabase ni el token del dispositivo.

## Red de respaldo opcional

`npm run firmware:configure` permite guardar una red dentro del archivo local
`vitalwatch_config.h`. Se conserva para migrar instalaciones anteriores, pero no
es necesario para el portal. El archivo esta ignorado por Git.

## Seguridad

- La contrasena del hogar se guarda en la NVS del ESP32.
- No se envia a Supabase ni a la aplicacion VitalWatch.
- El formulario usa HTTP porque funciona dentro de la red temporal local del
  ESP32. La red temporal esta protegida con clave y se apaga al terminar.
- El portal es apropiado para este prototipo escolar. Un producto comercial
  deberia usar credenciales unicas por pulsera y proteccion fisica adicional.

## Comandos

```powershell
npm run firmware:setup
npm run firmware:build
npm run firmware:ports
npm run firmware:upload
npm run firmware:monitor
```

La carga valida Supabase y el token del dispositivo, pero ya no obliga a dejar
una contrasena WiFi escrita en el firmware.
