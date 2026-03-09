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

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

RUN mkdir -p /app/runtime/logs /app/runtime/cache /app/runtime/export /app/runtime/archive/weekly \
    && touch /app/runtime/logs/.gitkeep /app/runtime/cache/.gitkeep /app/runtime/export/.gitkeep /app/runtime/archive/.gitkeep \
    && chmod +x /app/scripts/docker-scheduler.sh

CMD ["python", "warden.py"]
