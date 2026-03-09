const mqtt = require("mqtt");
const express = require("express");

const MQTT_BROKER_URL = "mqtt://localhost:1883";
const MQTT_TOPIC = "devices/telemetry";
const PORT = 3000;

const app = express();
const client = mqtt.connect(MQTT_BROKER_URL);

let messagesReceived = 0;
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

client.on("message", (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());

    if (!isValidTelemetry(payload)) {
      console.warn("Invalid telemetry received:", payload);
      return;
    }

    messagesReceived += 1;
    lastTelemetry = payload;

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

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mqttBroker: MQTT_BROKER_URL,
    topic: MQTT_TOPIC,
    messagesReceived,
    lastTelemetry,
  });
});

app.listen(PORT, () => {
  console.log(`HTTP server running at http://localhost:${PORT}`);
});
