from __future__ import annotations

from dataclasses import dataclass, field
from math import exp, log
from typing import Dict, Iterable, List, Set, Tuple


Label = str  # expected: "BUY" or "NOT_BUY"


def _tokenize(text: str) -> List[str]:
    if text is None:
        return []
    text = text.strip().lower()
    return [t for t in text.split() if t]


def _extract_ngrams(tokens: List[str], ngram_range: Tuple[int, int]) -> List[str]:
    """Generate n-grams from tokens."""
    min_n, max_n = ngram_range
    ngrams = []

    for n in range(min_n, max_n + 1):
        for i in range(len(tokens) - n + 1):
            ngram = " ".join(tokens[i:i + n])
            ngrams.append(ngram)

    return ngrams


@dataclass
class PurchaseIntentModel:
    """Binary Multinomial Naive Bayes with n-grams."""

    alpha: float = 1.0
    decision_threshold: float = 0.7
    ngram_range: Tuple[int, int] = (1, 2)  # 👈 nuevo

    # Learned state
    _vocabulary: Set[str] = field(default_factory=set, init=False)
    _token_counts: Dict[Label, Dict[str, int]] = field(default_factory=dict, init=False)
    _total_tokens: Dict[Label, int] = field(default_factory=dict, init=False)
    _log_prior: Dict[Label, float] = field(default_factory=dict, init=False)
    _trained: bool = field(default=False, init=False)

    def train(self, training_data: Dict[str, List[str]]) -> None:
        if not training_data:
            raise ValueError("training_data is required")
        if self.alpha <= 0:
            raise ValueError("alpha must be > 0")

        buy_samples = _get_samples(training_data, "BUY")
        not_buy_samples = _get_samples(training_data, "NOT_BUY")

        total_docs = len(buy_samples) + len(not_buy_samples)
        if total_docs == 0:
            raise ValueError("No training samples provided")

        # Reset
        self._vocabulary.clear()
        self._token_counts = {"BUY": {}, "NOT_BUY": {}}
        self._total_tokens = {"BUY": 0, "NOT_BUY": 0}

        # Priors
        self._log_prior = {
            "BUY": log(len(buy_samples) / total_docs) if buy_samples else float("-inf"),
            "NOT_BUY": log(len(not_buy_samples) / total_docs) if not_buy_samples else float("-inf"),
        }

        self._ingest("BUY", buy_samples)
        self._ingest("NOT_BUY", not_buy_samples)

        self._trained = True

    def predict_purchase_probability(self, query: str) -> float:
        self._ensure_trained()

        buy_score = self._log_posterior_score("BUY", query)
        not_buy_score = self._log_posterior_score("NOT_BUY", query)

        diff = not_buy_score - buy_score
        return 1.0 / (1.0 + exp(diff))

    def predict_label(self, query: str) -> Label:
        return "BUY" if self.predict_purchase_probability(query) >= self.decision_threshold else "NOT_BUY"

    # ---------------- internal ----------------

    def _ensure_trained(self) -> None:
        if not self._trained:
            raise RuntimeError("Model not trained. Call train(...) first.")

    def _ingest(self, label: Label, samples: Iterable[str]) -> None:
        for s in samples:
            tokens = _tokenize(s)
            ngrams = _extract_ngrams(tokens, self.ngram_range)

            for ng in ngrams:
                self._vocabulary.add(ng)
                self._token_counts[label][ng] = self._token_counts[label].get(ng, 0) + 1
                self._total_tokens[label] += 1

    def _log_posterior_score(self, label: Label, query: str) -> float:
        score = self._log_prior[label]
        v = len(self._vocabulary)
        denom = self._total_tokens[label] + self.alpha * v

        if denom <= 0:
            return float("-inf")

        counts = self._token_counts[label]

        tokens = _tokenize(query)
        ngrams = _extract_ngrams(tokens, self.ngram_range)

        for ng in ngrams:
            c = counts.get(ng, 0)
            score += log(c + self.alpha) - log(denom)

        return score


def _get_samples(training_data: Dict[str, List[str]], key: str) -> List[str]:
    for k, v in training_data.items():
        if k and k.lower() == key.lower():
            return v or []
    return []