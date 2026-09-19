# VITALWATCH — SYS/BIO VERSIONING

La comparación de 2026-09-01 confirmó que las líneas no son equivalentes:

- `VW-SYS 0.9.1`: firmware integral conectado, integrado y compilado;
- `VW-BIO 0.6.0`: perfil separado de sensores/algoritmos/research, compilado;
- `VW-SYS 0.9.0`: fallback estable históricamente probado;
- `VitalWatch_FW_0_6_0`: sistema histórico de medicación, no VW-BIO.

No afirmar que SYS incorpora BIO hasta realizar dataset/replay y regresión
física. El informe completo está en:

```text
docs/VITALWATCH_INTEGRACION_VW_SYS_0_9_1_VW_BIO_0_6_0.md
```

Builds finales:

| Objetivo | Flash | RAM | Estado |
|---|---:|---:|---|
| VW-SYS 0.9.1 | 1.158.620 B | 53.536 B | PASS software |
| VW-BIO normal | 351.384 B | 26.260 B | PASS software |
| VW-BIO research | 353.232 B | 30.052 B | PASS software |
| VW-BIO research+replay | 370.476 B | 30.180 B | PASS software |

Hardware y exactitud biomédica siguen pendientes.
