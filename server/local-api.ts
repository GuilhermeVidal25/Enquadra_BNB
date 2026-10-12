import type { IncomingMessage, ServerResponse } from 'node:http';
import { FileBucket } from './file-bucket';
export const demoProfiles = [
  { id: 'analista-1', name: 'Analista 1' },
  { id: 'analista-2', name: 'Analista 2' },
];
let workerPromise:
  | Promise<{ fetch(request: Request, env: Record<string, unknown>): Promise<Response> }>
  | undefined;
function worker() {
  return (workerPromise ??= import('./generated/core.mjs').then((m) => m.default));
}
export async function localRequest(request: Request, bucket: FileBucket): Promise<Response> {
  const url = new URL(request.url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    return Response.json(
      { error: 'A demonstração local só aceita acesso pelo próprio computador.' },
      { status: 403 },
    );
  const cookie = request.headers.get('cookie') || '',
    selected = cookie.match(/(?:^|;\s*)enquadra_analyst=(analista-[12])/)?.[1] || 'analista-1';
  const actor = demoProfiles.find((p) => p.id === selected)!;
  if (url.pathname === '/api/dev-session') {
    if (request.method === 'GET')
      return Response.json({ localDemo: true, currentUser: actor, profiles: demoProfiles });
    if (request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin)
        return Response.json({ error: 'Origem não permitida.' }, { status: 403 });
      const body = (await request.json()) as { id?: string };
      if (!demoProfiles.some((p) => p.id === body.id))
        return Response.json({ error: 'Perfil inválido.' }, { status: 400 });
      return Response.json(
        { ok: true },
        {
          headers: {
            'Set-Cookie': `enquadra_analyst=${body.id}; Path=/; HttpOnly; SameSite=Strict`,
          },
        },
      );
    }
    return Response.json({ error: 'Operação inválida.' }, { status: 405 });
  }
  const headers = new Headers(request.headers);
  for (const key of [...headers.keys()])
    if (key.startsWith('oai-authenticated-')) headers.delete(key);
  headers.set('oai-authenticated-user-id', actor.id);
  headers.set('oai-authenticated-user-full-name', actor.name);
  const trusted = new Request(request, { headers });
  return (await worker()).fetch(trusted, { BUCKET: bucket });
}
export function localAPIMiddleware(bucket: FileBucket) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) return next();
    try {
      const host = req.headers.host || '127.0.0.1';
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers))
        if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
      let body: Buffer | undefined;
      if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
        const parts: Buffer[] = [];
        let length = 0;
        for await (const part of req) {
          length += part.length;
          if (length > 18 * 1024 * 1024) throw Error('Envio acima do limite de 18 MB.');
          parts.push(Buffer.from(part));
        }
        body = Buffer.concat(parts);
      }
      const request = new Request('http://' + host + req.url, {
        method: req.method,
        headers,
        body: body ? new Uint8Array(body) : undefined,
      });
      const response = await localRequest(request, bucket);
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
  };
}
