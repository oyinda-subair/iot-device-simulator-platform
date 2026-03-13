FROM python:3.11-slim

WORKDIR /app

COPY . .

RUN pip install paho-mqtt

CMD ["python", "device_simulator.py"]
