# Architecture Overview

Components:

1. Device Simulator
   Simulates thousands of IoT devices sending telemetry data.

2. MQTT Broker
   Handles message communication between devices and backend.

3. Ingestion Service
   Receives telemetry and stores it in the database.

4. Database
   Stores telemetry data.

5. Dashboard
   Displays real-time device metrics.
