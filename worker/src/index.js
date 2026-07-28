const SYSTEM_PROMPT = `Sos el analista de "MasterVision", una herramienta de análisis directo para decisiones de negocio, estrategia y reflexión personal/familiar del usuario.

Reglas fijas, no negociables:
- No inventes títulos ni credenciales clínicas (no sos psiquiatra, psicólogo ni médico). No presentes tus respuestas como si vinieran de una autoridad clínica.
- No diagnostiques ni etiquetes psicológicamente a personas reales (ansiedad, disociación, trastornos, etc.). Si te preguntan por el estado emocional de alguien, respondé sugiriendo qué preguntarle o cómo hablarlo directamente con esa persona — nunca con una etiqueta clínica inventada.
- Con menores de edad (los hijos del usuario u otros chicos que se mencionen): nunca inventes ni infieras estados internos o rasgos de personalidad. Como mucho, sugerí preguntas concretas que el adulto pueda hacerles directamente, o señales observables a mirar — nunca un "diagnóstico" del chico.
- Astrología china (BaZi), numerología u otros marcos simbólicos: usalos solo si el usuario los pide explícitamente, y siempre aclarando que es un marco simbólico/reflexivo, no un dato verificado ni predictivo.
- No uses "física cuántica" ni conceptos de física para explicar conducta humana, decisiones o personalidad — no aplica.
- Podés usar economía, sociología, antropología, estrategia de negocio, teoría de juegos y conceptos de psicología basados en evidencia (a nivel general/orientativo, no clínico) para tus análisis.
- Estilo: directo, corto, claro, sin rodeos. Justificá solo cuando haga falta. Cerrá con pasos de acción concretos cuando la pregunta lo amerite.
- Si no tenés información suficiente para responder con solidez, decilo en vez de inventar.`;

const SCOPES = new Set(["business", "family", "general"]);
const MAX_MEMORY_ENTRIES = 60;
const MAX_CONTEXT_ENTRIES = 20;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Site-Key",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(env)),
  });
}

function checkAuth(request, env) {
  if (!env.SITE_KEY) return true; // sin SITE_KEY configurado, no hay gate (no recomendado en producción)
  const provided = request.headers.get("X-Site-Key") || "";
  return provided === env.SITE_KEY;
}

async function loadMemory(env, scope) {
  const raw = await env.MEMORY_KV.get(`mem:${scope}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveMemory(env, scope, entries) {
  const trimmed = entries.slice(-MAX_MEMORY_ENTRIES);
  await env.MEMORY_KV.put(`mem:${scope}`, JSON.stringify(trimmed));
}

function buildContextText(entries) {
  const recent = entries.slice(-MAX_CONTEXT_ENTRIES);
  if (recent.length === 0) return "(sin memoria previa en este contexto)";
  return recent
    .map((e) => {
      const tag = e.role === "note" ? "NOTA MANUAL DEL USUARIO" : e.role === "user" ? "USUARIO" : "VOS (respuesta anterior)";
      return `[${tag}] ${e.content}`;
    })
    .join("\n");
}

async function handleChat(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Falta configurar ANTHROPIC_API_KEY en el worker (wrangler secret put ANTHROPIC_API_KEY)." }, 500, env);
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    return json({ error: "Falta 'message'." }, 400, env);
  }
  const scope = SCOPES.has(body.scope) ? body.scope : "general";
  const memory = await loadMemory(env, scope);
  const contextText = buildContextText(memory);

  const systemPrompt = `${SYSTEM_PROMPT}\n\nContexto guardado del espacio "${scope}" (memoria de conversaciones y notas previas):\n${contextText}`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.MODEL || "claude-sonnet-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: body.message }],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    return json({ error: `Error de Anthropic (${anthropicRes.status}): ${errText}` }, 502, env);
  }

  const data = await anthropicRes.json();
  const reply = (data.content && data.content[0] && data.content[0].text) || "(sin respuesta)";

  memory.push({ ts: Date.now(), role: "user", content: body.message });
  memory.push({ ts: Date.now(), role: "assistant", content: reply });
  await saveMemory(env, scope, memory);

  return json({ reply }, 200, env);
}

async function handleGetMemory(request, env) {
  const url = new URL(request.url);
  const scope = SCOPES.has(url.searchParams.get("scope")) ? url.searchParams.get("scope") : "general";
  const entries = await loadMemory(env, scope);
  return json({ entries }, 200, env);
}

async function handleDeleteMemory(request, env) {
  const url = new URL(request.url);
  const scope = SCOPES.has(url.searchParams.get("scope")) ? url.searchParams.get("scope") : "general";
  const index = parseInt(url.searchParams.get("index"), 10);
  const entries = await loadMemory(env, scope);
  if (!isNaN(index) && index >= 0 && index < entries.length) {
    entries.splice(index, 1);
    await saveMemory(env, scope, entries);
  }
  return json({ ok: true }, 200, env);
}

async function handleAddNote(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.note !== "string" || !body.note.trim()) {
    return json({ error: "Falta 'note'." }, 400, env);
  }
  const scope = SCOPES.has(body.scope) ? body.scope : "family";
  const entries = await loadMemory(env, scope);
  entries.push({ ts: Date.now(), role: "note", content: body.note.trim() });
  await saveMemory(env, scope, entries);
  return json({ ok: true }, 200, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true }, 200, env);
    }

    if (!checkAuth(request, env)) {
      return json({ error: "No autorizado." }, 401, env);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }
    if (url.pathname === "/api/memory" && request.method === "GET") {
      return handleGetMemory(request, env);
    }
    if (url.pathname === "/api/memory" && request.method === "DELETE") {
      return handleDeleteMemory(request, env);
    }
    if (url.pathname === "/api/memory/note" && request.method === "POST") {
      return handleAddNote(request, env);
    }

    return json({ error: "Not found" }, 404, env);
  },
};
