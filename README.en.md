# Postor · Mexican public procurement API for JavaScript and TypeScript

Official SDK for the [Postor](https://postor.com.mx) membership API. Search Mexican government tenders, read procurement documents, request analyses and manage projects with the permissions and allowances of your membership.

## Get access

1. [Register for a Postor account](https://app.postor.com.mx/registro).
2. [Purchase a paid subscription: Radar, Análisis, Mesa or Mesa Plus](https://postor.com.mx/precios). Your membership must be active to use the API.
3. Create a personal key in [Settings → Membership API](https://app.postor.com.mx/configuracion?section=api-miembros).
4. Store it as `POSTOR_API_KEY` in your server's secret manager.

**You can only use the functions unlocked by your membership.** API calls do not grant higher-tier features or additional quotas. Analysis allowances are shared with the panel and MCP. A trial does not qualify. Keys are scoped to your user and organization and default to read-only access.

```sh
npm install postor-sdk
```

```js
import { Postor } from 'postor-sdk';
const postor = new Postor({ apiKey: process.env.POSTOR_API_KEY });
const account = await postor.call('get_account_status', {});
const tenders = await postor.call('search_licitaciones', {
  query: { search: 'equipment', status: 'vigente', limit: 10 }
});
console.log(account.membership, tenders.data);
```

Node.js 20.19+; ESM; no runtime dependencies. Input types and response envelopes are generated from the API schemas. Variable resource contents are JSON. Keep keys out of browsers, mobile apps, repositories and AI prompts.

Every operation has a schema, required scope and eligible plans in [catalog.json](./catalog.json). See [OpenAPI](./openapi.json), the [Spanish reference](./README.md) and [AI integration instructions](./AI.md) for complete usage, response shapes, pagination, errors and limitations.

The limit is 60 requests per minute per user and organization, shared with MCP. Writes require a caller-owned `requestKey` and, for destructive actions, explicit confirmation. Deduplication lasts 24 hours. The SDK never automatically retries. If a write times out, inspect the resource: it may already have run. Starting an analysis does not mean it has finished. Follow pagination and inspect `truncatedFields` before treating results as complete.

[Postor API documentation](https://postor.com.mx/api-miembros) · [Coverage](https://postor.com.mx/cobertura) · [Pricing](https://postor.com.mx/precios) · [Support](mailto:hola@postor.com.mx)

MIT license applies to the SDK, not to a grant of service or data rights. Service access follows [Postor's terms](https://postor.com.mx/terminos).
