import { renderToStaticMarkup } from 'react-dom/server';
import Dossier from '../components/Dossier';
import ReviewLedger from '../components/ReviewLedger';
import type { Project } from '../types';
import { currentReviews } from './reviews';
export function createDossierHTML(p: Project): string {
  const body = renderToStaticMarkup(
    <>
      <h1>Dossiê preliminar para validação</h1>
      <h2>
        {p.code} · {p.title}
      </h2>
      <p>
        Versão documental {p.documentVersion} · {currentReviews(p).length} analistas avaliaram.{' '}
        {p.catalogCase ? 'Caso fictício do pacote STS. ' : ''}Checagem estrutural e numérica, com
        decisão técnica humana. Não constitui aprovação fiscal.
      </p>
      <Dossier project={p} expanded />
      <ReviewLedger project={p} expanded />
      <h2>Inventário e hashes</h2>
      <pre>
        {JSON.stringify(
          p.documents.map((d) => ({ nome: d.name, id: d.id, hash: d.hash, estado: d.status })),
          null,
          2,
        )}
      </pre>
      <h2>Histórico de ações</h2>
      <pre>{JSON.stringify(p.events, null, 2)}</pre>
      <h2>Avaliações anteriores completas</h2>
      <pre>{JSON.stringify(p.reviewHistory, null, 2)}</pre>
    </>,
  );
  return (
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Dossiê ' +
    escapeHTML(p.code) +
    '</title><style>body{font:15px/1.6 Arial,sans-serif;max-width:1100px;margin:40px auto;padding:20px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #ddd;padding:8px;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere}.source-link{display:none}.evidence,.card,.note{border:1px solid #ddd;margin:16px 0;padding:16px}details{margin:18px 0}summary{font-weight:bold}.review-check{display:inline-block;color:#246a2a;margin:4px;font-weight:bold}h1{color:#870a2f}</style>' +
    body +
    '</html>'
  );
}
function escapeHTML(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
export function download(name: string, text: string, type = 'text/html') {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportDossier(p: Project) {
  download(p.code + '-dossie-para-validacao.html', createDossierHTML(p));
}
