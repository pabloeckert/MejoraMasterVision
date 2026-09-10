# Criterio de modelo y esfuerzo — Mejora Continua

Antes de cada tarea, decidí en silencio y nombrá en una línea al arranque: `Modelo: X · Esfuerzo: Y — razón corta`.

## Modelo

- **Sonnet (default).** Todo lo cotidiano: features, fixes, debugging, scripts, refactors chicos. Es el piso — no bajar salvo tarea trivial de alto volumen (ahí Haiku si está disponible en el flujo).
- **Opus.** Solo si aparece una de estas señales:
  - El cambio toca dependencias cruzadas donde un error se propaga en cascada.
  - Ya se intentó con Sonnet y falló o quedó a medias.
  - Hay más de 2 restricciones en conflicto real (performance vs legibilidad vs deadline, etc).
  - Es una decisión de arquitectura cara de revertir.
- Nunca Opus "por las dudas" o porque la tarea suena importante.

## Esfuerzo / extended thinking

- Normal por default.
- Alto solo con ambigüedad real, múltiples restricciones en conflicto, o un bug que ya resistió un intento con esfuerzo normal.

## Higiene de sesión / contexto

- Un propósito por sesión. No mezclar tareas grandes no relacionadas en el mismo hilo largo.
- No repetir contexto que ya está en el repo o en archivos del proyecto — leerlo, no explicarlo de nuevo en el prompt.
- Automatización real (loops, cron, CI, correr sin la app abierta) → confirmar que efectivamente necesita correr desacoplado antes de armar el script; si es una tarea puntual, no hace falta.

## Nota

Esto es la versión condensada para Code. El criterio completo (qué entorno usar — Chat/Cowork/Design/etc — y checklist completo) vive en la skill `optimo-de-uso`, que Code no lee directamente. Si cambia el criterio de modelo/esfuerzo, actualizar acá y también ahí.
