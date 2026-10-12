import { mkdir, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
export interface StoredObject {
  etag: string;
  body: Uint8Array;
  json(): Promise<any>;
}
interface Descriptor {
  key: string;
  etag: string;
  file: string;
}
type Condition = { etagMatches?: string; etagDoesNotMatch?: string } | Headers;
/** Adapter de desenvolvimento para o mesmo contrato de armazenamento usado pela API. */
export class FileBucket {
  private gate: Promise<void> = Promise.resolve();
  constructor(readonly directory: string) {}
  private stem(key: string) {
    return createHash('sha256').update(key).digest('hex');
  }
  private async descriptor(key: string): Promise<Descriptor | null> {
    try {
      return JSON.parse(
        await readFile(join(this.directory, this.stem(key) + '.json'), 'utf8'),
      ) as Descriptor;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }
  async get(key: string): Promise<StoredObject | null> {
    const d = await this.descriptor(key);
    if (!d) return null;
    const body = new Uint8Array(await readFile(join(this.directory, d.file)));
    return { etag: d.etag, body, json: async () => JSON.parse(new TextDecoder().decode(body)) };
  }
  async put(
    key: string,
    body: string | ArrayBuffer | ArrayBufferView,
    options: { onlyIf?: Condition } = {},
  ) {
    const transaction = async () => {
      await mkdir(this.directory, { recursive: true });
      const current = await this.descriptor(key),
        condition = options.onlyIf;
      if (condition instanceof Headers) {
        if (condition.get('If-None-Match') === '*' && current) return null;
      } else if (condition) {
        if (condition.etagMatches && condition.etagMatches !== current?.etag) return null;
        if (condition.etagDoesNotMatch === '*' && current) return null;
      }
      const etag = randomUUID(),
        file = this.stem(key) + '-' + etag + '.bin';
      const bytes =
        typeof body === 'string'
          ? Buffer.from(body)
          : body instanceof ArrayBuffer
            ? Buffer.from(body)
            : Buffer.from(body.buffer, body.byteOffset, body.byteLength);
      await writeFile(join(this.directory, file), bytes);
      const descriptor = { key, etag, file };
      const tmp = join(this.directory, this.stem(key) + '.' + etag + '.tmp');
      await writeFile(tmp, JSON.stringify(descriptor));
      await rename(tmp, join(this.directory, this.stem(key) + '.json'));
      return { etag };
    };
    const result = this.gate.then(transaction);
    this.gate = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  async list({ prefix, cursor }: { prefix: string; cursor?: string }) {
    await mkdir(this.directory, { recursive: true });
    const names = (await readdir(this.directory)).filter((n) => n.endsWith('.json'));
    const all: Descriptor[] = [];
    for (const name of names) {
      const row = JSON.parse(await readFile(join(this.directory, name), 'utf8')) as Descriptor;
      if (row.key.startsWith(prefix)) all.push(row);
    }
    all.sort((a, b) => a.key.localeCompare(b.key));
    const start = Number(cursor || 0),
      rows = all.slice(start, start + 100);
    return {
      objects: rows.map((d) => ({ key: d.key })),
      truncated: start + 100 < all.length,
      cursor: String(start + 100),
    };
  }
}
