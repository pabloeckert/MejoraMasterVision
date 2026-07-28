# MasterVision

Panel de análisis directo: chat con Claude, proyecciones estadísticas simples e infografías/gráficos, y una calculadora de teoría de juegos (equilibrio de Nash en estrategias puras). Pensado para consultas puntuales de negocio y estrategia, con un espacio separado de notas de familia que solo se carga a mano — el sitio nunca recolecta datos automáticamente de terceros ni de menores.

**Frontend** (`/docs`): sitio estático publicado con GitHub Pages. Corre sin backend para Proyecciones y Teoría de juegos.

**Backend** (`/worker`): Cloudflare Worker que hace de proxy seguro hacia la API de Claude (así la API key nunca queda expuesta en el navegador) y guarda la memoria de conversaciones en Cloudflare KV.

## Por qué hace falta un backend

GitHub Pages solo sirve archivos estáticos, no puede ejecutar código con secretos. Si el chat llamara a la API de Claude directo desde el navegador, tu API key quedaría visible en el código fuente del sitio — cualquiera podría copiarla y gastar tu cuota. El Worker resuelve esto: la key vive como secret del lado del servidor, y el frontend solo habla con el Worker.

Como el repo y el sitio son públicos, el Worker además exige una clave de sitio (`SITE_KEY`) por header en cada request, para que nadie más que vos pueda usar tu chat (y tu cuota de API).

## Setup

### 1. Conseguir una API key de Anthropic

1. Entrá a [console.anthropic.com](https://console.anthropic.com), creá una API key.
2. Configurá un límite de gasto (spend limit) en la consola — recomendado, para que un uso inesperado no te sorprenda en la factura.

### 2. Desplegar el Worker

Requiere [Node.js](https://nodejs.org) y una cuenta gratuita de Cloudflare.

```bash
cd worker
npm install
npx wrangler login

# Crear el namespace de KV para memoria
npx wrangler kv namespace create MEMORY_KV
# Copiá el "id" que te devuelve y pegalo en wrangler.toml, en kv_namespaces

# Cargar los secrets (no van en el repo)
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put SITE_KEY   # inventá una clave larga, es la que vas a poner en el sitio

# (Opcional) editar wrangler.toml:
#  - ALLOWED_ORIGIN: tu URL real de GitHub Pages (ej: https://pabloeckert.github.io)
#  - MODEL: modelo de Claude a usar (por defecto claude-sonnet-5)

npm run deploy
```

Al terminar, `wrangler` te da la URL del worker (algo como `https://mastervision-worker.<tu-cuenta>.workers.dev`).

### 3. Configurar el frontend

1. Entrá al sitio publicado en GitHub Pages.
2. Pestaña **Configuración** → pegá la URL del worker → Guardar.
3. Al abrir el chat por primera vez, te va a pedir la **clave del sitio** (la que configuraste como `SITE_KEY`). Se guarda solo en tu navegador (localStorage).

### 4. Publicar el sitio (GitHub Pages)

En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / carpeta `/docs`**.

## Estructura

```
docs/            # frontend estático (GitHub Pages)
  index.html
  styles.css
  app.js
worker/          # backend (Cloudflare Worker)
  src/index.js
  wrangler.toml
  package.json
```

## Límites por diseño

- El modelo no inventa credenciales clínicas ni diagnostica a personas reales (reglas fijas en el `system prompt` del Worker, no editables desde el frontend).
- Con menores de edad, el modelo solo puede sugerir preguntas para que el adulto se las haga directamente — nunca inferir o "diagnosticar" su estado interno.
- Marcos simbólicos (BaZi, astrología) solo se usan si se piden explícitamente, y siempre aclarados como tales, no como dato verificado.
- La memoria de "familia" guarda únicamente lo que el usuario carga a mano (notas manuales) y las conversaciones que el propio usuario tuvo con el chat — nunca datos recolectados de otras personas sin que lo sepan.
