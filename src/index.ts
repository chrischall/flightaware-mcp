#!/usr/bin/env node
import { runMcp } from '@chrischall/mcp-utils';
import { VERSION } from './version.js';
import { registerFlightTools } from './tools/flights.js';
import { registerAirportTools } from './tools/airports.js';
import { registerOperatorTools } from './tools/operators.js';
import { registerAircraftTools } from './tools/aircraft.js';
import { registerScheduleTools } from './tools/schedules.js';
import { registerAlertTools } from './tools/alerts.js';

// The FlightAwareClient is a module-level singleton (imported by each tool
// module) that defers its config error to the first request — so the server
// boots and answers the host's install-time tools/list probe even without
// AEROAPI_API_KEY.
await runMcp({
  name: 'flightaware-mcp',
  version: VERSION,
  banner: '[flightaware-mcp] This project was developed and is maintained by AI (Claude). Use at your own discretion.',
  tools: [
    registerFlightTools,
    registerAirportTools,
    registerOperatorTools,
    registerAircraftTools,
    registerScheduleTools,
    registerAlertTools,
  ],
});
