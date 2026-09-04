import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { viewArg, viewResponse } from '../view.js';
import { client } from '../client.js';
import { FlightIdent } from './shared.js';

export function registerAircraftTools(server: McpServer): void {
  server.registerTool(
    'fa_get_aircraft_owner',
    {
      description: 'Get the registered owner of an aircraft by tail number / registration (e.g. N12345).',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        view: viewArg(),
        ident: FlightIdent.describe('Aircraft registration / tail number (e.g. N12345)'),
      },
    },
    async ({ ident, view }) => {
      const data = await client.get(`/aircraft/${ident}/owner`, { cache: 'static' });
      return viewResponse(view, data);
    },
  );
}
