const API_BASE_URL = "http://localhost:3000";
let selectedDeviceId = "device_001";

let temperatureChartInstance = null;
let batteryChartInstance = null;
let humidityChartInstance = null;

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
            <p><strong>Last Seen:</strong> ${formatDate(device.last_seen)}</p>
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

refreshDashboard();

setInterval(() => {
  refreshDashboard();
}, 5000);
