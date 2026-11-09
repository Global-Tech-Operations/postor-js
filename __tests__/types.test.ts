import { Postor } from '../index.js';
import type { OperationInputs } from '../index.js';
const api = new Postor({ apiKey: 'postor_sk_' + 'x'.repeat(43) });
void api.call('search_licitaciones', { query: { status: 'vigente', limit: 10 } });
void api.call('create_project', { body: { name: 'Test' }, requestKey: 'action-1' });
void api.call('get_account_status', {}).then(account => { const active: boolean = account.membership.active; return active; });
// @ts-expect-error unknown operation
void api.call('delete_user', {});
// @ts-expect-error invalid status
void api.call('search_licitaciones', { query: { status: 'active' } });
// @ts-expect-error mutations require a caller-owned requestKey
void api.call('create_project', { body: { name: 'Test' } });
// @ts-expect-error tenant selection is forbidden
const injected: OperationInputs['get_market_share'] = { query: { organizationId: 999 } };
void injected;
