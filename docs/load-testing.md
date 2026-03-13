# Load Testing Notes

## Test 1

- Devices: 10
- Publish interval: 5s
- Result: Stable

## Test 2

- Devices: 50
- Publish interval: 5s
- Result: Stable, no visible lag

## Test 3

- Devices: 100
- Publish interval: 3s
- Result: Stable, API still responsive

## Test 4

- Devices: 500
- Publish interval: 2s
- Result: Stable, database still storing

## Test 5

- Devices: 1000
- Publish interval: 1s
- Result: Some lag / some bottleneck observed / Unable to load dashboard
