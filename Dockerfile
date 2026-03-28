FROM python:3.11-slim

WORKDIR /app

# Installa le dipendenze prima del COPY per sfruttare la cache Docker
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copia il resto del codice
COPY . .

# Railway inietta automaticamente $PORT
CMD ["/bin/sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"]
