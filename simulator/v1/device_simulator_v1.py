import random
import time
from datetime import datetime
import json


class Device:
    """
    Represents a simulated device with device_id, temperature, battery, and
    motion status. Provides generate_telemetry() to return updated sensor
    data and timestamp in a dictionary.
    """

    def __init__(self, device_id):
        self.device_id = device_id
        self.temperature = round(random.uniform(20.0, 30.0), 1)
        self.battery = random.randint(60, 100)
        self.motion = False
        self.humidity = round(random.uniform(30.0, 70.0), 1)

    def generate_telemetry(self):
        """
        Generates and returns a telemetry dictionary containing device_id,
        simulated temperature, battery level, motion status, and a timestamp.
        Values are updated to reflect realistic sensor fluctuations.
        """
        # Simulate small temperature fluctuations
        self.temperature += round(random.uniform(-0.5, 0.5), 1)
        self.temperature = max(15.0, min(self.temperature, 45.0))

        # Simulate battery drain
        self.battery -= random.choice([0, 0, 1])
        self.battery = max(0, self.battery)

        # Random motion detection
        self.motion = random.choice([True, False, False, False])

        # Simulate humidity fluctuations
        self.humidity += round(random.uniform(-1.0, 1.0), 1)
        self.humidity = max(20.0, min(self.humidity, 90.0))

        return {
            "device_id": self.device_id,
            "temperature": round(self.temperature, 1),
            "battery": self.battery,
            "motion": self.motion,
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "humidity": round(self.humidity, 1)
        }


def create_devices(count):
    """
    Creates a list of Device instances, each named sequentially from
    device_001 to device_{count:03}, based on the specified count.
    """
    return [Device(f"device_{i:03}") for i in range(1, count + 1)]


def main():
    """
    Starts the main loop to simulate telemetry generation for multiple
    devices, printing their data to the console every 5 seconds.
    """
    number_of_devices = 50
    devices = create_devices(number_of_devices)

    while True:
        for device in devices:
            telemetry = device.generate_telemetry()
            """
            print(
                f"{telemetry['device_id']} | "
                f"temp={telemetry['temperature']}C | "
                f"battery={telemetry['battery']}% | "
                f"motion={str(telemetry['motion']).lower()} | "
                f"timestamp={telemetry['timestamp']}"
            )
            """
            print(json.dumps(telemetry))
        print("-" * 80)
        time.sleep(5)


if __name__ == "__main__":
    main()
