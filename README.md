## Plataforma interactiva (FastAPI) — Predicción Bitcoin

Esta carpeta incluye una **app web** para mostrar:

- **Gráfica OHLC + volumen** (Plotly).
- **Backtest real vs predicción** (tu mismo pipeline: `LOOKBACK=60`, features `open/high/low/close/volume`, escalado `MinMaxScaler`, split 80/20).
- **Predicción “próxima apertura”** (target = `open` del día siguiente).

> Nota: es **educativo**. No es asesoría financiera.

### Requisitos

- Python 3.10+ recomendado

### Instalación

```bash
pip install -r requirements.txt
```

### Ejecutar

Desde la raíz del proyecto:

```bash
uvicorn app.main:app --reload
```

Abre `http://127.0.0.1:8000`.

### Endpoints útiles

- `GET /` UI
- `GET /api/health` verificación rápida
- `GET /api/dashboard?last_n=365` datos para gráficas + métricas
- `GET /api/predict-next` predicción próxima apertura
