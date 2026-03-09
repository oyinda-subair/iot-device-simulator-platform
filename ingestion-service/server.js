const mqtt = require("mqtt");
const express = require("express");
const { Pool } = require("pg");

const MQTT_BROKER_URL = "mqtt://localhost:1883";
const MQTT_TOPIC = "devices/telemetry";
const PORT = 3000;

const app = express();
const client = mqtt.connect(MQTT_BROKER_URL);

const dbPool = new Pool({
  host: "localhost",
  port: 5432,
  user: "iot_user",
  password: "iot_password",
  database: "iot_platform",
});

let messagesReceived = 0;
let messagesStored = 0;
let lastTelemetry = null;

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

async function initializeDatabase() {
  // TODO: Add created_at for cleaner queries and data management
  // created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

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
    await dbPool.query(createTableQuery);
    console.log("Telemetry table is ready.");
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

    await storeTelemetry(payload);

    console.log(
      `[${payload.timestamp}] ${payload.device_id} | ` +
        `temp=${payload.temperature}C | ` +
        `humidity=${payload.humidity}% | ` +
        `battery=${payload.battery}% | ` +
        `motion=${payload.motion}`,
    );
  } catch (error) {
    console.error("Error parsing message:", error.message);
  }
});

client.on("error", (error) => {
  console.error("MQTT connection error:", error.message);
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
    console.error("Failed to fetch telemetry count:", error.message);
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
      device_id,
      MAX(timestamp) AS last_seen,
      COUNT(*) AS telemetry_count
    FROM telemetry
    GROUP BY device_id
    ORDER BY device_id;
    `;

    const result = await dbPool.query(query);

    res.json(
      result.rows.map((row) => ({
        device_id: row.device_id,
        last_seen: row.last_seen,
        telemetry_count: Number(row.telemetry_count),
      })),
    );
  } catch (error) {
    console.error("Failed to fetch devices:", error.message);
    res.status(500).json({
      error: "Failed to fetch devices",
      details: error.message,
    });
  }
});

app.get("/devices/:id/telemetry", async (req, res) => {
  const deviceId = req.params.id;
  const limit = Number(req.query.limit) || 20;

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

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`HTTP server running at http://localhost:${PORT}`);
  });
}

startServer();
