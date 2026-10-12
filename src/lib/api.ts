export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch('/api' + path, options);
  let data: unknown;
  try {
    data = await r.json();
  } catch {
    throw Error('O servidor devolveu uma resposta inválida.');
  }
  if (!r.ok)
    throw Error((data as { error?: string }).error || 'Não foi possível concluir a operação.');
  return data as T;
}
export function mutation<T>(path: string, body: unknown, method = 'POST') {
  return api<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
