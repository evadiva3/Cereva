FROM python:3.13-slim AS base

ENV PYTHONUNBUFFERED=1 \
PYTHONDONTWRITEBYTECODE=1 \
PIP_NO_CACHE_DIR=1 \
PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY cereva_proxy ./cereva_proxy

USER 65534:65534

EXPOSE 8000

ENV FORWARDED_ALLOW_IPS=127.0.0.1

CMD ["sh", "-c", "exec uvicorn cereva_proxy.main:app \
     --host 0.0.0.0 --port 8000 \
     --no-access-log --proxy-headers \
     --forwarded-allow-ips \"$FORWARDED_ALLOW_IPS\""]
