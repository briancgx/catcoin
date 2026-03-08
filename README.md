# CatCoin — Bitcoin Predictor

Plataforma web educativa que predice el precio de apertura de Bitcoin del dia siguiente utilizando una red neuronal LSTM (Long Short-Term Memory), desarrollada para el **Hackathon Bitcoin Mexico 2026**, el primer hackathon educativo de Bitcoin en Mexico.

> **Disclaimer:** Proyecto educativo. No es asesoria financiera. Bitcoin es volatil; gestiona riesgo.

---

## Sobre el Hackathon

| Detalle | Info |
|---|---|
| **Evento** | [Hackathon Bitcoin Mexico](https://www.hackathonbitcoin.com/es) |
| **Tematica** | Herramientas educativas sobre Bitcoin — 39 horas para construir |
| **Fechas** | 6-7 marzo 2026 |
| **Modalidad** | Online + sedes presenciales (La Casa de Satoshi CDMX, Hub Tecnologico Merida) |
| **Premios** | $16,000 MXN totales (pagados en Bitcoin) |

### Criterios de evaluacion

| Criterio | Puntos | Como lo cumplimos |
|---|---|---|
| Precision conceptual Bitcoin | 10 pts | Landing educativa con historia, whitepaper, escasez, descentralizacion |
| Interactividad y engagement | 10 pts | Dashboard interactivo, graficas clickeables con IA contextual, chatbot |
| Utilidad y potencial adopcion | 10 pts | Datos reales de Binance, prediccion diaria automatizada, UI en espanol |
| Diseno y UX | 5 pts | Glassmorphism dark mode, responsive, animaciones, Plotly.js |
| Ejecucion tecnica | 5 pts | LSTM con TensorFlow, FastAPI, API de Binance, integracion con LLM |

---

## Que hace este proyecto

1. **Descarga datos historicos** de Bitcoin (BTCUSDT) desde la API de Binance (~3100+ dias de velas diarias desde 2017)
2. **Entrena una red neuronal LSTM** con series de tiempo para aprender patrones en precio y volumen
3. **Predice el precio de apertura** del dia siguiente basandose en los ultimos 60 dias de datos
4. **Despliega un dashboard web** con graficas interactivas, metricas de backtest y un asistente IA
5. **Actualiza datos automaticamente** cada dia desde Binance sin intervencion manual

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

- **Fuente:** API publica de Binance (`/api/v3/klines`), par BTCUSDT, intervalo diario
- **Features de entrada (X):** `open`, `high`, `low`, `close`, `volume` (5 columnas)
- **Target (y):** `open` del dia siguiente (`open.shift(-1)`)
- **Normalizacion:** MinMaxScaler independiente para X e y (escala a rango [0, 1])
- **Ventana temporal (lookback):** 60 dias — cada muestra de entrada contiene 60 dias consecutivos
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

- **LSTM (64 unidades):** Capa recurrente con celdas de memoria y gates (forget, input, output) que captura dependencias temporales en secuencias de 60 dias
- **Dropout (0.2):** Regularizacion que desactiva aleatoriamente 20% de neuronas durante entrenamiento para evitar sobreajuste
- **Dense (32, relu):** Capa fully-connected para combinacion no-lineal de features
- **Dense (1):** Capa de salida que produce el precio de apertura predicho (valor escalar)

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
| **MAE** | $7,001.49 USD | Error promedio absoluto de la prediccion |
| **RMSE** | $8,075.99 USD | Error cuadratico medio (penaliza mas errores grandes) |

Con Bitcoin en rango ~$65K-$73K, esto representa un error relativo de ~10%. El modelo captura la tendencia general del mercado, coherente con su proposito educativo.

---

## Stack tecnologico

| Capa | Tecnologia |
|---|---|
| Machine Learning | TensorFlow/Keras (LSTM), scikit-learn (MinMaxScaler, metricas) |
| Backend | FastAPI, Python 3.12, Uvicorn |
| Datos | Pandas, NumPy, API de Binance |
| Frontend | HTML/CSS/JS vanilla, Plotly.js (graficas interactivas) |
| LLM (Chatbot) | Groq (Llama 3.3 70B) / OpenAI (GPT-3.5-turbo) via SDK de OpenAI |
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
├── .python-version              # Python 3.12.10
└── .env                         # Variables de entorno (no incluido en repo)
```

---

## Endpoints de la API

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/` | Landing page educativa sobre Bitcoin |
| `GET` | `/dashboard` | Dashboard interactivo con graficas y prediccion |
| `GET` | `/api/health` | Estado del servidor y filas en dataset |
| `GET` | `/api/dashboard?last_n=365` | JSON con series OHLCV, backtest, prediccion e insights |
| `GET` | `/api/predict-next` | Prediccion del precio de apertura del dia siguiente |
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

## Funcionalidades principales

### Landing page educativa
- Que es Bitcoin: descentralizacion, escasez (21M), criptografia
- Historia: whitepaper 2008, bloque genesis 2009, Pizza Day 2010, ETF 2024
- Video explicativo embebido
- Seccion del equipo
- IA contextual: clic en cualquier seccion para obtener explicaciones de la IA

### Dashboard interactivo
- **Prediccion LSTM:** Precio de apertura estimado para manana con delta y porcentaje de cambio
- **Metricas de backtest:** MAE y RMSE del modelo sobre el conjunto de prueba (80/20)
- **Insights del mercado:** Momentum (tendencia), volatilidad anualizada, nivel de riesgo (baja/media/alta)
- **Grafica OHLC + Volumen:** Candlestick chart interactivo con Plotly.js
- **Grafica de backtest:** Comparacion visual de valores reales vs predicciones del modelo
- **Chatbot IA:** Asistente que responde preguntas usando datos reales del dashboard como contexto
- **Tooltips contextuales:** Clic en puntos de las graficas o tarjetas para obtener explicaciones de la IA
- **Configuracion:** Selector de ventana temporal (90-1500 dias), refresh, health check

### Auto-actualizacion
El servidor verifica diariamente si el dataset esta actualizado. Si no lo esta, ejecuta automaticamente `descargar.py` para obtener los datos mas recientes de Binance y recarga el modelo con los nuevos datos.

---

## Equipo

Proyecto desarrollado para el Hackathon Bitcoin Mexico 2026.
