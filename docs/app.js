// ---------- Config / storage ----------
const LS_SITE_KEY = "mv_site_key";
const LS_WORKER_URL = "mv_worker_url";

const getSiteKey = () => localStorage.getItem(LS_SITE_KEY) || "";
const getWorkerUrl = () => (localStorage.getItem(LS_WORKER_URL) || "").replace(/\/$/, "");

function updateConnStatus() {
  const el = document.getElementById("connStatus");
  const url = getWorkerUrl();
  if (!url) {
    el.textContent = "backend no configurado";
  } else if (!getSiteKey()) {
    el.textContent = "backend configurado — falta clave";
  } else {
    el.textContent = "conectado";
  }
}

async function apiFetch(path, opts = {}) {
  const base = getWorkerUrl();
  if (!base) throw new Error("Falta configurar la URL del backend (pestaña Configuración).");
  const headers = Object.assign(
    { "Content-Type": "application/json", "X-Site-Key": getSiteKey() },
    opts.headers || {}
  );
  const res = await fetch(base + path, Object.assign({}, opts, { headers }));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// ---------- Gate ----------
const gate = document.getElementById("gate");
document.getElementById("siteKeySave").addEventListener("click", () => {
  const v = document.getElementById("siteKeyInput").value.trim();
  if (v) localStorage.setItem(LS_SITE_KEY, v);
  gate.style.display = "none";
  updateConnStatus();
});
document.getElementById("gateSkip").addEventListener("click", () => {
  gate.style.display = "none";
});
document.getElementById("clearSiteKey").addEventListener("click", () => {
  localStorage.removeItem(LS_SITE_KEY);
  updateConnStatus();
  alert("Clave olvidada en este navegador.");
});

// ---------- Config panel ----------
const workerUrlInput = document.getElementById("workerUrlInput");
workerUrlInput.value = getWorkerUrl();
document.getElementById("workerUrlSave").addEventListener("click", () => {
  localStorage.setItem(LS_WORKER_URL, workerUrlInput.value.trim());
  updateConnStatus();
  alert("Guardado.");
});

// ---------- Tabs ----------
document.querySelectorAll("nav.tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
  });
});

// ---------- Chat ----------
const chatLog = document.getElementById("chatLog");
function appendMsg(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

document.getElementById("chatSend").addEventListener("click", sendChat);
document.getElementById("chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

async function sendChat() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;
  const scope = document.getElementById("scopeSelect").value;
  appendMsg("user", message);
  input.value = "";
  const sendBtn = document.getElementById("chatSend");
  sendBtn.disabled = true;
  appendMsg("note", "Pensando...");
  try {
    const data = await apiFetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, scope }),
    });
    chatLog.removeChild(chatLog.lastChild);
    appendMsg("assistant", data.reply);
  } catch (err) {
    chatLog.removeChild(chatLog.lastChild);
    appendMsg("note", "Error: " + err.message);
  } finally {
    sendBtn.disabled = false;
  }
}

// ---------- Proyecciones (linear regression) ----------
let seriesChart;
document.getElementById("seriesRun").addEventListener("click", runProjection);

function linearRegression(values) {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function runProjection() {
  const raw = document.getElementById("seriesInput").value.trim();
  const periods = Math.max(1, parseInt(document.getElementById("seriesPeriods").value, 10) || 3);
  const values = raw.split(",").map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));
  if (values.length < 2) {
    alert("Ingresá al menos 2 valores numéricos separados por coma.");
    return;
  }
  const { slope, intercept } = linearRegression(values);
  const n = values.length;
  const projected = [];
  for (let i = 0; i < periods; i++) {
    projected.push(intercept + slope * (n + i));
  }

  const historicalLabels = values.map((_, i) => "P" + (i + 1));
  const projectedLabels = projected.map((_, i) => "P" + (n + i + 1));
  const labels = historicalLabels.concat(projectedLabels);

  const historicalData = values.concat(Array(periods).fill(null));
  const projectedData = Array(n - 1).fill(null).concat([values[n - 1]]).concat(projected);

  const stats = document.getElementById("seriesStats");
  const changePct = ((values[n - 1] - values[0]) / Math.abs(values[0] || 1)) * 100;
  stats.innerHTML = `
    <div class="stat-tile"><div class="label">Último valor</div><div class="value">${values[n - 1].toFixed(2)}</div></div>
    <div class="stat-tile"><div class="label">Tendencia por período</div><div class="value">${slope >= 0 ? "+" : ""}${slope.toFixed(2)}</div></div>
    <div class="stat-tile"><div class="label">Variación histórica</div><div class="value">${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%</div></div>
    <div class="stat-tile"><div class="label">Proyección período ${n + periods}</div><div class="value">${projected[projected.length - 1].toFixed(2)}</div></div>
  `;

  const root = document.documentElement;
  const css = getComputedStyle(root);
  const c1 = css.getPropertyValue("--series-1").trim();
  const grid = css.getPropertyValue("--grid").trim();
  const ink = css.getPropertyValue("--text-secondary").trim();

  if (seriesChart) seriesChart.destroy();
  const ctx = document.getElementById("seriesChart").getContext("2d");
  seriesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Histórico",
          data: historicalData,
          borderColor: c1,
          backgroundColor: c1,
          borderWidth: 2,
          pointRadius: 3,
          spanGaps: false,
        },
        {
          label: "Proyección",
          data: projectedData,
          borderColor: c1,
          backgroundColor: c1,
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 3,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { grid: { color: grid }, ticks: { color: ink } },
        y: { grid: { color: grid }, ticks: { color: ink } },
      },
      plugins: {
        legend: { labels: { color: ink } },
      },
    },
  });
}

// ---------- Teoría de juegos ----------
const presets = {
  prisoner: {
    rowLabels: ["Cooperar", "Traicionar"],
    colLabels: ["Cooperar", "Traicionar"],
    matrix: [
      [[3, 3], [0, 5]],
      [[5, 0], [1, 1]],
    ],
  },
  stag: {
    rowLabels: ["Ciervo", "Liebre"],
    colLabels: ["Ciervo", "Liebre"],
    matrix: [
      [[4, 4], [0, 3]],
      [[3, 0], [2, 2]],
    ],
  },
  chicken: {
    rowLabels: ["Recto", "Esquivar"],
    colLabels: ["Recto", "Esquivar"],
    matrix: [
      [[0, 0], [5, 1]],
      [[1, 5], [3, 3]],
    ],
  },
  battle: {
    rowLabels: ["Ópera", "Fútbol"],
    colLabels: ["Ópera", "Fútbol"],
    matrix: [
      [[2, 1], [0, 0]],
      [[0, 0], [1, 2]],
    ],
  },
};

function buildMatrixUI(rows, cols, rowLabels, colLabels, matrix) {
  const host = document.getElementById("matrixHost");
  const table = document.createElement("table");
  table.className = "matrix";

  const thead = document.createElement("tr");
  thead.appendChild(document.createElement("th"));
  for (let j = 0; j < cols; j++) {
    const th = document.createElement("th");
    const input = document.createElement("input");
    input.type = "text";
    input.value = (colLabels && colLabels[j]) || "Col " + (j + 1);
    input.id = `colLabel-${j}`;
    th.appendChild(input);
    thead.appendChild(th);
  }
  table.appendChild(thead);

  for (let i = 0; i < rows; i++) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    const rowInput = document.createElement("input");
    rowInput.type = "text";
    rowInput.value = (rowLabels && rowLabels[i]) || "Fila " + (i + 1);
    rowInput.id = `rowLabel-${i}`;
    th.appendChild(rowInput);
    tr.appendChild(th);
    for (let j = 0; j < cols; j++) {
      const td = document.createElement("td");
      td.id = `cell-${i}-${j}`;
      const a = document.createElement("input");
      a.type = "number";
      a.id = `a-${i}-${j}`;
      a.value = matrix && matrix[i] && matrix[i][j] ? matrix[i][j][0] : 0;
      const b = document.createElement("input");
      b.type = "number";
      b.id = `b-${i}-${j}`;
      b.value = matrix && matrix[i] && matrix[i][j] ? matrix[i][j][1] : 0;
      td.appendChild(a);
      td.appendChild(document.createTextNode(" , "));
      td.appendChild(b);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  host.innerHTML = "";
  host.appendChild(table);
}

document.getElementById("buildMatrix").addEventListener("click", () => {
  const rows = Math.min(4, Math.max(2, parseInt(document.getElementById("rowsInput").value, 10) || 2));
  const cols = Math.min(4, Math.max(2, parseInt(document.getElementById("colsInput").value, 10) || 2));
  buildMatrixUI(rows, cols);
  document.getElementById("nashResult").innerHTML = "";
});

document.getElementById("presetSelect").addEventListener("change", (e) => {
  const key = e.target.value;
  if (key === "custom") return;
  const p = presets[key];
  document.getElementById("rowsInput").value = 2;
  document.getElementById("colsInput").value = 2;
  buildMatrixUI(2, 2, p.rowLabels, p.colLabels, p.matrix);
  document.getElementById("nashResult").innerHTML = "";
});

document.getElementById("calcNash").addEventListener("click", () => {
  const rows = Math.min(4, Math.max(2, parseInt(document.getElementById("rowsInput").value, 10) || 2));
  const cols = Math.min(4, Math.max(2, parseInt(document.getElementById("colsInput").value, 10) || 2));
  const a = [], b = [];
  for (let i = 0; i < rows; i++) {
    a.push([]); b.push([]);
    for (let j = 0; j < cols; j++) {
      a[i].push(parseFloat(document.getElementById(`a-${i}-${j}`).value) || 0);
      b[i].push(parseFloat(document.getElementById(`b-${i}-${j}`).value) || 0);
    }
  }

  document.querySelectorAll("table.matrix td[id^='cell-']").forEach((td) => td.classList.remove("ne"));

  const equilibria = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let rowBest = true;
      for (let k = 0; k < rows; k++) if (a[k][j] > a[i][j]) rowBest = false;
      let colBest = true;
      for (let k = 0; k < cols; k++) if (b[i][k] > b[i][j]) colBest = false;
      if (rowBest && colBest) {
        equilibria.push([i, j]);
        const cell = document.getElementById(`cell-${i}-${j}`);
        if (cell) cell.classList.add("ne");
      }
    }
  }

  const result = document.getElementById("nashResult");
  if (equilibria.length === 0) {
    result.innerHTML = `<p>No hay equilibrio de Nash en estrategias puras. El juego requiere estrategias mixtas (probabilidades), no cubierto por esta calculadora.</p>`;
  } else {
    const rowLabels = [];
    const colLabels = [];
    for (let i = 0; i < rows; i++) rowLabels.push(document.getElementById(`rowLabel-${i}`)?.value || `Fila ${i + 1}`);
    for (let j = 0; j < cols; j++) colLabels.push(document.getElementById(`colLabel-${j}`)?.value || `Col ${j + 1}`);
    const list = equilibria.map(([i, j]) => `<li><strong>${rowLabels[i]} / ${colLabels[j]}</strong> — pagos (${a[i][j]}, ${b[i][j]})</li>`).join("");
    result.innerHTML = `<p>Equilibrio(s) de Nash en estrategias puras:</p><ul>${list}</ul>`;
  }
});

// Init default matrix
buildMatrixUI(2, 2, ["Fila 1", "Fila 2"], ["Col 1", "Col 2"]);

// ---------- Memoria ----------
document.getElementById("memLoad").addEventListener("click", loadMemory);
document.getElementById("familyNoteSave").addEventListener("click", saveFamilyNote);

async function loadMemory() {
  const scope = document.getElementById("memScope").value;
  const list = document.getElementById("memList");
  list.innerHTML = "Cargando...";
  try {
    const data = await apiFetch(`/api/memory?scope=${scope}`);
    if (!data.entries || data.entries.length === 0) {
      list.innerHTML = `<p class="hint">No hay memoria guardada en este contexto todavía.</p>`;
      return;
    }
    list.innerHTML = "";
    data.entries.forEach((entry, idx) => {
      const div = document.createElement("div");
      div.className = "memory-entry";
      const date = new Date(entry.ts).toLocaleString();
      div.innerHTML = `
        <div>
          <div class="meta">${entry.role} · ${date}</div>
          <div>${entry.content}</div>
        </div>
      `;
      const delBtn = document.createElement("button");
      delBtn.className = "btn danger";
      delBtn.textContent = "Borrar";
      delBtn.addEventListener("click", async () => {
        await apiFetch(`/api/memory?scope=${scope}&index=${idx}`, { method: "DELETE" });
        loadMemory();
      });
      div.appendChild(delBtn);
      list.appendChild(div);
    });
  } catch (err) {
    list.innerHTML = `<p class="hint">Error: ${err.message}</p>`;
  }
}

async function saveFamilyNote() {
  const textEl = document.getElementById("familyNoteInput");
  const text = textEl.value.trim();
  if (!text) return;
  try {
    await apiFetch("/api/memory/note", {
      method: "POST",
      body: JSON.stringify({ scope: "family", note: text }),
    });
    textEl.value = "";
    alert("Nota guardada.");
  } catch (err) {
    alert("Error: " + err.message);
  }
}

updateConnStatus();
if (!getWorkerUrl()) {
  gate.style.display = "none";
}
