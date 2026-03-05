from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

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


def get_predictor() -> Predictor:
    global _predictor
    if _predictor is None:
        _predictor = Predictor(dataset_path=DATASET_PATH, model_path=MODEL_PATH)
    return _predictor


@app.get("/", response_class=HTMLResponse)
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
    try:
        p = get_predictor()
        return build_dashboard_payload(p, last_n=last_n)
    except ModelLoadError as e:
        raise HTTPException(status_code=500, detail=f"No se pudo cargar el modelo: {e}") from e
    except PredictorError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.get("/api/predict-next")
def predict_next() -> dict:
    try:
        p = get_predictor()
        pred = p.predict_next_open()
        return pred
    except ModelLoadError as e:
        raise HTTPException(status_code=500, detail=f"No se pudo cargar el modelo: {e}") from e
    except PredictorError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

