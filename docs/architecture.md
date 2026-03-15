# Architecture Overview

## Components:

### 1. Device Simulator

A Python-based simulator that generates telemetry for virtual IoT devices and publishes messages to MQTT.

### 2. MQTT Broker

Mosquitto acts as the message broker between simulated devices and the backend ingestion service.

### 3. Ingestion Service

A Node.js service that:

- subscribes to MQTT telemetry
- validates messages
- stores telemetry in PostgreSQL
- broadcasts live updates over WebSockets
- evaluates alert rules

### 4. PostgreSQL

Stores telemetry history and device registry data.

### 5. Dashboard

A browser-based UI that displays:

- system statistics
- device cards
- telemetry charts
- live alerts
- connection status

## Data Flow

1. Simulator publishes telemetry
2. MQTT broker forwards telemetry
3. Ingestion service validates and stores data
4. Alerts are evaluated
5. WebSocket broadcasts live updates
6. Dashboard renders current system state
