# Reporte de auditoría — MejoraMasterVision

Fecha: 2026-09-10

## Resumen ejecutivo

Repo sano: sitio estático (`docs/`) + Cloudflare Worker (`worker/`) que actúa de proxy de la API de Claude. Sin secretos trackeados en git, sin basura, sin `node_modules` trackeado, sin duplicados. README y docs consistentes con el estado real del código.

## Hallazgos por severidad

- **Media**: `npm audit` en `worker/` reporta 3 vulnerabilidades altas, todas en la misma cadena transitiva (`sharp` ← `miniflare` ← `wrangler`), solo como devDependency de desarrollo local. Ya está instalada la última versión de `wrangler` (4.130.0) y no hay fix disponible todavía upstream — no accionable por ahora.
- **Media**: `wrangler.toml` trae `ALLOWED_ORIGIN = "*"` por defecto. Está mitigado por el gate `SITE_KEY`, pero conviene fijarlo al dominio real antes del próximo deploy.
- **Baja**: no había `package-lock.json` versionado en `worker/`; se generó al instalar dependencias para poder auditar, queda sin commitear.
- **Baja**: no hay scripts de lint/test en el worker — no crítico, es JS plano y chico.

## Acciones tomadas

- Se instalaron dependencias en `worker/` para poder correr `npm audit` (generó `worker/package-lock.json`, sin commitear).
- No se tocó código ni configuración de producción.
- Se actualizó la fila de MejoraMasterVision en `C:\Github\AUDITORIA.md`.

## Cambio preexistente detectado (no realizado por esta auditoría)

`CLAUDE.md` del repo ya estaba modificado antes de que arrancara esta auditoría: pasó de describir "repo vacío" a contener el criterio global de modelo/esfuerzo de Mejora Continua. Se dejó tal cual estaba, sin commitear.

## Pendientes que requieren decisión humana

1. Revertir o conservar el `CLAUDE.md` modificado (cambio preexistente, no relacionado con esta auditoría).
2. Fijar `ALLOWED_ORIGIN` real en `wrangler.toml` antes del próximo deploy.
3. Decidir si commitear `worker/package-lock.json` (generado en esta auditoría).
4. Las 3 vulnerabilidades altas transitivas de `sharp`/`miniflare` no tienen fix disponible upstream — monitorear futuras versiones de `wrangler`.
