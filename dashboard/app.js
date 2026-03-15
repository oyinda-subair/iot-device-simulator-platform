const API_BASE_URL = "http://localhost:3000";
const WS_URL = "ws://localhost:3000";

let selectedDeviceId = "device_001";

let temperatureChartInstance = null;
let batteryChartInstance = null;
let humidityChartInstance = null;

let socket = null;

function formatDate(value) {
  return new Date(value).toLocaleString();
}

async function fetchStats() {
  const statsContainer = document.getElementById("stats");

  try {
    const response = await fetch(`${API_BASE_URL}/stats`);
    const stats = await response.json();

    statsContainer.innerHTML = `
      <div class="card">
        <h3>Total Messages</h3>
        <p>${stats.total_messages}</p>
      </div>
      <div class="card">
        <h3>Total Devices</h3>
        <p>${stats.total_devices}</p>
      </div>
      <div class="card">
        <h3>Average Temperature</h3>
        <p>${stats.avg_temperature} °C</p>
      </div>
      <div class="card">
        <h3>Average Battery</h3>
        <p>${stats.avg_battery} %</p>
      </div>
      <div class="card">
        <h3>Motion Events</h3>
        <p>${stats.motion_events}</p>
      </div>
      <div class="card">
        <h3>Messages Stored</h3>
        <p>${stats.messagesStored}</p>
      </div>
    `;
  } catch (error) {
    statsContainer.innerHTML = `<div class="card">Failed to load stats</div>`;
    console.error("Error loading stats:", error);
  }
}

async function fetchDevices() {
  const devicesContainer = document.getElementById("devices");

  try {
    const response = await fetch(`${API_BASE_URL}/devices`);
    const devices = await response.json();

    if (!devices.length) {
      devicesContainer.innerHTML = `<div class="card">No devices found</div>`;
      return;
    }

    if (!devices.find((device) => device.device_id === selectedDeviceId)) {
      selectedDeviceId = devices[0].device_id;
    }

    devicesContainer.innerHTML = devices
      .map(
        (device) => `
          <div class="card device-card ${device.device_id === selectedDeviceId ? "selected" : ""}"
               data-device-id="${device.device_id}">
            <h3>${device.device_id}</h3>
            <p><strong>Name:</strong> ${device.name || "Unnamed Device"}</p>
            <p><strong>Status:</strong> <span class="status-${device.status}">${device.status}</span></p>
            <p><strong>Last Seen:</strong> ${device.last_seen ? formatDate(device.last_seen) : "Never"}</p>
            <p><strong>Telemetry Count:</strong> ${device.telemetry_count}</p>
          </div>
        `,
      )
      .join("");

    document.querySelectorAll(".device-card").forEach((card) => {
      card.addEventListener("click", async () => {
        selectedDeviceId = card.dataset.deviceId;
        document.getElementById("selected-device-label").textContent =
          `Showing telemetry for: ${selectedDeviceId}`;

        await fetchDevices();
        await fetchDeviceTelemetry(selectedDeviceId);
      });
    });
  } catch (error) {
    devicesContainer.innerHTML = `<div class="card">Failed to load devices</div>`;
    console.error("Error loading devices:", error);
  }
}

async function fetchDeviceTelemetry(deviceId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/devices/${deviceId}/telemetry?limit=20`,
    );
    const telemetry = await response.json();

    const orderedTelemetry = telemetry.reverse();

    const labels = orderedTelemetry.map((item) =>
      new Date(item.timestamp).toLocaleTimeString(),
    );

    const temperatures = orderedTelemetry.map((item) => item.temperature);
    const batteryLevels = orderedTelemetry.map((item) => item.battery);
    const humidityLevels = orderedTelemetry.map((item) => item.humidity);

    renderTemperatureChart(labels, temperatures);
    renderBatteryChart(labels, batteryLevels);
    renderHumidityChart(labels, humidityLevels);
  } catch (error) {
    console.error("Error loading telemetry history:", error);
  }
}

function renderTemperatureChart(labels, data) {
  const ctx = document.getElementById("temperatureChart").getContext("2d");

  if (temperatureChartInstance) {
    temperatureChartInstance.destroy();
  }

  temperatureChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Temperature (°C)",
          data,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function renderBatteryChart(labels, data) {
  const ctx = document.getElementById("batteryChart").getContext("2d");

  if (batteryChartInstance) {
    batteryChartInstance.destroy();
  }

  batteryChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Battery (%)",
          data,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function renderHumidityChart(labels, data) {
  const ctx = document.getElementById("humidityChart").getContext("2d");

  if (humidityChartInstance) {
    humidityChartInstance.destroy();
  }

  humidityChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Humidity (%)",
          data,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function connectWebSocket() {
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log("Connected to WebSocket server");
    updateConnectionStatus("Live");
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === "telemetry") {
        const telemetry = message.data;

        await fetchStats();
        await fetchDevices();

        if (telemetry.device_id === selectedDeviceId) {
          await fetchDeviceTelemetry(selectedDeviceId);
        }

        updateLastLiveUpdate();
      }

      if (message.type === "alert") {
        renderAlert(message.data);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected. Reconnecting...");
    updateConnectionStatus("Disconnected");
    setTimeout(connectWebSocket, 3000);
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

function updateConnectionStatus(status) {
  const el = document.getElementById("connection-status");
  if (el) {
    el.textContent = `Connection: ${status}`;
  }
}

function updateLastLiveUpdate() {
  const el = document.getElementById("last-live-update");
  if (el) {
    el.textContent = `Last live update: ${new Date().toLocaleTimeString()}`;
  }
}

function renderAlert(alert) {
  const alertsContainer = document.getElementById("alerts");

  const alertElement = document.createElement("div");
  alertElement.className = "alert-card";
  alertElement.setAttribute("data-type", alert.type);

  alertElement.innerHTML = `
    <strong>${alert.type}</strong>
    Device: ${alert.device_id}<br/>
    ${alert.message}<br/>
    Time: ${new Date(alert.timestamp).toLocaleTimeString()}
  `;

  alertsContainer.prepend(alertElement);

  if (alertsContainer.children.length > 20) {
    alertsContainer.removeChild(alertsContainer.lastChild);
  }
}

async function refreshDashboard() {
  await fetchStats();
  await fetchDevices();
  await fetchDeviceTelemetry(selectedDeviceId);

  document.getElementById("selected-device-label").textContent =
    `Showing telemetry for: ${selectedDeviceId}`;
}

document
  .getElementById("refresh-btn")
  .addEventListener("click", refreshDashboard);

// Initial load
refreshDashboard();
connectWebSocket();

// MQTT message handling and WebSocket broadcasting logic in ingestion-service/server.js
/*
setInterval(() => {
  refreshDashboard();
}, 5000);
*/
