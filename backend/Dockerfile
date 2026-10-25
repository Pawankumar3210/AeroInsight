FROM python:3.11-slim

# Spark needs Java. Debian "trixie" (used by this base image) provides Java 21.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s "$(dirname "$(dirname "$(readlink -f "$(which java)")")")" /opt/java

ENV JAVA_HOME=/opt/java \
    PYTHONUNBUFFERED=1 \
    SPARK_LOCAL_IP=127.0.0.1 \
    HF_HOME=/models

WORKDIR /app

# CPU-only PyTorch first (the default build is much larger)
RUN pip install --no-cache-dir torch==2.2.2 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Download the sentiment model while building, so the server does not
# have to download about 500 MB when it first starts.
RUN python -m app.download_model

# Hosts like Render set PORT; locally it defaults to 8000.
EXPOSE 8000
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
