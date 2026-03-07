"""Basic IoT device simulator entrypoint."""

import json
import random
import time
from datetime import datetime, timezone


def generate_payload(device_id: str) -> dict:
    """Generate a single telemetry payload for a device."""
    return {
        "device_id": device_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "temperature_c": round(random.uniform(18.0, 32.0), 2),
        "humidity_pct": round(random.uniform(35.0, 75.0), 2),
    }


def main() -> None:
    device_id = "device-001"
    while True:
        payload = generate_payload(device_id)
        print(json.dumps(payload))
        time.sleep(1)


if __name__ == "__main__":
    main()
