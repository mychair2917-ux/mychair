# Stage 1: Build environment
FROM python:3.11-slim as builder

WORKDIR /build

# Install system compilation packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Final minimal execution image
FROM python:3.11-slim

WORKDIR /app

# Add path to pip installed binaries
ENV PATH=/root/.local/bin:$PATH

COPY --from=builder /root/.local /root/.local
COPY . /app

EXPOSE 8000

# Render injects $PORT dynamically; default to 8000 for local Docker.
# --proxy-headers: correct scheme/client IP behind Render's reverse proxy.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
