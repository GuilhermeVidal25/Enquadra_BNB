import { useEffect, useState, type FormEvent } from 'react';
import type { CaseDocument, Project } from '../types';
import { Card, Notice } from './UI';
import { api } from '../lib/api';
interface Message {
  question: string;
  text: string;
  sources: CaseDocument[];
}
/** Consulta determinística: identifica arquivos e ocorrências; não se apresenta como geração por IA. */
export default function Support({
  project: p,
  onView,
}: {
  project: Project;
  onView: (d: CaseDocument) => void;
}) {
  const [question, setQuestion] = useState(''),
    [messages, setMessages] = useState<Message[]>([]),
    [configured, setConfigured] = useState(false),
    [live, setLive] = useState(false),
    [reply, setReply] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ configured: boolean }>('/ai-status')
      .then((r) => setConfigured(r.configured))
      .catch(() => {});
  }, []);
  async function ask(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    if (live) {
      setBusy(true);
      setReply('');
      try {
        const result = await api<{
          blocks: { text: string; sources: { label: string; text: string }[] }[];
          followUp?: string;
        }>('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: p.code, question: q, history: [] }),
          signal: AbortSignal.timeout(55000),
        });
        setReply(
          result.blocks
            .map((b) => b.text + '\n' + b.sources.map((s) => s.label + ': ' + s.text).join('\n'))
            .join('\n\n') +
            '\n' +
            (result.followUp || ''),
        );
        setQuestion('');
      } catch (e) {
        setReply((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const words = q
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\W+/)
      .filter((w) => w.length > 3);
    const candidates = p.documents
      .filter((d) => d.status === 'read')
      .map((d) => ({
        doc: d,
        score: words.reduce(
          (score, w) =>
            score +
            ((d.text || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .includes(w)
              ? 1
              : 0),
          0,
        ),
      }))
      .filter((d) => d.score)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((d) => d.doc);
    setMessages((rows) => [
      ...rows,
      {
        question: q,
        text: candidates.length
          ? 'Estes documentos contêm termos relacionados à sua pergunta. Abra as fontes e confira o contexto antes de interpretar.'
          : 'Não encontrei correspondências textuais. Consulte o método, a revisão técnica e as pendências; a ausência de correspondência não comprova ausência de evidência.',
        sources: candidates,
      },
    ]);
    setQuestion('');
  }
  return (
    <Card>
      <h2>Suporte ao analista</h2>
      <Notice>
        Consulta documental local, sem geração por IA. Localiza correspondências nos documentos
        recebidos e ajuda a abrir as fontes. O suporte por IA aguarda uma configuração externa;
        quando conectado, o contexto legado cobre PRJ38 e PRJ27.
      </Notice>
      <div className="actions">
        <button className={'btn ' + (!live ? 'dark' : '')} onClick={() => setLive(false)}>
          Consulta documental local
        </button>
        <button
          className={'btn ' + (live ? 'dark' : '')}
          disabled={!configured || !['PRJ38', 'PRJ27'].includes(p.code)}
          onClick={() => setLive(true)}
        >
          Suporte por IA {configured ? '' : '· aguarda ativação'}
        </button>
      </div>
      {reply && <pre className="document-text">{reply}</pre>}
      <div className="chat" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i}>
            <div className="bubble user">{m.question}</div>
            <div className="bubble">
              {m.text}
              {m.sources.map((d) => (
                <p key={d.id}>
                  <button className="source-link" onClick={() => onView(d)}>
                    {d.name}
                  </button>
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <form className="chatbox" onSubmit={(e) => void ask(e)}>
        <input
          aria-label="Pergunta sobre o caso"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          maxLength={2000}
          placeholder="Ex.: Onde consta o protocolo e a versão do ensaio?"
        />
        <button className="btn primary" disabled={busy}>
          {busy ? 'Consultando…' : live ? 'Enviar pergunta' : 'Buscar fontes'}
        </button>
      </form>
    </Card>
  );
}
