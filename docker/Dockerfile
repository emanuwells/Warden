FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Europe/Lisbon

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        cron \
        util-linux \
        procps \
        iproute2 \
        tzdata \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY src/requirements.txt /app/src/requirements.txt
RUN pip install --no-cache-dir -r /app/src/requirements.txt

COPY src /app/src
COPY scripts /app/scripts
COPY VERSION /app/VERSION

RUN mkdir -p /app/runtime/logs /app/runtime/cache /app/runtime/export /app/runtime/archive/weekly \
    && touch /app/runtime/logs/.gitkeep /app/runtime/cache/.gitkeep /app/runtime/export/.gitkeep /app/runtime/archive/.gitkeep \
    && chmod +x /app/scripts/docker-scheduler.sh

CMD ["python", "-m", "src.warden"]
