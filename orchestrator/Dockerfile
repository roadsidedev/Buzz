FROM python:3.11-slim

# Ensure pip is available and upgrade it
RUN python -m ensurepip --upgrade && \
    python -m pip install --upgrade pip setuptools wheel

WORKDIR /app

COPY orchestrator/requirements.txt ./

RUN python -m pip install --no-cache-dir -r requirements.txt

COPY orchestrator ./orchestrator

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

CMD ["python", "-m", "uvicorn", "orchestrator.main:app", "--host", "0.0.0.0", "--port", "5000", "--reload"]
