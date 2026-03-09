"""
Device Simulator Script
This script simulates multiple IoT devices generating telemetry data such as
temperature, humidity, battery level, and motion detection. The generated
telemetry is published to an MQTT broker at regular intervals. Each device's
data is structured in a JSON format, including a timestamp for when the data was
generated. The script uses the paho-mqtt library to handle MQTT communication.
"""
import json
import os
import random
import time
from datetime import datetime

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion


MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "devices/telemetry"


class Device:
    """
    Represents a device with simulated telemetry data including temperature,
    humidity, battery, and motion status. Provides generate_telemetry() to
    update and return current sensor readings with a timestamp.
    """

    def __init__(self, device_id):
        self.device_id = device_id
        self.temperature = round(random.uniform(20.0, 30.0), 1)
        self.battery = random.randint(60, 100)
        self.motion = False
        self.humidity = round(random.uniform(30.0, 70.0), 1)

    def generate_telemetry(self):
        """
        Generates and returns a dictionary containing simulated telemetry data
        for the device, including device_id, temperature, humidity, battery,
        motion, and a timestamp. Values are randomly updated within defined
        ranges to mimic real sensor readings.
        """
        self.temperature += round(random.uniform(-0.5, 0.5), 1)
        self.temperature = max(15.0, min(self.temperature, 45.0))

        self.humidity += round(random.uniform(-1.0, 1.0), 1)
        self.humidity = max(20.0, min(self.humidity, 90.0))

        self.battery -= random.choice([0, 0, 1])
        self.battery = max(0, self.battery)

        self.motion = random.choice([True, False, False, False])

        return {
            "device_id": self.device_id,
            "temperature": round(self.temperature, 1),
            "humidity": round(self.humidity, 1),
            "battery": self.battery,
            "motion": self.motion,
            "timestamp": datetime.now().isoformat(timespec="seconds")
        }


def create_devices(count):
    """
    Creates a list of Device instances with sequentially numbered names,
    from device_001 to device_{count:03}.
    """
    return [Device(f"device_{i:03}") for i in range(1, count + 1)]


def main():
    """
    Starts an infinite loop that generates telemetry data from multiple
    devices and publishes it to an MQTT topic at regular intervals.
    """
    try:
        client = mqtt.Client(callback_api_version=CallbackAPIVersion.VERSION2)
    except TypeError:
        client = mqtt.Client()
    client.connect(MQTT_BROKER, MQTT_PORT, 60)

    number_of_devices = int(os.getenv("DEVICE_COUNT", "10"))
    publish_interval = float(os.getenv("PUBLISH_INTERVAL", "5"))

    devices = create_devices(number_of_devices)

    print(f"Starting simulator with {number_of_devices} devices.")
    print(f"Publishing every {publish_interval} seconds...")

    try:
        while True:
            for device in devices:
                telemetry = device.generate_telemetry()
                payload = json.dumps(telemetry)

                client.publish(MQTT_TOPIC, payload)

            print(
                f"Published telemetry for {number_of_devices} devices at {datetime.now().isoformat(timespec='seconds')}")
            time.sleep(publish_interval)
    except KeyboardInterrupt:
        print("\n... Stopping simulator ...")
        print("\nSimulation stopped by user. Exiting gracefully...")


print('Program ends')

if __name__ == "__main__":
    main()
