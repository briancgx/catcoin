from pathlib import Path
import requests
import pandas as pd
import time

ROOT = Path(__file__).resolve().parent.parent

url = "https://api.binance.com/api/v3/klines"

symbol = "BTCUSDT"
interval = "1d"

start = 0
limit = 1000

all_data = []

while True:
    params = {
        "symbol": symbol,
        "interval": interval,
        "limit": limit,
        "startTime": start
    }

    data = requests.get(url, params=params).json()

    if len(data) == 0:
        break

    all_data.extend(data)

    start = data[-1][0] + 1
    time.sleep(0.5)

df = pd.DataFrame(all_data)

df = df[[0,1,2,3,4,5]]

df.columns = [
    "timestamp",
    "open",
    "high",
    "low",
    "close",
    "volume"
]

df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")

df = df.astype({
    "open": float,
    "high": float,
    "low": float,
    "close": float,
    "volume": float
})

output_path = ROOT / "data" / "bitcoin_dataset_actualizado.csv"
output_path.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(output_path, index=False)

print("Dataset descargado")
print(df.tail())