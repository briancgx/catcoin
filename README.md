# CatCoin — Bitcoin Predictor

Plataforma web que combina redes neuronales LSTM (Long Short-Term Memory) con modelos de lenguaje (LLM) para analizar el comportamiento historico de Bitcoin y generar estimaciones sobre su precio de apertura, acompanadas de un asistente de inteligencia artificial que interpreta los datos en tiempo real.

---

## Propuesta de valor

- **Modelo LSTM entrenado con +3100 dias de datos reales** de Bitcoin desde Binance, capaz de identificar patrones temporales en series de precio y volumen
- **Asistente IA contextual** que no responde en vacio: recibe las metricas reales del dashboard (prediccion, MAE, RMSE, volatilidad, momentum) y genera analisis fundamentados
- **Interactividad total**: cada grafica, tarjeta y seccion del dashboard es clickeable y dispara consultas contextuales a la IA
- **Datos vivos**: el sistema se auto-actualiza diariamente desde la API de Binance sin intervencion manual

---

## Arquitectura

```
descargar.py                    model.ipynb
     |                               |
     v                               v
Binance API ──> CSV dataset    Entrena LSTM ──> modelo .h5
                    |                               |
                    └───────────┬───────────────────┘
                                v
                    FastAPI (app/main.py)
                    ├── predictor.py (inferencia)
                    ├── API REST (6 endpoints)
                    ├── Landing educativa
                    └── Dashboard interactivo
                         ├── Graficas Plotly.js
                         ├── Metricas backtest
                         └── Chatbot IA (Groq/OpenAI)
```

---

## Modelo LSTM — Detalles tecnicos

### Pipeline de datos

- **Fuente:** API publica de Binance (`/api/v3/klines`), par BTCUSDT, velas diarias
- **Features de entrada (X):** `open`, `high`, `low`, `close`, `volume` (5 columnas)
- **Target (y):** precio de apertura del siguiente periodo (`open.shift(-1)`)
- **Normalizacion:** MinMaxScaler independiente para X e y (escala a rango [0, 1])
- **Ventana temporal (lookback):** 60 periodos — cada muestra contiene 60 registros consecutivos
- **Forma de los datos:** `X_seq = (3062, 60, 5)` — 3062 muestras, 60 timesteps, 5 features
- **Split:** 80% train (2449 muestras) / 20% test (613 muestras), secuencial sin shuffle

### Arquitectura de la red

```
Layer                    Output Shape     Parametros
─────────────────────────────────────────────────────
LSTM (64 unidades)       (None, 64)       17,920
Dropout (0.2)            (None, 64)       0
Dense (32, relu)         (None, 32)       2,080
Dense (1, linear)        (None, 1)        33
─────────────────────────────────────────────────────
Total:                                    20,033 (~78 KB)
```

- **LSTM (64 unidades):** Capa recurrente con celdas de memoria y gates (forget, input, output) que captura dependencias temporales en secuencias de 60 periodos
- **Dropout (0.2):** Regularizacion que desactiva aleatoriamente 20% de neuronas durante entrenamiento para evitar sobreajuste
- **Dense (32, relu):** Capa fully-connected para combinacion no-lineal de features
- **Dense (1):** Salida escalar con el precio estimado

### Entrenamiento

| Parametro | Valor |
|---|---|
| Optimizador | Adam |
| Funcion de perdida | MSE (Mean Squared Error) |
| Epochs | 100 |
| Batch size | 8 |
| Validacion | Sobre el 20% test |

### Metricas obtenidas

| Metrica | Valor | Interpretacion |
|---|---|---|
| **MAE** | $7,001.49 USD | Error promedio absoluto |
| **RMSE** | $8,075.99 USD | Error cuadratico medio (penaliza errores grandes) |

El modelo logra capturar la tendencia general del mercado y seguir los movimientos de precio con un margen de error coherente para un activo de alta volatilidad como Bitcoin.

---

## Integracion con LLM — Asistente IA

El chatbot no es un wrapper generico. Recibe como contexto un snapshot completo del estado actual del dashboard:

```
- Ultimo precio de apertura y cierre
- Prediccion LSTM y delta porcentual
- MAE y RMSE del backtest
- Momentum absoluto y porcentual
- Volatilidad anualizada
- Nivel de riesgo calculado
```

Con estos datos, el LLM genera respuestas fundamentadas en numeros reales, no en conocimiento generico. Soporta dos proveedores:

| Proveedor | Modelo | Uso |
|---|---|---|
| Groq | Llama 3.3 70B | Prioridad (inferencia rapida) |
| OpenAI | GPT-3.5-turbo | Fallback |

Ademas, las graficas de Plotly.js tienen listeners que al hacer clic o zoom generan preguntas contextuales automaticas a la IA (por ejemplo: "hiciste clic en la fecha X con precio Y, ¿que paso con Bitcoin en ese periodo?").

---

## Stack tecnologico

| Capa | Tecnologia |
|---|---|
| Machine Learning | TensorFlow/Keras (LSTM), scikit-learn (MinMaxScaler, metricas) |
| Backend | FastAPI, Python 3.12, Uvicorn |
| Datos | Pandas, NumPy, API de Binance |
| Frontend | HTML/CSS/JS vanilla, Plotly.js (graficas interactivas) |
| LLM | Groq (Llama 3.3 70B) / OpenAI (GPT-3.5-turbo) via SDK de OpenAI |
| Despliegue | Render (tensorflow-cpu) |

---

## Estructura del proyecto

```
catcoin/
├── app/
│   ├── main.py                  # FastAPI: rutas, endpoints, chatbot IA
│   ├── services/
│   │   └── predictor.py         # Clase Predictor: carga modelo, backtest, inferencia
│   ├── templates/
│   │   ├── landing.html         # Pagina educativa sobre Bitcoin
│   │   └── index.html           # Dashboard interactivo
│   └── static/
│       ├── css/style.css        # Estilos (glassmorphism dark mode)
│       └── js/app.js            # Logica del dashboard, graficas Plotly, chatbot
├── model.ipynb                  # Notebook: entrenamiento del modelo LSTM
├── descargar.py                 # Script: descarga datos de Binance
├── bitcoin_dataset_actualizado.csv  # Dataset OHLCV diario (~3100+ filas)
├── bitcoin_price_predictor.h5   # Modelo LSTM entrenado (formato HDF5)
├── requirements.txt             # Dependencias Python
└── .python-version              # Python 3.12.10
```

---

## Endpoints de la API

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/` | Landing page educativa sobre Bitcoin |
| `GET` | `/dashboard` | Dashboard interactivo con graficas y prediccion |
| `GET` | `/api/health` | Estado del servidor y filas en dataset |
| `GET` | `/api/dashboard?last_n=365` | JSON con series OHLCV, backtest, prediccion e insights |
| `GET` | `/api/predict-next` | Estimacion del precio de apertura del siguiente periodo |
| `POST` | `/api/assistant` | Chatbot IA contextual con datos del dashboard |

---

## Instalacion y ejecucion

### Requisitos previos

- Python 3.10+
- pip

### Pasos

```bash
# 1. Clonar el repositorio
git clone git@github.com:briancgx/catcoin.git
cd catcoin

# 2. Crear entorno virtual
python -m venv .venv
source .venv/bin/activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Configurar variables de entorno (para el chatbot IA)
# Crear archivo .env en la raiz y agregar GROQ_API_KEY o OPENAI_API_KEY

# 5. Descargar datos de Binance (opcional, se auto-actualiza al iniciar el servidor)
python descargar.py

# 6. Ejecutar el servidor
uvicorn app.main:app --reload
```

Abrir en el navegador: `http://127.0.0.1:8000`

### Variables de entorno

| Variable | Descripcion | Requerida |
|---|---|---|
| `GROQ_API_KEY` | API key de Groq (prioridad para el chatbot) | Una de las dos |
| `OPENAI_API_KEY` | API key de OpenAI (fallback para el chatbot) | Una de las dos |

---

## Funcionalidades

### Landing page educativa
- Que es Bitcoin: descentralizacion, escasez (21M), criptografia
- Historia: whitepaper 2008, bloque genesis 2009, Pizza Day 2010, ETF 2024
- Video explicativo embebido
- IA contextual: clic en cualquier seccion para obtener explicaciones generadas por la IA

### Dashboard interactivo
- **Estimacion LSTM:** Precio de apertura estimado con delta y porcentaje de cambio
- **Metricas de backtest:** MAE y RMSE sobre conjunto de prueba (split 80/20)
- **Insights del mercado:** Momentum (tendencia del periodo), volatilidad anualizada, nivel de riesgo (baja/media/alta)
- **Grafica OHLC + Volumen:** Candlestick chart interactivo con Plotly.js
- **Grafica de backtest:** Comparacion visual valores reales vs estimaciones del modelo
- **Chatbot IA:** Asistente que responde usando datos reales del dashboard como contexto
- **Tooltips contextuales:** Clic en puntos de las graficas o tarjetas para obtener analisis de la IA
- **Configuracion:** Selector de ventana temporal (90-1500 dias), refresh, health check

### Auto-actualizacion
El servidor verifica diariamente si el dataset esta actualizado. Si no lo esta, ejecuta automaticamente `descargar.py` para obtener los datos mas recientes de Binance y recarga el predictor con los nuevos datos.
