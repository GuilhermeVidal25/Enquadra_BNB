import { useEffect, useState, type FormEvent } from 'react';
import type { Classification, CriterionReview, CriterionState, Project } from '../types';
import { criteria, currentReviews } from '../lib/reviews';
import { mutation } from '../lib/api';
import { Card, Notice } from './UI';
const states: CriterionState[] = ['Sustentado', 'Não sustentado', 'Insuficiente', 'Contraditório'];
const classes: Classification[] = [
  'Elegível',
  'Com ressalvas',
  'Não elegível',
  'Evidência insuficiente',
];
export default function ReviewForm({
  project: p,
  onSave,
}: {
  project: Project;
  onSave: (p: Project) => void;
}) {
  const own = currentReviews(p).find((r) => r.actor === p.currentUser.id);
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const empty = () =>
    criteria.map(() => ({
      state: 'Insuficiente' as CriterionState,
      comment: '',
      documentId: '',
      locator: '',
    }));
  const [entries, setEntries] = useState<CriterionReview[]>(empty),
    [classification, setClassification] = useState<Classification>('Evidência insuficiente'),
    [conclusion, setConclusion] = useState('');
  useEffect(() => {
    setEntries(own?.criteria || empty());
    setClassification(own?.classification || 'Evidência insuficiente');
    setConclusion(own?.conclusion || '');
    setEditing(false);
  }, [p.id, p.documentVersion, own?.at]);
  function update(i: number, patch: Partial<CriterionReview>) {
    setEntries((rows) => rows.map((row, n) => (n === i ? { ...row, ...patch } : row)));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSave(
        await mutation<Project>('/cases/' + p.id + '/review', {
          revision: p.revision,
          criteria: entries,
          classification,
          conclusion,
        }),
      );
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2>{own ? 'Sua avaliação registrada' : 'Registrar minha avaliação'}</h2>
      <p className="muted">
        Conta: {p.currentUser.name}. Responsável, data e versão serão registrados pelo servidor.
      </p>
      {error && <Notice error>{error}</Notice>}
      {own && !editing ? (
        <>
          <Notice>
            <strong>{own.classification}</strong>
            <br />
            {own.conclusion}
          </Notice>
          <div className="actions">
            <button className="btn" onClick={() => setEditing(true)}>
              Revisar minha avaliação
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={(e) => void save(e)}>
          <fieldset disabled={busy}>
            {entries.map((c, i) => (
              <div className="draft-section" key={criteria[i]}>
                <h3>
                  {i + 1}. {criteria[i]}
                </h3>
                <label className="field" htmlFor={'review-state-' + i}>
                  Estado da evidência
                </label>
                <select
                  id={'review-state-' + i}
                  value={c.state}
                  onChange={(e) => update(i, { state: e.target.value as CriterionState })}
                >
                  {states.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <label className="field" htmlFor={'review-comment-' + i}>
                  Fundamentação do analista
                </label>
                <textarea
                  id={'review-comment-' + i}
                  value={c.comment}
                  onChange={(e) => update(i, { comment: e.target.value })}
                  required
                  minLength={10}
                  maxLength={6000}
                />
                <div className="split">
                  <div>
                    <label className="field" htmlFor={'review-source-' + i}>
                      Fonte usada
                    </label>
                    <select
                      id={'review-source-' + i}
                      value={c.documentId}
                      onChange={(e) => update(i, { documentId: e.target.value })}
                      required
                    >
                      <option value="">Selecione</option>
                      <option value="_check">Lacuna ou bloqueio da checagem</option>
                      {p.documents
                        .filter((d) => d.status === 'read')
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="field" htmlFor={'review-locator-' + i}>
                      Página, linha ou seção
                    </label>
                    <input
                      id={'review-locator-' + i}
                      maxLength={300}
                      value={c.locator}
                      onChange={(e) => update(i, { locator: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
            <label className="field" htmlFor="review-class">
              Classificação preliminar
            </label>
            <select
              id="review-class"
              value={classification}
              onChange={(e) => setClassification(e.target.value as Classification)}
            >
              {classes.map((c) => (
                <option
                  key={c}
                  disabled={!!p.check?.blocked && ['Elegível', 'Com ressalvas'].includes(c)}
                >
                  {c}
                </option>
              ))}
            </select>
            <label className="field" htmlFor="review-conclusion">
              Conclusão e limites
            </label>
            <textarea
              id="review-conclusion"
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              required
              minLength={20}
              maxLength={10000}
            />
            <p className="mini">
              Qualquer mudança no pacote exige nova revisão; manifestações anteriores ficam no
              histórico.
            </p>
            <div className="actions">
              {own && (
                <button type="button" className="btn" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              )}
              <button
                className="btn primary"
                disabled={!p.documents.some((d) => d.status === 'read')}
              >
                {busy ? 'Registrando…' : 'Registrar revisão e elaborar dossiê'}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </Card>
  );
}
