# Office Control System

Controls my office PC (wake-on-LAN) and LIFX lights.

## Quick Start

1. Create `.env` file from example:

   ```
   cp .env.example .env
   ```

2. Edit `.env` with:

   - WOL_MAC_ADDRESS: My work PC's MAC
   - LIFX_API_TOKEN: My LIFX token
   - LIFX_LIGHTS: JSON array of my LIFX lights

3. Run with Docker:
   ```
   docker-compose up -d
   ```

## Useful Commands

### Wake PC

```
curl -X POST http://localhost:3000/webhooks/wake-pc -H "X-Webhook-Secret: my-secret"
```

### Light Controls

```
# Turn on desk light
curl -X POST http://localhost:3000/webhooks/light/desk/on -H "X-Webhook-Secret: my-secret"

# Turn off all office lights
curl -X POST http://localhost:3000/webhooks/group/office/off -H "X-Webhook-Secret: my-secret"

# Activate focus scene
curl -X POST http://localhost:3000/webhooks/scene/focus -H "X-Webhook-Secret: my-secret"
```

### Office Automation

```
# Arriving at office (wake PC + turn on lights)
curl -X POST http://localhost:3000/webhooks/office/arrive -H "X-Webhook-Secret: my-secret"

# Leaving office (turn off lights)
curl -X POST http://localhost:3000/webhooks/office/leave -H "X-Webhook-Secret: my-secret"
```

## Arduino Integration

Add this to the RFID sketch to trigger office arrival:

```cpp
void sendWebhookRequest() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin("http://server-ip:3000/webhooks/office/arrive");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Webhook-Secret", "my-secret");

    int httpResponseCode = http.POST("{}");

    if (httpResponseCode > 0) {
      Serial.println("Office arrival triggered");
    } else {
      Serial.println("Error: " + String(httpResponseCode));
    }

    http.end();
  }
}
```

## To Add a New Light

Add it to the LIFX_LIGHTS array in .env file:

```
LIFX_LIGHTS='[
  {"id":"existing-id", "name":"desk", "group":"office", "tags":["work"]},
  {"id":"new-light-id", "name":"new_light", "group":"bedroom", "tags":["sleep"]}
]'
```
