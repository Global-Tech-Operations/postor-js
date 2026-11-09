import { Postor } from 'postor-sdk';
const postor = new Postor({ apiKey: process.env.POSTOR_API_KEY });
const result = await postor.call('search_licitaciones', {
  query: { search: process.argv[2] ?? 'mantenimiento', status: 'vigente', limit: 10 }
});
console.log(JSON.stringify(result, null, 2));
