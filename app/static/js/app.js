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
}

function renderBacktestChart(backtest) {
  const real = {
    x: backtest.dates,
    y: backtest.real,
    mode: "lines",
    name: "Real (open t+1)",
    line: { color: "#8aa4ff", width: 2 },
  };
  const pred = {
    x: backtest.dates,
    y: backtest.pred,
    mode: "lines",
    name: "Predicción",
    line: { color: "#2fd1a5", width: 2 },
  };

  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 50, r: 50, t: 20, b: 40 },
    xaxis: { gridcolor: "rgba(255,255,255,0.06)" },
    yaxis: { title: "Precio (open)", gridcolor: "rgba(255,255,255,0.06)" },
    legend: { orientation: "h", y: 1.1 },
    font: { color: "#e8ecff" },
  };

  Plotly.newPlot("backtestChart", [real, pred], layout, { responsive: true, displayModeBar: false });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setPred(nextPred) {
  const valueEl = document.getElementById("predValue");
  const subEl = document.getElementById("predSub");
  const deltaEl = document.getElementById("predDelta");

  valueEl.textContent = fmtUSD(nextPred.open_pred_next);
  subEl.textContent = `Para ${nextPred.date_predicted_for} (último ${nextPred.date_last})`;

  const sign = nextPred.delta >= 0 ? "+" : "";
  deltaEl.className = pillClass(nextPred.delta_pct);
  deltaEl.textContent = `${sign}${fmtUSD(nextPred.delta)} (${sign}${fmtNum(nextPred.delta_pct, 2)}%)`;
}

function setInsights(ins) {
  const sign = ins.momentum_abs >= 0 ? "+" : "";
  setText("momentum", `${sign}${fmtUSD(ins.momentum_abs)} (${sign}${fmtNum(ins.momentum_pct, 2)}%)`);
  setText("vol", `${fmtNum(ins.annualized_volatility * 100, 1)}%`);
  setText("risk", ins.risk_note);
  setText("disclaimer", ins.disclaimer);
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

document.getElementById("refreshBtn").addEventListener("click", load);
document.getElementById("lastN").addEventListener("change", load);

load();

