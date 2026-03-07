function fmtUSD(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);
}

function fmtNum(x, digits = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: digits }).format(x);
}

function pillClass(deltaPct) {
  if (deltaPct > 0.25) return "pill pill-up";
  if (deltaPct < -0.25) return "pill pill-down";
  return "pill pill-flat";
}

async function fetchDashboard(lastN) {
  const res = await fetch(`/api/dashboard?last_n=${encodeURIComponent(lastN)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.detail || `Error HTTP ${res.status}`;
    throw new Error(msg);
  }
  return await res.json();
}

// ─── Plotly: listeners van DENTRO de las funciones de render ──────────────
function renderPriceChart(series) {
  const candle = {
    x: series.dates,
    open: series.open,
    high: series.high,
    low: series.low,
    close: series.close,
    type: "candlestick",
    name: "BTC",
    increasing: { line: { color: "#2fd1a5" } },
    decreasing: { line: { color: "#ff4d6d" } },
  };
  const vol = {
    x: series.dates,
    y: series.volume,
    type: "bar",
    name: "Volumen",
    marker: { color: "rgba(140,160,255,0.35)" },
    yaxis: "y2",
  };
  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 50, r: 50, t: 20, b: 40 },
    xaxis: { rangeslider: { visible: false }, gridcolor: "rgba(255,255,255,0.06)" },
    yaxis: { title: "Precio", gridcolor: "rgba(255,255,255,0.06)" },
    yaxis2: { title: "Vol", overlaying: "y", side: "right", showgrid: false },
    legend: { orientation: "h", y: 1.1 },
    font: { color: "#e8ecff" },
  };
  Plotly.newPlot("priceChart", [candle, vol], layout, { responsive: true, displayModeBar: false });

  // Listeners JUSTO después de newPlot — aquí sí existen
  const el = document.getElementById("priceChart");
  if (el) {
    el.on("plotly_click", function (data) {
      const pt = data.points[0];
      if (!pt) return;
      const date = pt.x;
      const close = pt.close != null ? pt.close : pt.y;
      const q = `Hice clic en la fecha ${date} de la gráfica de precios. El precio era aproximadamente ${close ? Math.round(close).toLocaleString("es-MX") : "desconocido"} USD. ¿Qué pasó con Bitcoin en ese período?`;
      if (typeof _ctxAsk === "function") {
        const r = el.getBoundingClientRect();
        _ctxAsk(q, r.left + r.width / 2, r.top + 80);
      }
    });
    el.on("plotly_relayout", function (ev) {
      if (!Object.keys(ev).some(k => k.startsWith("xaxis.range"))) return;
      const from = ev["xaxis.range[0]"] || (ev["xaxis.range"] && ev["xaxis.range"][0]);
      const to = ev["xaxis.range[1]"] || (ev["xaxis.range"] && ev["xaxis.range"][1]);
      if (!from || !to) return;
      const q = `El usuario hizo zoom en el gráfico entre ${from.slice(0, 10)} y ${to.slice(0, 10)}. ¿Qué tendencia o evento relevante hubo en Bitcoin ese período?`;
      if (typeof _ctxAsk === "function") {
        const r = el.getBoundingClientRect();
        _ctxAsk(q, r.left + r.width / 2, r.top + 80);
      }
    });
  }
}

function renderBacktestChart(backtest) {
  const real = { x: backtest.dates, y: backtest.real, mode: "lines", name: "Real (open t+1)", line: { color: "#8aa4ff", width: 2 } };
  const pred = { x: backtest.dates, y: backtest.pred, mode: "lines", name: "Predicción", line: { color: "#2fd1a5", width: 2 } };
  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 50, r: 50, t: 20, b: 40 },
    xaxis: { gridcolor: "rgba(255,255,255,0.06)" },
    yaxis: { title: "Precio (open)", gridcolor: "rgba(255,255,255,0.06)" },
    legend: { orientation: "h", y: 1.1 }, font: { color: "#e8ecff" },
  };
  Plotly.newPlot("backtestChart", [real, pred], layout, { responsive: true, displayModeBar: false });

  const el = document.getElementById("backtestChart");
  if (el) {
    el.on("plotly_click", function (data) {
      const pt = data.points[0];
      if (!pt) return;
      const date = pt.x, val = pt.y;
      const serie = (pt.data && pt.data.name) || "serie";
      const q = `En el gráfico de backtest hice clic en la fecha ${date}, ${serie} con valor ~${val ? Math.round(val).toLocaleString("es-MX") : "?"} USD. ¿Es un error grande entre real y predicción?`;
      if (typeof _ctxAsk === "function") {
        const r = el.getBoundingClientRect();
        _ctxAsk(q, r.left + r.width / 2, r.top + 80);
      }
    });
  }
}

// ─── Helpers de UI ────────────────────────────────────────────────────────
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setPred(nextPred) {
  const valueEl = document.getElementById("predValue");
  const subEl = document.getElementById("predSub");
  const deltaEl = document.getElementById("predDelta");
  const cardEl = document.getElementById("cardPred");
  if (!valueEl) return;
  valueEl.textContent = fmtUSD(nextPred.open_pred_next);
  subEl.textContent = `Para ${nextPred.date_predicted_for} (último ${nextPred.date_last})`;
  const sign = nextPred.delta >= 0 ? "+" : "";
  deltaEl.className = pillClass(nextPred.delta_pct);
  deltaEl.textContent = `${sign}${fmtUSD(nextPred.delta)} (${sign}${fmtNum(nextPred.delta_pct, 2)}%)`;
  if (cardEl) {
    cardEl.classList.remove("accent-up", "accent-down");
    if (nextPred.delta_pct > 0.25) cardEl.classList.add("accent-up");
    else if (nextPred.delta_pct < -0.25) cardEl.classList.add("accent-down");
  }
}

function setInsights(ins) {
  const sign = ins.momentum_abs >= 0 ? "+" : "";
  const momentumStr = `${sign}${fmtUSD(ins.momentum_abs)} (${sign}${fmtNum(ins.momentum_pct, 2)}%)`;
  const volStr = `${fmtNum(ins.annualized_volatility * 100, 1)}%`;
  setText("momentumFull", momentumStr);
  setText("volFull", volStr);
  setText("riskFull", ins.risk_note);
  setText("disclaimer", ins.disclaimer);
  setText("previewMomentum", momentumStr);
  setText("previewVol", volStr);
  setText("previewRisk", ins.risk_note);

  const mCard = document.querySelector(".icard-momentum");
  if (mCard) { mCard.classList.remove("is-up", "is-down"); mCard.classList.add(ins.momentum_abs >= 0 ? "is-up" : "is-down"); }

  const rCard = document.querySelector(".icard-risk");
  if (rCard) {
    rCard.classList.remove("risk-alto", "risk-medio", "risk-bajo");
    const rl = (ins.risk_note || "").toLowerCase();
    if (rl.includes("alto") || rl.includes("muy")) rCard.classList.add("risk-alto");
    else if (rl.includes("medio") || rl.includes("moderado")) rCard.classList.add("risk-medio");
    else if (rl.includes("bajo")) rCard.classList.add("risk-bajo");
  }

  const pm = document.querySelector(".ipreview-momentum");
  if (pm) { pm.classList.remove("is-up", "is-down"); pm.classList.add(ins.momentum_abs >= 0 ? "is-up" : "is-down"); }

  const pr = document.querySelector(".ipreview-risk");
  if (pr) {
    pr.classList.remove("risk-alto", "risk-medio", "risk-bajo");
    const rl2 = (ins.risk_note || "").toLowerCase();
    if (rl2.includes("alto") || rl2.includes("muy")) pr.classList.add("risk-alto");
    else if (rl2.includes("medio") || rl2.includes("moderado")) pr.classList.add("risk-medio");
    else if (rl2.includes("bajo")) pr.classList.add("risk-bajo");
  }
}

// ─── Estado global ────────────────────────────────────────────────────────
let dashboardSnapshot = null;

function buildDashboardSnapshot(data) {
  try {
    const idx = data.series.dates.length - 1;
    const pred = data.next_prediction || {};
    return {
      last_date: data.series.dates[idx],
      last_open: data.series.open[idx],
      last_close: data.series.close[idx],
      mae: data.backtest.mae,
      rmse: data.backtest.rmse,
      momentum_abs: data.insights.momentum_abs,
      momentum_pct: data.insights.momentum_pct,
      annualized_volatility: data.insights.annualized_volatility,
      risk_note: data.insights.risk_note,
      disclaimer: data.insights.disclaimer,
      open_pred_next: pred.open_pred_next,
      date_predicted_for: pred.date_predicted_for,
      delta: pred.delta,
      delta_pct: pred.delta_pct,
    };
  } catch {
    return null;
  }
}

async function load() {
  const lastN = Number(document.getElementById("lastN").value);
  setText("predHint", "Cargando…");
  try {
    const data = await fetchDashboard(lastN);
    setPred(data.next_prediction);
    setText("mae", fmtUSD(data.backtest.mae));
    setText("rmse", fmtUSD(data.backtest.rmse));
    setInsights(data.insights);
    renderPriceChart(data.series);
    renderBacktestChart(data.backtest);
    dashboardSnapshot = buildDashboardSnapshot(data);
    setText("predHint", "Listo.");
  } catch (e) {
    setText("predValue", "Error");
    setText("predSub", String(e.message || e));
    setText("predDelta", "—");
    setText("predHint", "Tip: instala dependencias y reinicia el servidor.");
    Plotly.purge("priceChart");
    Plotly.purge("backtestChart");
  }
}

// ─── Asistente de chat ────────────────────────────────────────────────────
function sanitizeAssistantText(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function appendAssistantMessage(text, role) {
  const container = document.getElementById("assistantMessages");
  if (!container) return;
  const wrapper = document.createElement("div");
  wrapper.className = `assistant-message assistant-message-${role}`;
  const body = document.createElement("div");
  body.className = "assistant-message-body";
  body.textContent = role === "assistant" ? sanitizeAssistantText(text) : text;
  if (role === "user") {
    wrapper.appendChild(body);
    wrapper.classList.add("assistant-message-user-wrap");
  } else {
    const avatar = document.createElement("div");
    avatar.className = "assistant-avatar";
    avatar.textContent = "🤖";
    const bubble = document.createElement("div");
    bubble.className = "assistant-bubble";
    bubble.appendChild(body);
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
  }
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

function setTyping(visible) {
  const el = document.getElementById("assistantTyping");
  if (!el) return;
  el.hidden = !visible;
  if (visible) {
    const container = document.getElementById("assistantMessages");
    if (container) container.scrollTop = container.scrollHeight;
  }
}

async function askAssistant(question) {
  appendAssistantMessage(question, "user");
  const input = document.getElementById("assistantQuestion");
  const sendBtn = document.getElementById("assistantSendBtn");
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  setTyping(true);
  try {
    const res = await fetch(`${window.location.origin}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context: dashboardSnapshot }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      appendAssistantMessage(`No pude responder: ${body?.detail || res.status}`, "assistant");
      return;
    }
    const data = await res.json();
    appendAssistantMessage(data.answer || "No pude generar una respuesta.", "assistant");
  } catch (e) {
    const hint = window.location.protocol === "file:" ? " Abre desde http://127.0.0.1:8000." : "";
    appendAssistantMessage(`Error: ${e.message}.${hint}`, "assistant");
  } finally {
    setTyping(false);
    if (input) { input.disabled = false; input.focus(); }
    if (sendBtn) sendBtn.disabled = false;
  }
}

function sendAssistantMessage(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  const input = document.getElementById("assistantQuestion");
  if (!input) return;
  const value = input.value.trim();
  if (!value) return;
  input.value = "";
  askAssistant(value);
}

// ─── Tooltip IA contextual (global para ser accesible desde render fns) ───
let _ctxAsk = null; // se inicializa en DOMContentLoaded

// ─── DOMContentLoaded ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  const typingEl = document.getElementById("assistantTyping");
  if (typingEl) typingEl.hidden = true;

  // Insights toggle
  const insightsToggle = document.getElementById("insightsToggle");
  const insightCardsPanel = document.getElementById("insightCardsPanel");
  const insightsPreview = document.getElementById("insightsPreview");
  if (insightsToggle && insightCardsPanel) {
    insightsToggle.addEventListener("click", function () {
      const isOpen = insightCardsPanel.classList.toggle("is-open");
      insightsToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (insightsPreview) insightsPreview.classList.toggle("is-hidden", isOpen);
    });
  }

  // Menú flotante
  const menuTrigger = document.getElementById("menuTrigger");
  const menuPanel = document.getElementById("menuPanel");
  const menuWrapper = document.getElementById("menuWrapper");

  function openMenu() {
    if (!menuTrigger) return;
    menuTrigger.classList.add("is-open");
    menuPanel.classList.add("is-open");
    menuTrigger.setAttribute("aria-expanded", "true");
    menuPanel.setAttribute("aria-hidden", "false");
  }
  function closeMenu() {
    if (!menuTrigger) return;
    menuTrigger.classList.remove("is-open");
    menuPanel.classList.remove("is-open");
    menuTrigger.setAttribute("aria-expanded", "false");
    menuPanel.setAttribute("aria-hidden", "true");
  }

  if (menuTrigger) {
    menuTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      menuPanel.classList.contains("is-open") ? closeMenu() : openMenu();
    });
  }
  document.addEventListener("click", function (e) {
    if (menuWrapper && !menuWrapper.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  // Refresh & selector
  const refreshBtn = document.getElementById("refreshBtn");
  const lastN = document.getElementById("lastN");
  if (refreshBtn) refreshBtn.addEventListener("click", function () { closeMenu(); load(); });
  if (lastN) lastN.addEventListener("change", load);

  // API Health check
  const healthBtn = document.getElementById("healthBtn");
  const healthStatus = document.getElementById("healthStatus");
  const healthDot = document.getElementById("healthDot");
  const healthText = document.getElementById("healthText");
  const healthRows = document.getElementById("healthRows");
  if (healthBtn) {
    healthBtn.addEventListener("click", async function () {
      healthBtn.textContent = "...";
      healthBtn.disabled = true;
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        const ok = data.ok === true;
        healthDot.className = "health-dot " + (ok ? "ok" : "fail");
        healthText.textContent = ok ? "Servidor OK" : "Error";
        healthStatus.style.display = "flex";
        if (ok && data.rows) {
          healthRows.textContent = `${data.rows.toLocaleString("es-MX")} filas en dataset`;
          healthRows.style.display = "block";
        } else if (!ok && data.error) {
          healthRows.textContent = data.error.slice(0, 60);
          healthRows.style.display = "block";
        }
        healthBtn.textContent = "Actualizar";
      } catch {
        healthDot.className = "health-dot fail";
        healthText.textContent = "Sin conexión";
        healthStatus.style.display = "flex";
        healthBtn.textContent = "Reintentar";
      } finally {
        healthBtn.disabled = false;
      }
    });
  }

  // Chat send
  const sendBtn = document.getElementById("assistantSendBtn");
  const input = document.getElementById("assistantQuestion");
  if (sendBtn) {
    sendBtn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      sendAssistantMessage(e);
    });
  }
  if (input) {
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); sendAssistantMessage(ev); }
    });
  }

  // ── Tooltip IA contextual ────────────────────────────────────
  const ctxTooltip = document.getElementById("ctxTooltip");
  const ctxLoading = document.getElementById("ctxLoading");
  const ctxText = document.getElementById("ctxText");
  const ctxClose = document.getElementById("ctxClose");

  function showCtx(x, y) {
    ctxTooltip.removeAttribute("hidden");
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = x + 12, top = y + 12;
    if (left + 316 > vw - 8) left = x - 316 - 12;
    if (top + 200 > vh - 8) top = y - 200 - 12;
    ctxTooltip.style.left = Math.max(8, left) + "px";
    ctxTooltip.style.top = Math.max(8, top) + "px";
  }
  function hideCtx() { if (ctxTooltip) ctxTooltip.setAttribute("hidden", ""); }

  async function askContext(question, x, y) {
    if (!ctxTooltip) return;
    ctxLoading.removeAttribute("hidden");
    ctxText.setAttribute("hidden", "");
    ctxText.textContent = "";
    showCtx(x, y);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: dashboardSnapshot }),
      });
      const data = await res.json();
      ctxText.textContent = data.answer || "Sin respuesta.";
    } catch {
      ctxText.textContent = "Error al contactar la IA.";
    } finally {
      ctxLoading.setAttribute("hidden", "");
      ctxText.removeAttribute("hidden");
    }
  }

  // Exponer globalmente para que renderPriceChart/renderBacktestChart puedan llamarla
  _ctxAsk = askContext;

  if (ctxClose) ctxClose.addEventListener("click", hideCtx);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideCtx(); });
  document.addEventListener("click", function (e) {
    if (ctxTooltip && !ctxTooltip.hasAttribute("hidden") && !ctxTooltip.contains(e.target)) hideCtx();
  });

  // Cards
  const cardPred = document.getElementById("cardPred");
  if (cardPred) {
    cardPred.addEventListener("click", function (e) {
      e.stopPropagation();
      askContext("Explícame en 3 líneas qué significa la predicción actual del modelo LSTM y si la tendencia parece alcista o bajista.", e.clientX, e.clientY);
    });
  }
  const cardMetrics = document.getElementById("cardMetrics");
  if (cardMetrics) {
    cardMetrics.addEventListener("click", function (e) {
      e.stopPropagation();
      askContext("Explícame qué significan el MAE y el RMSE de este modelo y si son buenos o malos números.", e.clientX, e.clientY);
    });
  }
  const cardInsights = document.getElementById("cardInsights");
  if (cardInsights) {
    cardInsights.addEventListener("click", function (e) {
      if (e.target.closest("#insightsToggle")) return;
      e.stopPropagation();
      askContext("Interpreta el momentum, la volatilidad y el nivel de riesgo actuales. ¿Qué nos dicen sobre el estado del mercado?", e.clientX, e.clientY);
    });
  }

  // ── Landing Page AI Listeners ──
  const landingTriggers = document.querySelectorAll("[data-ai-trigger]");
  landingTriggers.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const topic = el.getAttribute("data-ai-trigger");
      let prompt = "";
      if (topic === "descentralizacion") prompt = "Explícame de forma muy breve por qué la descentralización de Bitcoin es tan importante en comparación con los bancos tradicionales.";
      else if (topic === "escasez") prompt = "Explica en pocas palabras por qué la escasez absoluta de Bitcoin (solo 21 millones) lo hace diferente del dinero fiduciario.";
      else if (topic === "seguridad") prompt = "Resume cómo funciona la criptografía y la minería que le da tanta seguridad a la red Bitcoin.";
      else if (topic === "historia-2008") prompt = "Resume brevemente la crisis del 2008 y cómo influyó en que Satoshi Nakamoto publicara el Whitepaper de Bitcoin.";
      else if (topic === "historia-2009") prompt = "¿Qué es el bloque Génesis de Bitcoin y qué mensaje incluyó Satoshi Nakamoto en él? Sé breve.";
      else if (topic === "historia-2010") prompt = "Resume la historia graciosa e histórica del 'Bitcoin Pizza Day' de 2010.";
      else if (topic === "historia-2024") prompt = "¿Qué impacto ha tenido la reciente aprobación de los ETFs institucionales de Bitcoin en 2024? Dímelo de forma resumida.";

      if (prompt) {
        askContext(prompt, e.clientX, e.clientY);
      }
    });
  });

  // Carga inicial (Solo si existe un elemento propio del dashboard)
  if (document.getElementById("priceChart")) {
    load().catch(function () { });
  }
});
