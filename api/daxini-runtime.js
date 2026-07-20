export default async function handler(request, response) {
  response.status(405).json({ error: 'LogicHub UI delegates runtime execution to DAXINI.space through the SDK.' });
}
