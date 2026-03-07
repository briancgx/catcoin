from __future__ import annotations

from pathlib import Path
import os
from datetime import date

from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from openai import OpenAI

load_dotenv()

from app.services.predictor import (
    ModelLoadError,
    Predictor,
    PredictorError,
    build_dashboard_payload,
)

ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "bitcoin_dataset_actualizado.csv"
MODEL_PATH = ROOT / "bitcoin_price_predictor.h5"

app = FastAPI(title="Bitcoin Predictor", version="0.1.0")

app.mount("/static", StaticFiles(directory=ROOT / "app" / "static"), name="static")
templates = Jinja2Templates(directory=str(ROOT / "app" / "templates"))

_predictor: Predictor | None = None
_dashboard_cache: dict[tuple[int, date], dict] = {}
_predict_next_cache: dict[date, dict] = {}

def check_and_update_dataset():
    global _predictor
    today = date.today()
    if DATASET_PATH.exists():
        import datetime
        mtime = os.path.getmtime(DATASET_PATH)
        mdate = datetime.date.fromtimestamp(mtime)
        if mdate == today:
            return  # Dataset already up-to-date today

    import subprocess
    import sys
    script_path = ROOT / "descargar.py"
    print(f"Updating dataset for {today} using {script_path}...")
    try:
        subprocess.run([sys.executable, str(script_path)], cwd=str(ROOT), check=True)
        _predictor = None  # Force reload after update
    except subprocess.CalledProcessError as e:
        print(f"Failed to update dataset: {e}")

def get_predictor() -> Predictor:
    global _predictor
    check_and_update_dataset()
    if _predictor is None:
        _predictor = Predictor(dataset_path=DATASET_PATH, model_path=MODEL_PATH)
    return _predictor


@app.get("/", response_class=HTMLResponse)
def landing(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        "landing.html",
        {
            "request": request,
            "title": "Bitcoin Predictor — Inicio",
        },
    )


@app.get("/dashboard", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "title": "Bitcoin — Dashboard de predicción",
        },
    )


@app.get("/api/health")
def health() -> dict:
    try:
        p = get_predictor()
        return {
            "ok": True,
            "dataset_path": str(p.dataset_path),
            "model_path": str(p.model_path),
            "rows": int(p.df.shape[0]),
        }
    except ModelLoadError as e:
        return {"ok": False, "error": str(e), "hint": "Instala dependencias: pip install -r requirements.txt"}
    except PredictorError as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/dashboard")
def dashboard(last_n: int = Query(365, ge=30, le=3000)) -> dict:
    today = date.today()
    cache_key = (last_n, today)
    if cache_key in _dashboard_cache:
        return _dashboard_cache[cache_key]

    try:
        p = get_predictor()
        payload = build_dashboard_payload(p, last_n=last_n)
        _dashboard_cache.clear()  # maintain only the latest query to avoid memory bloat
        _dashboard_cache[cache_key] = payload
        return payload
    except ModelLoadError as e:
        raise HTTPException(status_code=500, detail=f"No se pudo cargar el modelo: {e}") from e
    except PredictorError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.get("/api/predict-next")
def predict_next() -> dict:
    today = date.today()
    if today in _predict_next_cache:
        return _predict_next_cache[today]

    try:
        p = get_predictor()
        pred = p.predict_next_open()
        _predict_next_cache.clear()
        _predict_next_cache[today] = pred
        return pred
    except ModelLoadError as e:
        raise HTTPException(status_code=500, detail=f"No se pudo cargar el modelo: {e}") from e
    except PredictorError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


class AssistantRequest(BaseModel):
    question: str
    context: dict | None = None


@app.post("/api/assistant")
def assistant(req: AssistantRequest) -> dict:
    api_key_groq = os.getenv("GROQ_API_KEY")
    api_key_openai = os.getenv("OPENAI_API_KEY")

    if api_key_groq:
        client = OpenAI(api_key=api_key_groq, base_url="https://api.groq.com/openai/v1")
        model_name = "llama-3.3-70b-versatile"
    elif api_key_openai:
        client = OpenAI(api_key=api_key_openai)
        model_name = "gpt-3.5-turbo"
    else:
        raise HTTPException(
            status_code=500,
            detail="Falta configurar GROQ_API_KEY o OPENAI_API_KEY en el archivo .env para el asistente.",
        )

    context_text = ""
    if req.context:
        ctx = req.context
        context_lines = [
            "Datos del dashboard actual (usa estos números para responder):",
            f"Fecha más reciente: {ctx.get('last_date')}",
            f"Precio apertura más reciente: {ctx.get('last_open')}",
            f"Precio cierre más reciente: {ctx.get('last_close')}",
            f"Predicción del modelo LSTM para próxima apertura: {ctx.get('open_pred_next')} USD (fecha: {ctx.get('date_predicted_for')})",
            f"Delta predicción: {ctx.get('delta')} USD ({ctx.get('delta_pct')}%)",
            f"MAE backtest: {ctx.get('mae')}",
            f"RMSE backtest: {ctx.get('rmse')}",
            f"Momentum absoluto: {ctx.get('momentum_abs')}",
            f"Momentum porcentual: {ctx.get('momentum_pct')}%",
            f"Volatilidad anualizada: {ctx.get('annualized_volatility')}",
            f"Riesgo: {ctx.get('risk_note')}",
            f"Disclaimer: {ctx.get('disclaimer')}",
        ]
        context_text = "\n".join(str(x) for x in context_lines)

    system_prompt = """Eres un asistente experto en Bitcoin, análisis técnico y finanzas cuantitativas. Tienes acceso a datos reales del dashboard y a un modelo LSTM de predicción de precios.

Cómo responder:
1. Usa los datos del contexto solo cuando sean útiles para la respuesta. No los menciones todos de golpe ni de forma mecánica.
2. Da respuestas honestas y directas. Si alguien pregunta si es buen momento para comprar o sobre el futuro del precio, da tu análisis basado en los datos disponibles (tendencia, volatilidad, predicción). No evadas la pregunta con disclaimers.
3. Sé claro cuando algo es incierto: el mercado es impredecible y el modelo LSTM tiene un margen de error (MAE/RMSE). Menciona esto solo si es relevante.
4. Escribe en texto plano sin formato markdown: sin asteriscos, sin listas con guiones, sin numeración. Párrafos fluidos y naturales.
5. Sé conciso. Responde lo que se pregunta, sin relleno."""

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"{context_text}\n\nPregunta del usuario: {req.question}",
            },
        ]

        completion = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.3,
            max_tokens=600,
        )
        answer = completion.choices[0].message.content
        return {"answer": answer}
    except Exception as e:  # pragma: no cover - defensivo
        raise HTTPException(
            status_code=500,
            detail=f"Error al llamar al modelo del asistente: {e}",
        ) from e

