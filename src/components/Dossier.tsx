import type { CaseDocument, Project } from '../types';
import { precheck } from '../lib/precheck';
import { criteria, currentReviews } from '../lib/reviews';
import { Badge, Notice } from './UI';
export function sourceDocument(p: Project, name: string) {
  return p.documents.find(
    (d) =>
      precheck.base(d.name) === name &&
      !['superseded', 'removed', 'excluded', 'duplicate'].includes(d.status),
  );
}
export default function Dossier({
  project: p,
  onView,
  expanded = false,
}: {
  project: Project;
  onView?: (d: CaseDocument) => void;
  expanded?: boolean;
}) {
  const context = sourceDocument(p, 'dossie_projeto.pdf'),
    method = sourceDocument(p, 'metodo.md'),
    activities = sourceDocument(p, 'atividades.csv') || sourceDocument(p, 'atividades.xlsx'),
    review = sourceDocument(p, 'revisao_tecnica.md'),
    transcript = sourceDocument(p, 'transcricao_entrevista_tecnica.pdf');
  const source = (d?: CaseDocument) =>
    d ? (
      <button className="source-link" disabled={!onView} onClick={() => onView?.(d)}>
        Conferir {d.name}
      </button>
    ) : (
      <span className="mini">Fonte não recebida</span>
    );
  return (
    <>
      <Notice error>
        <strong>Dossiê preliminar para validação.</strong> Reúne os registros dos documentos e
        achados automáticos. Cada analista fundamenta sua própria conclusão.
      </Notice>
      <details className="dossier-section" open>
        <summary>1. Objeto, contexto e limites documentados</summary>
        {source(context)}
        <pre className="document-text">
          {context?.text || 'Documento de contexto não recebido.'}
        </pre>
      </details>
      <details className="dossier-section" open={expanded}>
        <summary>2. Método, hipótese e referência anterior</summary>
        {source(method)}
        <pre className="document-text">{method?.text || 'Método não recebido.'}</pre>
      </details>
      <details className="dossier-section" open={expanded}>
        <summary>3. Atividades e evidências relacionadas</summary>
        {source(activities)}
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Atividade</th>
                <th>Trabalho registrado</th>
                <th>Resultado e fontes</th>
              </tr>
            </thead>
            <tbody>
              {activities?.tables?.[0]?.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.id_atividade}</td>
                  <td>{r.descricao}</td>
                  <td>
                    {r.resultado_ou_saida}
                    <br />
                    <span className="mini">{r.evidencias_relacionadas}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="dossier-section" open={expanded}>
        <summary>4. Conferência de resultados ({p.check?.calculations.length || 0})</summary>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Ensaio e versão</th>
                <th>Informado / conferido</th>
                <th>Operação</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {p.check?.calculations.map((c, i) => (
                <tr key={i}>
                  <td>
                    {c.assay} · {c.version}
                  </td>
                  <td>
                    {c.declared} / {c.calculated}
                    <br />
                    <Badge color={c.passed ? 'green' : 'red'}>
                      {c.passed ? 'Conferiu' : 'Diverge'}
                    </Badge>
                  </td>
                  <td>
                    {c.operation}
                    <br />
                    <span className="mini">
                      {c.scope === 'transcricao'
                        ? 'Somente transcrição'
                        : 'Regra numérica executada'}
                    </span>
                  </td>
                  <td>{c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="dossier-section" open={expanded}>
        <summary>5. Pendências, depoimento e revisão de origem</summary>
        {p.check?.findings.map((f, i) => (
          <div className="evidence" key={i}>
            <strong>{f.message}</strong>
            <p className="mini">{f.source}</p>
            <p>Solicitação: {f.request}</p>
          </div>
        ))}
        {source(review)}
        <pre className="document-text">{review?.text || 'Revisão de origem não recebida.'}</pre>
        {source(transcript)}
        <pre className="document-text">{transcript?.text || 'Depoimento não recebido.'}</pre>
      </details>
      <details className="dossier-section" open={expanded}>
        <summary>6. Critérios para validação humana</summary>
        <p>
          Confronte as fontes com o Manual de Frascati. Os documentos e os cálculos não determinam a
          elegibilidade.
        </p>
        {criteria.map((n) => (
          <p key={n}>
            <strong>{n}</strong> ·{' '}
            {currentReviews(p).length
              ? 'Confira as manifestações individuais.'
              : 'Pendente de avaliação humana fundamentada.'}
          </p>
        ))}
      </details>
    </>
  );
}
