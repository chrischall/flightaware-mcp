import { describe, it, expect } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerFlightTools } from '../src/tools/flights.js';
import { registerAirportTools } from '../src/tools/airports.js';
import { registerOperatorTools } from '../src/tools/operators.js';
import { registerAircraftTools } from '../src/tools/aircraft.js';
import { registerScheduleTools } from '../src/tools/schedules.js';
import { registerAlertTools } from '../src/tools/alerts.js';

describe('tool roster', () => {
  it('registers exactly the expected tools', async () => {
    const h = await createTestHarness((s) => {
      registerFlightTools(s);
      registerAirportTools(s);
      registerOperatorTools(s);
      registerAircraftTools(s);
      registerScheduleTools(s);
      registerAlertTools(s);
    });
    const names = (await h.listTools()).map((t) => t.name).sort();
    expect(names).toEqual([
      'fa_count_flights',
      'fa_create_alert',
      'fa_delete_alert',
      'fa_foresight_search',
      'fa_get_aircraft_owner',
      'fa_get_airport',
      'fa_get_airport_delays',
      'fa_get_airport_flight_counts',
      'fa_get_airport_flights',
      'fa_get_airport_routes',
      'fa_get_airport_weather',
      'fa_get_alert',
      'fa_get_alerts_endpoint',
      'fa_get_flight_history',
      'fa_get_flight_map',
      'fa_get_flight_position',
      'fa_get_flight_route',
      'fa_get_flight_track',
      'fa_get_flights',
      'fa_get_nearby_airports',
      'fa_get_operator',
      'fa_get_operator_flights',
      'fa_get_scheduled_flights',
      'fa_list_airports',
      'fa_list_alerts',
      'fa_list_operators',
      'fa_resolve_airport',
      'fa_resolve_flight',
      'fa_search_flight_positions',
      'fa_search_flights',
      'fa_search_flights_advanced',
      'fa_set_alerts_endpoint',
      'fa_update_alert',
    ]);
    await h.close();
  });
});
