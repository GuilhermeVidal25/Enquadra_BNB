import { useEffect, useState, type FormEvent } from 'react';
import { api, mutation } from '../lib/api';
import type { CatalogRow, Project } from '../types';
import { Card, Notice } from '../components/UI';
export default function Intake() {
  const [code, setCode] = useState(''),
    [title, setTitle] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [cases, setCases] = useState<CatalogRow[]>([]);
  useEffect(() => {
    api<{ cases: CatalogRow[] }>('/cases')
      .then((r) => setCases(r.cases))
      .catch((e) => setError(e.message));
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const p = await mutation<Project>('/cases', {
        code: code.trim().toUpperCase(),
        title: title.trim(),
      });
      location.hash = 'caso/' + p.id;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">Entrada e double check</div>
          <h1>Novos casos e documentos</h1>
          <p className="muted">Confira o pacote antes da interpretação técnica.</p>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      <Card>
        <h2>Criar um caso</h2>
        <form onSubmit={(e) => void create(e)}>
          <div className="split">
            <div>
              <label className="field" htmlFor="case-code">
                Código
              </label>
              <input
                id="case-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                pattern="[-A-Za-z0-9_]+"
                maxLength={40}
                placeholder="PRJ41"
                required
              />
            </div>
            <div>
              <label className="field" htmlFor="case-title">
                Nome do projeto
              </label>
              <input
                id="case-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
            </div>
          </div>
          <div className="actions">
            <button className="btn primary" disabled={busy}>
              Criar caso e anexar documentos
            </button>
          </div>
        </form>
      </Card>
      <Card>
        <h2>Casos recebidos pelo analista</h2>
        {cases.map((p) => (
          <div className="doc" key={p.id}>
            <div className="grow">
              <h3>{p.title}</h3>
              <span className="mini">
                {p.code} · {p.files} arquivos
              </span>
            </div>
            <a className="btn small" href={'#caso/' + p.id}>
              Abrir caso
            </a>
          </div>
        ))}
        {!cases.length && (
          <p className="muted">
            Seus novos casos aparecerão aqui. Os 40 casos do evento estão em Casos analisados.
          </p>
        )}
      </Card>
    </>
  );
}
