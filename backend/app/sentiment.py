import re
import threading

from .config import SENTIMENT_BATCH_SIZE, SENTIMENT_MODE, SENTIMENT_MODEL

FALLBACK_METHOD = "fallback-lexicon"
MAX_CHARS = 2000   # characters kept per review
MAX_TOKENS = 256   # tokens fed to the model per review

DISCLAIMER = (
    "The model was trained on general social-media text, not specifically on airline "
    "reviews, so it can misjudge aviation wording. A high confidence score means the "
    "model is sure, not that it is correct."
)

_lock = threading.Lock()
_engine = None  # (tokenizer, model, id2label) once loaded; stays cached for the process
_status = {"state": "not_loaded", "method": None, "model": SENTIMENT_MODEL,
           "mode": SENTIMENT_MODE, "error": None}

# Very small word lists for the clearly labelled fallback. It ignores negation
# ("not good") and context, so it is much weaker than the transformer.
POSITIVE = {"good", "great", "excellent", "friendly", "comfortable", "smooth", "lovely",
            "amazing", "wonderful", "love", "loved", "clean", "helpful", "perfect",
            "easy", "best", "pleasant", "recommend", "fantastic", "awesome", "nice"}
NEGATIVE = {"bad", "terrible", "awful", "rude", "dirty", "delayed", "delay", "delays",
            "lost", "cramped", "worst", "unhelpful", "horrible", "poor", "late",
            "cancelled", "canceled", "uncomfortable", "disappointing", "disappointed",
            "unprofessional", "filthy", "broken"}


def preprocess(text) -> str:
    """Clean a review before it goes to the model."""
    text = str(text or "")
    text = re.sub(r"https?://\S+", "http", text)   # the model expects this style
    text = re.sub(r"(?<!\w)@\w+", "@user", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_CHARS]


def status() -> dict:
    return {**_status, "disclaimer": DISCLAIMER}


def _get_engine():
    """Load the model once. Returns None when the fallback is being used."""
    global _engine
    with _lock:
        if _status["state"] in ("ready", "fallback"):
            return _engine
        if SENTIMENT_MODE == "fallback":
            _status.update(state="fallback", method=FALLBACK_METHOD,
                           error="SENTIMENT_MODE is set to 'fallback'")
            return None
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            tok = AutoTokenizer.from_pretrained(SENTIMENT_MODEL)
            model = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL)
            model.eval()
            id2label = {int(k): v.lower() for k, v in model.config.id2label.items()}
            _engine = (tok, model, id2label)
            _status.update(state="ready", method="transformer", error=None)
            return _engine
        except Exception as e:  # noqa: BLE001 - any load problem is handled here
            msg = f"Transformer could not be loaded: {str(e)[:300]}"
            if SENTIMENT_MODE == "transformer":
                raise RuntimeError(msg) from e
            _status.update(state="fallback", method=FALLBACK_METHOD, error=msg)
            return None


def _fallback(text: str) -> dict:
    words = re.findall(r"[a-z']+", text.lower())
    score = sum(w in POSITIVE for w in words) - sum(w in NEGATIVE for w in words)
    if score > 0:
        label, conf = "positive", min(0.9, 0.55 + 0.1 * score)
    elif score < 0:
        label, conf = "negative", min(0.9, 0.55 + 0.1 * -score)
    else:
        label, conf = "neutral", 0.5
    # The confidence here is a rough heuristic, not a probability.
    return {"label": label, "confidence": round(conf, 4), "scores": None,
            "method": FALLBACK_METHOD, "model": None}


def predict(texts: list) -> list:
    """Predict sentiment for a list of texts, in batches."""
    cleaned = [preprocess(t) for t in texts]
    if any(not t for t in cleaned):
        raise ValueError("Text is empty after cleaning.")

    engine = _get_engine()
    if engine is None:
        return [_fallback(t) for t in cleaned]

    import torch
    tok, model, id2label = engine
    results = []
    for i in range(0, len(cleaned), SENTIMENT_BATCH_SIZE):
        batch = cleaned[i:i + SENTIMENT_BATCH_SIZE]
        enc = tok(batch, padding=True, truncation=True, max_length=MAX_TOKENS,
                  return_tensors="pt")
        with torch.no_grad():
            probs = torch.softmax(model(**enc).logits, dim=-1).tolist()
        for p in probs:
            scores = {id2label[j]: round(v, 4) for j, v in enumerate(p)}
            label = max(scores, key=scores.get)
            results.append({"label": label, "confidence": scores[label], "scores": scores,
                            "method": "transformer", "model": SENTIMENT_MODEL})
    return results
