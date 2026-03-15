const mqtt = require("mqtt");
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const { Pool } = require("pg");

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "devices/telemetry";
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const client = mqtt.connect(MQTT_BROKER_URL);

const dbPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "iot_user",
  password: process.env.DB_PASSWORD || "iot_password",
  database: process.env.DB_NAME || "iot_platform",
});

let messagesReceived = 0;
let messagesStored = 0;
let lastTelemetry = null;
let startTime = Date.now();

function isValidTelemetry(data) {
  return (
    typeof data.device_id === "string" &&
    typeof data.temperature === "number" &&
    typeof data.humidity === "number" &&
    typeof data.battery === "number" &&
    typeof data.motion === "boolean" &&
    typeof data.timestamp === "string"
  );
}

function evaluateAlerts(payload) {
  const alerts = [];

  if (payload.battery < 20) {
    alerts.push({
      type: "LOW_BATTERY",
      device_id: payload.device_id,
      value: payload.battery,
      message: `Battery low (${payload.battery}%)`,
      timestamp: payload.timestamp,
    });
  }

  if (payload.temperature > 35) {
    alerts.push({
      type: "HIGH_TEMPERATURE",
      device_id: payload.device_id,
      value: payload.temperature,
      message: `High temperature (${payload.temperature}°C)`,
      timestamp: payload.timestamp,
    });
  }

  if (payload.motion === true) {
    alerts.push({
      type: "MOTION_DETECTED",
      device_id: payload.device_id,
      message: `Motion detected`,
      timestamp: payload.timestamp,
    });
  }

  return alerts;
}

function broadcastWebSocketMessage(payload) {
  const message = JSON.stringify(payload);

  wss.clients.forEach((wsClient) => {
    if (wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(message);
    }
  });
}

async function waitForDatabase(retries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await dbPool.query("SELECT 1");
      console.log("Database connection established.");
      return;
    } catch (error) {
      console.log(`Database not ready yet (attempt ${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Database did not become ready in time.");
}

async function initializeDatabase() {
  const createDevicesTableQuery = `
    CREATE TABLE IF NOT EXISTS devices (
      id SERIAL PRIMARY KEY,
      device_id VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100),
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS telemetry (
      id SERIAL PRIMARY KEY,
      device_id VARCHAR(50) NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      battery INTEGER NOT NULL,
      motion BOOLEAN NOT NULL,
      timestamp TIMESTAMP NOT NULL
    );
  `;

  try {
    await dbPool.query(createDevicesTableQuery);
    await dbPool.query(createTableQuery);
    console.log("Device and Telemetry tables are ready.");
  } catch (error) {
    console.error("Failed to initialize database:", error.message);
    process.exit(1);
  }
}

async function storeTelemetry(payload) {
  const insertQuery = `
    INSERT INTO telemetry (
      device_id,
      temperature,
      humidity,
      battery,
      motion,
      timestamp
    )
    VALUES ($1, $2, $3, $4, $5, $6)
  `;

  const values = [
    payload.device_id,
    payload.temperature,
    payload.humidity,
    payload.battery,
    payload.motion,
    payload.timestamp,
  ];

  await dbPool.query(insertQuery, values);
  messagesStored += 1;
}

async function upsertDevice(deviceId) {
  const query = `
    INSERT INTO devices (device_id, status, updated_at)
    VALUES ($1, 'active', CURRENT_TIMESTAMP)
    ON CONFLICT (device_id)
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
  `;

  await dbPool.query(query, [deviceId]);
}

client.on("connect", () => {
  console.log(`Connected to MQTT broker at ${MQTT_BROKER_URL}`);

  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error("Failed to subscribe to topic:", err.message);
    } else {
      console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
    }
  });
});

client.on("message", async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());

    if (!isValidTelemetry(payload)) {
      console.warn("Invalid telemetry received:", payload);
      return;
    }

    messagesReceived += 1;
    lastTelemetry = payload;

    await upsertDevice(payload.device_id);
    await storeTelemetry(payload);

    const alerts = evaluateAlerts(payload);

    alerts.forEach((alert) => {
      broadcastWebSocketMessage({
        type: "alert",
        data: alert,
      });
    });

    if (messagesStored % 50 === 0) {
      console.log(`Stored ${messagesStored} telemetry messages so far`);
    }

    broadcastWebSocketMessage({
      type: "telemetry",
      data: payload,
    });
  } catch (error) {
    console.error("Error processing message:", error.message);
  }
});

client.on("error", (error) => {
  console.error("MQTT connection error:", error.message);
});

wss.on("connection", (wsClient) => {
  console.log("WebSocket client connected");

  wsClient.send(
    JSON.stringify({
      type: "connection",
      data: { message: "Connected to IoT telemetry stream" },
    }),
  );

  wsClient.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "IoT Telemetry Platform API is running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mqttBroker: MQTT_BROKER_URL,
    topic: MQTT_TOPIC,
    messagesReceived,
    messagesStored,
    lastTelemetry,
  });
});

app.get("/telemetry/count", async (req, res) => {
  try {
    const result = await dbPool.query(
      "SELECT COUNT(*) AS count FROM telemetry",
    );
    res.json({
      count: Number(result.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch telemetry count",
      details: error.message,
    });
  }
});

app.get("/devices", async (req, res) => {
  try {
    const query = `
      SELECT
        d.device_id,
        d.name,
        d.status,
        d.created_at,
        d.updated_at,
        MAX(t.timestamp) AS last_seen,
        COUNT(t.id) AS telemetry_count
      FROM devices d
      LEFT JOIN telemetry t ON d.device_id = t.device_id
      GROUP BY d.device_id, d.name, d.status, d.created_at, d.updated_at
      ORDER BY d.device_id;
    `;

    const result = await dbPool.query(query);

    res.json(
      result.rows.map((row) => ({
        device_id: row.device_id,
        name: row.name,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_seen: row.last_seen,
        telemetry_count: Number(row.telemetry_count),
      })),
    );
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch devices",
      details: error.message,
    });
  }
});

app.get("/devices/:id/telemetry", async (req, res) => {
  const deviceId = req.params.id;
  const parsedLimit = parseInt(req.query.limit, 10);
  const limit = Number.isNaN(parsedLimit) ? 20 : parsedLimit;

  try {
    const query = `
      SELECT
        id,
        device_id,
        temperature,
        humidity,
        battery,
        motion,
        timestamp
      FROM telemetry
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT $2;
    `;

    const result = await dbPool.query(query, [deviceId, limit]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch device telemetry",
      details: error.message,
    });
  }
});

app.get("/stats", async (req, res) => {
  try {
    const totalTelemetryQuery = `
      SELECT COUNT(*) AS total_messages
      FROM telemetry;
    `;

    const totalDevicesQuery = `
      SELECT COUNT(DISTINCT device_id) AS total_devices
      FROM telemetry;
    `;

    const avgTemperatureQuery = `
      SELECT ROUND(AVG(temperature)::numeric, 2) AS avg_temperature
      FROM telemetry;
    `;

    const avgBatteryQuery = `
      SELECT ROUND(AVG(battery)::numeric, 2) AS avg_battery
      FROM telemetry;
    `;

    const motionEventsQuery = `
      SELECT COUNT(*) AS motion_events
      FROM telemetry
      WHERE motion = true;
    `;

    const [
      totalTelemetry,
      totalDevices,
      avgTemperature,
      avgBattery,
      motionEvents,
    ] = await Promise.all([
      dbPool.query(totalTelemetryQuery),
      dbPool.query(totalDevicesQuery),
      dbPool.query(avgTemperatureQuery),
      dbPool.query(avgBatteryQuery),
      dbPool.query(motionEventsQuery),
    ]);

    res.json({
      total_messages: Number(totalTelemetry.rows[0].total_messages),
      total_devices: Number(totalDevices.rows[0].total_devices),
      avg_temperature: Number(avgTemperature.rows[0].avg_temperature || 0),
      avg_battery: Number(avgBattery.rows[0].avg_battery || 0),
      motion_events: Number(motionEvents.rows[0].motion_events),
      messagesReceived,
      messagesStored,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch stats",
      details: error.message,
    });
  }
});

app.get("/metrics", (req, res) => {
  const uptimeSeconds = (Date.now() - startTime) / 1000;
  const messagesPerSecond =
    uptimeSeconds > 0 ? (messagesStored / uptimeSeconds).toFixed(2) : 0;

  res.json({
    uptime_seconds: Number(uptimeSeconds.toFixed(2)),
    messages_received: messagesReceived,
    messages_stored: messagesStored,
    messages_per_second: Number(messagesPerSecond),
  });
});

// -----------------------------
// Post endpoints
// -----------------------------

// Register or update a device (idempotent)
app.post("/devices", async (req, res) => {
  const { device_id, name } = req.body;

  if (!device_id || typeof device_id !== "string") {
    return res.status(400).json({
      error: "device_id is required and must be a string",
    });
  }

  try {
    const query = `
      INSERT INTO devices (device_id, name, status)
      VALUES ($1, $2, 'active')
      ON CONFLICT (device_id)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, devices.name),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const result = await dbPool.query(query, [device_id, name || null]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to register device",
      details: error.message,
    });
  }
});

// -----------------------------
// Update  endpoints
// -----------------------------

// Disable a device (soft delete)
app.patch("/devices/:id/disable", async (req, res) => {
  const deviceId = req.params.id;

  try {
    const query = `
      UPDATE devices
      SET status = 'disabled',
          updated_at = CURRENT_TIMESTAMP
      WHERE device_id = $1
      RETURNING *;
    `;

    const result = await dbPool.query(query, [deviceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Device not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to disable device",
      details: error.message,
    });
  }
});

// Enable a device
app.patch("/devices/:id/enable", async (req, res) => {
  const deviceId = req.params.id;

  try {
    const query = `
      UPDATE devices
      SET status = 'active',
          updated_at = CURRENT_TIMESTAMP
      WHERE device_id = $1
      RETURNING *;
    `;

    const result = await dbPool.query(query, [deviceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Device not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to enable device",
      details: error.message,
    });
  }
});

// Update device name
app.patch("/devices/:id", async (req, res) => {
  const deviceId = req.params.id;
  const { name } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: "name must be a non-empty string",
    });
  }

  try {
    const query = `
      UPDATE devices
      SET name = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE device_id = $1
      RETURNING *;
    `;

    const result = await dbPool.query(query, [deviceId, name.trim()]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Device not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to update device",
      details: error.message,
    });
  }
});

async function startServer() {
  // uncomment the following line if you want to wait for the database to be ready before starting the server
  // await waitForDatabase();
  await initializeDatabase();

  server.listen(PORT, () => {
    console.log(
      `HTTP and WebSocket server running at http://localhost:${PORT}`,
    );
  });
}

startServer();
