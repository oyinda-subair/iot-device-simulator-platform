# IoT Device Simulator + Cloud Telemetry Platform

This project simulates thousands of IoT devices sending telemetry data
to a cloud backend in real time.

The system demonstrates:

- device simulation
- MQTT messaging
- real-time telemetry ingestion
- database storage
- dashboard visualization
- scalable architecture

## Architecture

Device Simulator → MQTT Broker → Ingestion Service → Database → Dashboard

## Load Testing

The platform was load-tested with progressively increasing device counts to evaluate ingestion throughout and identify bottlenecks in logging and per message database writes.

```bash
DEVICE_COUNT=50 PUBLISH_INTERVAL=5 python3 device_simulator.py
```

```bash
DEVICE_COUNT=100 PUBLISH_INTERVAL=3 python3 device_simulator.py
```

```bash
DEVICE_COUNT=500 PUBLISH_INTERVAL=2 python3 device_simulator.py
```

```bash
DEVICE_COUNT=1000 PUBLISH_INTERVAL=1 python3 device_simulator.py
```
