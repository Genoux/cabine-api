# Office Control System

Node.js service for controlling home office setup via webhooks.

## What It Does

**PC Control:**

- Wake up Arch Linux PC via Wake-on-LAN
- Put PC to sleep via SSH commands
- Real-time status polling to confirm actions worked

**Light Control:**

- Turn all LIFX lights on/off via API
- All-or-nothing control

**Bundle Actions:**

- **Arrive**: Wake PC + turn on lights
- **Leave**: Sleep PC + turn off lights

## Architecture

**Separation of concerns:**

- `pc.service.ts` - Handles WOL, SSH commands, and status polling
- `lifx.service.ts` - Manages LIFX API calls
- `webhook.controller.ts` - HTTP request/response handling only
- `routes/` - Endpoint definitions

## Tech Stack

- **Node.js + TypeScript** - Type-safe code
- **Express** - HTTP server
- **SSH2** - PC communication
- **WOL** - Wake-on-LAN packets
- **LIFX API** - Light control
- **Pino** - Structured logging

## Endpoints

- `POST /api/arrive` - Office arrival sequence
- `POST /api/leave` - Office departure sequence
- `POST /api/wake-pc` - Wake PC only
- `POST /api/sleep-pc` - Sleep PC only
- `POST /api/lights-on` - Lights on only
- `POST /api/lights-off` - Lights off only
- `GET /status` - Get system status

Office automation system.
