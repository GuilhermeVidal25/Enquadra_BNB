import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CatalogRow } from '../types';
import ReviewChecks from '../components/ReviewChecks';
import { Badge, Card, Metric, Notice } from '../components/UI';
export default function Catalog({ dashboard = false }: { dashboard?: boolean }) {
  const [rows, setRows] = useState<CatalogRow[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  async function load() {
    setBusy(true);
    setError('');
    try {
      setRows((await api<{ cases: CatalogRow[] }>('/analyzed')).cases);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const corpus = rows.filter((p) => p.catalogCase);
  const visible = rows
    .filter(
      (p) =>
        (p.code + ' ' + p.title).toLowerCase().includes(query.toLowerCase()) &&
        (filter === 'all' ||
          (filter === 'none' && p.reviewCount === 0) ||
          (filter === 'one' && p.reviewCount === 1) ||
          (filter === 'two' && p.reviewCount >= 2) ||
          (filter === 'divergent' && p.divergent)),
    )
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">Biblioteca de análises</div>
          <h1>{dashboard ? 'Visão geral' : 'Casos analisados'}</h1>
          <p className="muted">
            Os 40 casos do evento, documentos, achados e avaliações individuais.
          </p>
        </div>
        <div className="actions">
          <a className="btn primary" href="#entrada">
            Novo caso
          </a>
          <button className="btn" disabled={busy} onClick={() => void load()}>
            Atualizar avaliações
          </button>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      <div className="stats">
        <Metric
          label="Casos do evento"
          value={busy ? '…' : `${corpus.length} / 40`}
          detail="Documentos fictícios fornecidos no STS"
        />
        <Metric
          label="Aguardando validação humana"
          value={busy ? '…' : corpus.filter((p) => !p.reviewCount).length}
          detail="Dossiês preliminares disponíveis"
        />
        <Metric
          label="Duas ou mais avaliações"
          value={busy ? '…' : corpus.filter((p) => p.reviewCount >= 2).length}
          detail="Contagem por pessoa e versão"
        />
      </div>
      <Notice>
        Um check representa uma avaliação humana concluída, inclusive quando o parecer é não
        elegível. Os 40 casos não recebem aprovação automática.
      </Notice>
      <Card>
        <div className="card-head">
          <h2>Dossiês por caso</h2>
          <Badge>{rows.length} casos</Badge>
        </div>
        <div className="split catalog-filters">
          <div>
            <label className="field" htmlFor="catalog-query">
              Buscar
            </label>
            <input
              id="catalog-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Código ou nome"
            />
          </div>
          <div>
            <label className="field" htmlFor="catalog-filter">
              Avaliações
            </label>
            <select id="catalog-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todas</option>
              <option value="none">Ainda não avaliado</option>
              <option value="one">Um analista</option>
              <option value="two">Dois ou mais analistas</option>
              <option value="divergent">Avaliações divergentes</option>
            </select>
          </div>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Caso</th>
                <th>Pacote documental</th>
                <th>Checagem</th>
                <th>Analistas que avaliaram</th>
                <th>Dossiê</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title}</strong>
                    <span className="id">{p.code}</span>
                    <br />
                    <span className="mini">
                      {p.catalogCase
                        ? 'Pacote original STS'
                        : p.shared
                          ? 'Caso da equipe'
                          : 'Caso pessoal'}
                    </span>
                  </td>
                  <td>
                    {p.files} arquivos
                    <br />
                    <span className="mini">
                      {p.check?.coverage || 0}% de leitura · {p.check?.results || 0} resultados
                    </span>
                  </td>
                  <td>
                    <Badge color={p.check?.blocked ? 'amber' : 'gray'}>
                      {p.check?.blocked
                        ? 'Complementação necessária'
                        : p.check
                          ? 'Checagem executada'
                          : 'Sem checagem'}
                    </Badge>
                  </td>
                  <td>
                    <ReviewChecks reviews={p.reviews} />
                    <span className="mini block">
                      {p.reviewCount} analistas · versão {p.documentVersion}
                    </span>
                    {p.divergent && <Badge color="amber">Avaliações divergentes</Badge>}
                    {!!p.previousReviews && (
                      <span className="mini block">{p.previousReviews} avaliações anteriores</span>
                    )}
                  </td>
                  <td>
                    <a className="btn small primary" href={'#caso/' + p.id}>
                      Abrir dossiê e avaliar
                    </a>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={5}>{busy ? 'Carregando…' : 'Nenhum caso corresponde ao filtro.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
