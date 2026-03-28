from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

from purchase_intent_model import PurchaseIntentModel
from settings import Settings
from training_data_loader import TrainingDataLoader

app = FastAPI()


class Query(BaseModel):
    query: str


# --- App wiring (SOLID/SRP): settings + loader + model ---
settings = Settings()
training_data = TrainingDataLoader(csv_path=Path(settings.training_data_path)).load()

model = PurchaseIntentModel(alpha=settings.alpha, decision_threshold=settings.decision_threshold)
model.train(training_data)


@app.get("/")
def home():
    return {"status": "ok"}


@app.post("/predict")
def predict(query: Query):
    p_buy = model.predict_purchase_probability(query.query)
    label = model.predict_label(query.query)

    return {
        "input": query.query,
        "p_buy": float(p_buy),
        "label": label,
        "threshold": float(model.decision_threshold),
    }
    new = 'from pathlib import Path\n\n' + new