import type { Project, Review } from '../types';
import { criteria, currentReviews } from '../lib/reviews';
import ReviewChecks from './ReviewChecks';
import { Card, Notice } from './UI';
export default function ReviewLedger({
  project,
  expanded = false,
}: {
  project: Project;
  expanded?: boolean;
}) {
  const reviews = currentReviews(project);
  function entry(r: Review, i: number, historical = false) {
    return (
      <details key={r.actor + '-' + r.at + '-' + i} className="evaluation-entry" open={expanded}>
        <summary>
          {r.analystName || r.actor} · {r.classification} · {new Date(r.at).toLocaleString('pt-BR')}
        </summary>
        <p>{r.conclusion}</p>
        {historical && (
          <p className="mini">
            Versão {r.documentVersion || 1} ·{' '}
            {r.invalidationReason || 'Manifestação substituída por nova avaliação.'}
          </p>
        )}
        {r.criteria.map((c, index) => (
          <div className="evidence" key={index}>
            <strong>
              {criteria[index]} · {c.state}
            </strong>
            <p>{c.comment}</p>
            <p className="mini">
              Fonte:{' '}
              {c.documentId === '_check'
                ? 'Checagem documental'
                : project.documents.find((d) => d.id === c.documentId)?.name || c.documentId}{' '}
              · {c.locator}
            </p>
          </div>
        ))}
      </details>
    );
  }
  return (
    <Card>
      <div className="card-head">
        <h2>Avaliações dos analistas</h2>
        <ReviewChecks reviews={reviews} />
      </div>
      <p className="muted">
        Versão documental {project.documentVersion} · {reviews.length} analistas avaliaram. A mesma
        pessoa mantém um único check na versão atual.
      </p>
      {project.divergent && (
        <Notice error>
          As classificações ou critérios divergem. Os pareceres ficam separados, sem aprovação
          automática por maioria.
        </Notice>
      )}
      {reviews.map((r, i) => entry(r, i))}
      {!reviews.length && (
        <p className="muted">Nenhum analista concluiu a avaliação desta versão.</p>
      )}
      {!!project.reviewHistory.length && (
        <details open={expanded}>
          <summary>Avaliações anteriores ({project.reviewHistory.length})</summary>
          {project.reviewHistory
            .slice()
            .reverse()
            .map((r, i) => entry(r, i, true))}
        </details>
      )}
    </Card>
  );
}
