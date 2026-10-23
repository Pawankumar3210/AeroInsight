"""Run once:  python -m app.download_model"""
import os
import time

os.environ["SENTIMENT_MODE"] = "transformer"  # fail loudly, never use the fallback here

from . import sentiment as sent  # noqa: E402

samples = [
    "The flight was delayed three hours and the staff were rude.",
    "Lovely crew, comfortable seats, would fly again.",
    "The flight departed at 9am and landed at 11am.",
]
start = time.time()
print(f"Loading {sent.SENTIMENT_MODEL} (first run downloads about 500 MB)...")
results = sent.predict(samples)
for text, r in zip(samples, results):
    print(f"{r['label']:>8} {r['confidence']:.2f} [{r['method']}]  {text}")
print(f"Done in {time.time() - start:.1f}s. Status: {sent.status()['state']}")
