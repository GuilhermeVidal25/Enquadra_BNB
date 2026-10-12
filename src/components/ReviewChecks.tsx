import type { Review } from '../types';
export default function ReviewChecks({
  reviews,
}: {
  reviews: Pick<Review, 'actor' | 'analystName' | 'at' | 'classification' | 'documentVersion'>[];
}) {
  return reviews.length ? (
    <span
      className="review-checks"
      aria-label={`${reviews.length} analistas avaliaram esta versão`}
    >
      {reviews.map((r) => (
        <span
          key={r.actor}
          role="img"
          className="review-check"
          aria-label={'Avaliado por ' + (r.analystName || r.actor)}
          title={`${r.analystName || r.actor} · ${r.classification} · ${new Date(r.at).toLocaleString('pt-BR')} · versão ${r.documentVersion}`}
        >
          ✓
        </span>
      ))}
    </span>
  ) : (
    <span className="mini">Ainda sem avaliação humana</span>
  );
}
