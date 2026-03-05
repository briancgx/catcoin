from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import MinMaxScaler


class PredictorError(RuntimeError):
    pass


class ModelLoadError(PredictorError):
    pass


@dataclass(frozen=True)
class BacktestResult:
    mae: float
    rmse: float
    y_real: np.ndarray  # shape (n, 1)
    y_pred: np.ndarray  # shape (n, 1)
    dates: np.ndarray  # shape (n,)


class Predictor:
    LOOKBACK: int = 60
    FEATURES: tuple[str, ...] = ("open", "high", "low", "close", "volume")

    def __init__(self, dataset_path: Path, model_path: Path):
        self.dataset_path = Path(dataset_path)
        self.model_path = Path(model_path)

        self.df = self._load_dataset(self.dataset_path)
        (
            self.scaler_X,
            self.scaler_y,
            self.X_scaled,
            self.y_scaled,
            self.X_seq,
            self.y_seq,
            self.split_idx,
            self.test_dates,
        ) = self._prepare_sequences(self.df)

        self._model = self._load_model(self.model_path)

        self._backtest_cache: BacktestResult | None = None

    @staticmethod
    def _load_dataset(path: Path) -> pd.DataFrame:
        if not path.exists():
            raise PredictorError(f"No encuentro el dataset en: {path}")

        df = pd.read_csv(path)
        if "timestamp" not in df.columns:
            raise PredictorError("El CSV debe tener columna 'timestamp'.")

        for c in ("open", "high", "low", "close", "volume"):
            if c not in df.columns:
                raise PredictorError(f"Falta columna requerida: '{c}'")

        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp").reset_index(drop=True)

        df["target"] = df["open"].shift(-1)
        df = df.dropna().reset_index(drop=True)
        return df

    def _prepare_sequences(
        self, df: pd.DataFrame
    ) -> tuple[
        MinMaxScaler,
        MinMaxScaler,
        np.ndarray,
        np.ndarray,
        np.ndarray,
        np.ndarray,
        int,
        np.ndarray,
    ]:
        X = df[list(self.FEATURES)].values
        y = df["target"].values.reshape(-1, 1)

        scaler_X = MinMaxScaler()
        scaler_y = MinMaxScaler()

        X_scaled = scaler_X.fit_transform(X)
        y_scaled = scaler_y.fit_transform(y)

        X_seq: list[np.ndarray] = []
        y_seq: list[np.ndarray] = []

        for i in range(self.LOOKBACK, len(X_scaled)):
            X_seq.append(X_scaled[i - self.LOOKBACK : i])
            y_seq.append(y_scaled[i])

        X_seq_arr = np.asarray(X_seq)
        y_seq_arr = np.asarray(y_seq)

        split = int(len(X_seq_arr) * 0.8)

        # Cada y_seq[i] corresponde a df index i+LOOKBACK
        test_df_indices = np.arange(self.LOOKBACK + split, self.LOOKBACK + len(X_seq_arr))
        test_dates = df["timestamp"].iloc[test_df_indices].to_numpy()

        return (
            scaler_X,
            scaler_y,
            X_scaled,
            y_scaled,
            X_seq_arr,
            y_seq_arr,
            split,
            test_dates,
        )

    @staticmethod
    def _load_model(path: Path):
        if not path.exists():
            raise ModelLoadError(f"No encuentro el modelo en: {path}")
        try:
            import tensorflow as tf  # noqa: WPS433
        except Exception as e:  # pragma: no cover
            raise ModelLoadError(
                "TensorFlow no está instalado en este entorno. Ejecuta: pip install -r requirements.txt"
            ) from e

        try:
            # Keras 3 / TF 2.20 pueden dar problemas al deserializar
            # modelos HDF5 antiguos (funciones de pérdida/métricas).
            # Para inferencia no necesitamos el grafo de entrenamiento,
            # así que forzamos compile=False y, cuando está disponible,
            # safe_mode=False.
            try:  # nuevo API Keras 3
                from keras.saving import load_model as keras_load_model  # type: ignore[attr-defined]

                return keras_load_model(str(path), compile=False, safe_mode=False)
            except Exception:
                # Fallback compatible con TF 2.x clásico
                return tf.keras.models.load_model(str(path), compile=False)
        except Exception as e:
            raise ModelLoadError(f"Error cargando el modelo .h5: {e}") from e

    def backtest(self) -> BacktestResult:
        if self._backtest_cache is not None:
            return self._backtest_cache

        X_test = self.X_seq[self.split_idx :]
        y_test = self.y_seq[self.split_idx :]

        pred_scaled = self._model.predict(X_test, verbose=0)
        pred = self.scaler_y.inverse_transform(pred_scaled)
        real = self.scaler_y.inverse_transform(y_test)

        mae = float(mean_absolute_error(real, pred))
        rmse = float(np.sqrt(mean_squared_error(real, pred)))

        res = BacktestResult(mae=mae, rmse=rmse, y_real=real, y_pred=pred, dates=self.test_dates)
        self._backtest_cache = res
        return res

    def predict_next_open(self) -> dict[str, Any]:
        last_window = self.X_scaled[-self.LOOKBACK :]
        last_window = last_window.reshape(1, self.LOOKBACK, len(self.FEATURES))

        pred_next_scaled = self._model.predict(last_window, verbose=0)
        pred_next = self.scaler_y.inverse_transform(pred_next_scaled)[0][0]

        last_ts = pd.to_datetime(self.df["timestamp"].iloc[-1]).to_pydatetime()
        next_ts = last_ts + timedelta(days=1)

        last_open = float(self.df["open"].iloc[-1])
        delta = float(pred_next - last_open)
        delta_pct = float((delta / last_open) * 100.0) if last_open else 0.0

        return {
            "date_last": last_ts.date().isoformat(),
            "date_predicted_for": next_ts.date().isoformat(),
            "open_last": last_open,
            "open_pred_next": float(pred_next),
            "delta": delta,
            "delta_pct": delta_pct,
        }


def _iso_dates(arr: np.ndarray) -> list[str]:
    out: list[str] = []
    for x in arr:
        if isinstance(x, (np.datetime64, pd.Timestamp)):
            out.append(str(pd.to_datetime(x).date()))
        elif isinstance(x, datetime):
            out.append(x.date().isoformat())
        else:
            out.append(str(x))
    return out


def build_dashboard_payload(p: Predictor, last_n: int = 365) -> dict[str, Any]:
    df = p.df.copy()
    df_tail = df.tail(last_n)

    bt = p.backtest()

    # Últimos N puntos del backtest para graficar (si el test es menor, se recorta solo)
    tail_n = min(last_n, bt.y_real.shape[0])
    dates_bt = bt.dates[-tail_n:]
    real_bt = bt.y_real[-tail_n:, 0]
    pred_bt = bt.y_pred[-tail_n:, 0]

    next_pred = p.predict_next_open()

    # Señal educativa simple (no recomendación)
    trend_window = df_tail["close"].values
    momentum = float(trend_window[-1] - trend_window[0]) if len(trend_window) > 1 else 0.0
    momentum_pct = (
        float((trend_window[-1] / trend_window[0] - 1) * 100.0) if len(trend_window) > 1 and trend_window[0] else 0.0
    )

    risk_note: Literal["baja", "media", "alta"]
    vol = float(df_tail["close"].pct_change().std() * np.sqrt(365)) if len(df_tail) > 10 else 0.0
    if vol < 0.4:
        risk_note = "baja"
    elif vol < 0.8:
        risk_note = "media"
    else:
        risk_note = "alta"

    return {
        "meta": {
            "lookback": p.LOOKBACK,
            "features": list(p.FEATURES),
            "rows": int(df.shape[0]),
            "last_n": int(last_n),
        },
        "series": {
            "dates": _iso_dates(df_tail["timestamp"].to_numpy()),
            "open": df_tail["open"].astype(float).to_list(),
            "high": df_tail["high"].astype(float).to_list(),
            "low": df_tail["low"].astype(float).to_list(),
            "close": df_tail["close"].astype(float).to_list(),
            "volume": df_tail["volume"].astype(float).to_list(),
        },
        "backtest": {
            "mae": bt.mae,
            "rmse": bt.rmse,
            "dates": _iso_dates(dates_bt),
            "real": real_bt.astype(float).tolist(),
            "pred": pred_bt.astype(float).tolist(),
        },
        "next_prediction": next_pred,
        "insights": {
            "momentum_abs": momentum,
            "momentum_pct": momentum_pct,
            "annualized_volatility": vol,
            "risk_note": risk_note,
            "disclaimer": "Educativo. No es asesoría financiera. Bitcoin es volátil; gestiona riesgo (DCA, tamaño de posición, stop, horizonte).",
        },
    }

