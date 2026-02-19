FROM python:3.11-slim

# Install curl for healthcheck and ensure pip is available
RUN apt-get update && apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/* && \
    python -m ensurepip --upgrade && \
    python -m pip install --upgrade pip setuptools wheel

WORKDIR /app

COPY orchestrator/requirements.txt ./

RUN python -m pip install --no-cache-dir -r requirements.txt

COPY orchestrator ./orchestrator

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["python", "-m", "uvicorn", "orchestrator.main:app", "--host", "0.0.0.0", "--port", "5000"]
