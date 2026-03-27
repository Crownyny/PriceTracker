from fastapi import FastAPI
from pydantic import BaseModel
import joblib

pipeline = joblib.load("Modelo1.pkl")

app = FastAPI()

class Query(BaseModel):
    text: str

@app.get("/")
def home():
    return {"status": "ok"}

@app.post("/predict")
def predict(query: Query):
    pred = pipeline.predict([query.text])[0]
    proba = pipeline.predict_proba([query.text])[0]
    print(f"Predicted intent: {pred} with confidence: {max(proba)} for query: '{query.text}'")
    return {
        "input": query.text,
        "intent": pred,
        "confidence": float(max(proba))
    }