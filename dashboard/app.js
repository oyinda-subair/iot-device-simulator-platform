const API_BASE_URL = "http://localhost:3000";

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

    devicesContainer.innerHTML = devices
      .map(
        (device) => `
          <div class="card">
            <h3>${device.device_id}</h3>
            <p><strong>Last Seen:</strong> ${formatDate(device.last_seen)}</p>
            <p><strong>Telemetry Count:</strong> ${device.telemetry_count}</p>
          </div>
        `,
      )
      .join("");
  } catch (error) {
    devicesContainer.innerHTML = `<div class="card">Failed to load devices</div>`;
    console.error("Error loading devices:", error);
  }
}

document.getElementById("refresh-btn").addEventListener("click", () => {
  fetchStats();
  fetchDevices();
});

function formatDate(value) {
  return new Date(value).toLocaleString();
}

setInterval(() => {
  fetchStats();
  fetchDevices();
}, 5000);
