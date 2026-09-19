# CODEX REPRODUCTION TESTS

Estas pruebas fueron creadas independientemente a partir del baseline exacto y
los documentos de hallazgos. No son los tests originales de Cowork y no
afirman equivalencia con `FINAL_BIOMED_CANDIDATE`, que está `NOT_AVAILABLE`.

Ejecutar desde la raíz del laboratorio:

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
```

La primera clase reproduce el comportamiento defectuoso del baseline. La
segunda define el contrato esperado para la corrección experimental.

`test_analyze_reference.py` verifica que una medicion inestable o de calidad
baja nunca sea promovida como resultado comparable con el pulsioximetro.
