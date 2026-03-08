# CatCoin — Bitcoin Predictor

Plataforma web que combina redes neuronales LSTM con modelos de lenguaje (LLM) para analizar el comportamiento historico de Bitcoin y generar estimaciones de precio, acompanadas de un asistente de inteligencia artificial que interpreta los datos en tiempo real.

---

## Que hace

- **Analiza anos de datos reales** de Bitcoin desde Binance y aprende patrones con una red neuronal LSTM
- **Genera estimaciones de precio** basadas en ventanas temporales de los ultimos 60 periodos
- **Asistente IA contextual** que recibe las metricas vivas del dashboard y responde con analisis fundamentado, no respuestas genericas
- **Todo interactivo**: clic en cualquier punto de las graficas o tarjetas para que la IA explique que esta pasando
- **Se auto-actualiza** diariamente desde la API de Binance sin intervencion manual

---

## Como funciona el modelo

La red neuronal LSTM (Long Short-Term Memory) es un tipo de red recurrente disenada para aprender patrones en secuencias temporales. En este caso:

1. Se alimenta con datos historicos OHLCV (apertura, maximo, minimo, cierre, volumen)
2. Toma ventanas deslizantes de 60 periodos como entrada
3. Aprende a estimar el precio de apertura del siguiente periodo
4. Se evalua con un backtest automatico (split 80/20 secuencial) que mide MAE y RMSE

El modelo se entrena en el notebook y se exporta como archivo `.h5` que el servidor carga para hacer inferencia en tiempo real.

---

## Asistente IA

El chatbot no es un wrapper generico. Recibe un snapshot completo del estado actual del dashboard: ultimo precio, estimacion LSTM, metricas de error del backtest, momentum, volatilidad y nivel de riesgo. Con esos datos genera respuestas basadas en numeros reales.

Soporta **Groq** (Llama 3.3 70B) como prioridad y **OpenAI** (GPT-3.5-turbo) como fallback.

Las graficas de Plotly.js tienen listeners que al hacer clic o zoom generan preguntas contextuales automaticas a la IA.

---

## Stack

| Capa | Tecnologia |
|---|---|
| Machine Learning | TensorFlow/Keras (LSTM), scikit-learn |
| Backend | FastAPI, Python 3.12 |
| Datos | Pandas, NumPy, API de Binance |
| Frontend | HTML/CSS/JS, Plotly.js |
| LLM | Groq / OpenAI |
| Despliegue | Render |

---

## Estructura

```
catcoin/
├── app/
│   ├── main.py              # FastAPI: rutas, endpoints, chatbot
│   ├── services/
│   │   └── predictor.py      # Carga modelo, backtest, inferencia
│   ├── templates/
│   │   ├── landing.html      # Pagina educativa sobre Bitcoin
│   │   └── index.html        # Dashboard interactivo
│   └── static/
│       ├── css/style.css
│       └── js/app.js
├── data/
│   ├── bitcoin_dataset_actualizado.csv
│   └── bitcoin_price_predictor.h5
├── notebooks/
│   └── model.ipynb           # Entrenamiento del modelo LSTM
├── scripts/
│   └── descargar.py          # Descarga datos de Binance
├── requirements.txt
└── .python-version
```

---

## Instalacion

```bash
git clone git@github.com:briancgx/catcoin.git
cd catcoin

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

Crear un archivo `.env` en la raiz con `GROQ_API_KEY` o `OPENAI_API_KEY` para habilitar el asistente IA.

```bash
uvicorn app.main:app --reload
```

Abrir `http://127.0.0.1:8000`

---

## Funcionalidades

### Landing educativa
Pagina introductoria sobre Bitcoin: descentralizacion, escasez, criptografia, historia desde el whitepaper de 2008 hasta los ETFs de 2024, video explicativo y seccion del equipo. Cada seccion es clickeable para obtener explicaciones generadas por la IA.

### Dashboard
- Estimacion LSTM con delta y porcentaje de cambio
- Metricas de backtest del modelo
- Insights: momentum, volatilidad anualizada, nivel de riesgo
- Grafica OHLC + volumen (candlestick interactivo)
- Grafica de backtest: valores reales vs estimaciones
- Chatbot IA con contexto del dashboard
- Tooltips contextuales en graficas y tarjetas
- Selector de ventana temporal configurable
