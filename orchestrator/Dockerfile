FROM python:3.11-slim

# Install curl for healthcheck and ensure pip is available
RUN apt-get update && apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/* && \
    python -m ensurepip --upgrade && \
    python -m pip install --upgrade pip setuptools wheel

WORKDIR /app

# Copy requirements from the orchestrator directory
COPY orchestrator/requirements.txt ./

RUN python -m pip install --no-cache-dir -r requirements.txt

# Copy the orchestrator package subdirectory to /app/orchestrator
# This maps /orchestrator/orchestrator to /app/orchestrator
COPY orchestrator/orchestrator ./orchestrator
# Also copy src if it's used by the orchestrator
COPY orchestrator/src ./src

# Set PYTHONPATH so Python can find the orchestrator package
# The orchestrator.main:app expects 'orchestrator' to be a package in PYTHONPATH
ENV PYTHONPATH=/app
# Ensure logs are sent to stdout/stderr immediately
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

# Healthcheck disabled - Railway handles this via UI
# HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
#   CMD curl -f http://localhost:5000/health || exit 1

# Start the uvicorn server
# The module is 'orchestrator.main' and the app is 'app'
CMD ["python", "-m", "uvicorn", "orchestrator.main:app", "--host", "0.0.0.0", "--port", "5000"]
