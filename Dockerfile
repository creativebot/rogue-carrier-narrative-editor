# Multi-stage lightweight Dockerfile for Rogue Carrier Narrative Editor
FROM python:3.11-slim

WORKDIR /app

# Ensure curl is available for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy dependency requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Ensure storage directories exist
RUN mkdir -p /app/saves /app/backups

# Expose dynamic PORT provided by host (default 8000)
ENV PORT=8000
EXPOSE 8000

# Run narrative editor server
CMD ["python", "server.py"]
