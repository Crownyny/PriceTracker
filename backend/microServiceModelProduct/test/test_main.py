import pytest
import requests
import time

# -------------------------------
# URL correcta para Spring Boot controller
# -------------------------------
BASE_URL = "http://127.0.0.1:8080/api/intent/intent"

# -------------------------------
# Test data
# -------------------------------
buy_queries = [
    "auriculares samsung",
    "cargador 25wts",
    "laptop gamer barata",
    "iphone 15 pro max 256gb",
    "smart tv 55 pulgadas 4k"
]

not_buy_queries = [
    "prisma",
    "scrum",
    "metodologias agiles",
    "que es un algoritmo",
    "como aprender a programar python"
]

# -------------------------------
# Helper para POST con reintentos
# -------------------------------
def post_with_retry(url, json_data, retries=10, delay=0.5):
    """
    Hace POST a url con reintentos hasta que el servidor responda 200.
    """
    for i in range(retries):
        try:
            r = requests.post(url, json=json_data)
            if r.status_code == 200 or r.status_code == 422:
                return r
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(delay)
    raise RuntimeError(f"Server not responding at {url} after {retries} retries")

# -------------------------------
# Tests BUY
# -------------------------------
@pytest.mark.parametrize("query", buy_queries)
def test_predict_buy_intent(query):
    response = post_with_retry(BASE_URL, {"query": query})
    assert response.status_code == 200
    data = response.json()
    assert data["input"] == query
    assert data["label"] == "compra"
    assert "p_buy" in data
    assert "threshold" in data

# -------------------------------
# Tests NOT_BUY
# -------------------------------
@pytest.mark.parametrize("query", not_buy_queries)
def test_predict_not_buy_intent(query):
    response = post_with_retry(BASE_URL, {"query": query})
    assert response.status_code == 200
    data = response.json()
    assert data["input"] == query
    assert data["label"] == "no_compra"
    assert "p_buy" in data
    assert "threshold" in data

# -------------------------------
# Test invalid input
# -------------------------------
def test_invalid_input():
    response = post_with_retry(BASE_URL, {"invalid_key": "some_value"})
    assert response.status_code == 422