# Load Testing Notes

## Objective

Evaluate ingestion throughput under increasing simulated device counts.

## Test Summary

### Test 1

- Devices: 10
- Publish interval: 5s
- Result: Stable

### Test 2

- Devices: 100
- Publish interval: 3s
- Result: Stable, API responsive

### Test 3

- Devices: 500
- Publish interval: 2s
- Result: Increased logging overhead, database remained functional

### Test 4

- Devices: 1000
- Publish interval: 1s
- Result: Bottlenecks observed in console logging and per-message writes

## Key Findings

- Console logging significantly affected throughput at higher loads
- Single-row inserts are simple but not optimal for large-scale ingestion
- Platform remained functional under moderate simulated load
