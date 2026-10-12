import { useEffect, useState, useRef } from 'react';
import { api, mutation } from '../lib/api';
import { expandFiles, extractFile } from '../lib/documents';
import type { CaseDocument, CatalogRow, Project } from '../types';
import { precheck } from '../lib/precheck';
import { Badge, Card, Metric, Notice } from '../components/UI';
import ReviewChecks from '../components/ReviewChecks';
import { currentReviews } from '../lib/reviews';
import ReviewForm from '../components/ReviewForm';
import ReviewLedger from '../components/ReviewLedger';
import Dossier from '../components/Dossier';
import CorrectionModal, { type CorrectionAction } from '../components/CorrectionModal';
import Support from '../components/Support';
import { exportDossier, download } from '../lib/export';
const labels: Record<CaseDocument['status'], string> = {
  read: 'Lido',
  partial: 'Parcial',
  unreadable: 'Não lido',
  excluded: 'Excluído com motivo',
  duplicate: 'Cópia idêntica',
  superseded: 'Versão anterior',
  removed: 'Removido da análise',
};
export default function CasePage({ id }: { id: string }) {
  const [p, setProject] = useState<Project | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState(''),
    [notice, setNotice] = useState(''),
    [modal, setModal] = useState<{ action: CorrectionAction; doc?: CaseDocument } | null>(null),
    [tab, setTab] = useState('dossie');
  const fileInput = useRef<HTMLInputElement>(null);
  async function load() {
    setBusy(true);
    setError('');
    try {
      setProject(await api<Project>('/cases/' + id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setProject(null);
    setModal(null);
    void load();
  }, [id]);
  function saved(project: Project) {
    setProject(project);
    setNotice('Alteração registrada; checagem e avaliações atualizadas.');
    setError('');
  }
  async function action(path: string, body: unknown) {
    if (!p) return;
    setBusy(true);
    setError('');
    try {
      saved(await mutation<Project>('/cases/' + p.id + '/' + path, body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: File[]) {
    if (!p || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    let root = p;
    const failures: string[] = [];
    try {
      const queue = await expandFiles(files),
        groups = new Map<string, typeof queue>();
      for (const e of queue) {
        const code = e.name.match(/(?:^|\/)(PRJ\d+)(?:\/)/i)?.[1].toUpperCase() || root.code;
        const group = groups.get(code) || [];
        group.push(e);
        groups.set(code, group);
      }
      const owned = (await api<{ cases: CatalogRow[] }>('/cases')).cases;
      let completed = 0;
      for (const [code, entries] of groups) {
        let target = root;
        if (code !== root.code) {
          const existing = owned.find((c) => c.code === code);
          target = existing
            ? await api<Project>('/cases/' + existing.id)
            : await mutation<Project>('/cases', {
                code,
                title: 'Projeto ' + code + ' · importado',
              });
        }
        for (const item of entries) {
          setProgress(`Arquivo ${++completed} de ${queue.length} · ${code} · ${item.name}`);
          try {
            const form = new FormData();
            form.append('file', item.file, item.name.split('/').pop() || item.name);
            form.append('analysis', JSON.stringify(await extractFile(item.file, item.name)));
            form.append('revision', String(target.revision));
            target = await api<Project>('/cases/' + target.id + '/documents', {
              method: 'POST',
              body: form,
            });
          } catch (e) {
            failures.push(item.name + ': ' + (e as Error).message);
            try {
              target = await mutation<Project>('/cases/' + target.id + '/rejected', {
                revision: target.revision,
                name: item.name,
                size: item.file.size,
                reason: (e as Error).message,
              });
            } catch (record) {
              failures.push('Falha não registrada: ' + (record as Error).message);
            }
          }
          if (target.id === root.id) {
            root = target;
            setProject(root);
          }
        }
      }
      root = await mutation<Project>('/cases/' + root.id + '/import-event', {
        revision: root.revision,
        success: failures.length === 0,
        detail:
          files.map((f) => f.name).join(', ') +
          (failures.length ? ' · ' + failures.join(' | ') : ''),
      });
      setProject(root);
      if (failures.length) setError(failures.join(' | '));
      else setNotice('Documentos recebidos; double check atualizado.');
    } catch (e) {
      setError((e as Error).message);
      try {
        root = await mutation<Project>('/cases/' + root.id + '/import-event', {
          revision: root.revision,
          success: false,
          detail: (e as Error).message,
        });
        setProject(root);
      } catch {
        setError((e as Error).message + ' A falha não pôde ser registrada no servidor.');
      }
    } finally {
      setBusy(false);
      setProgress('');
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  if (!p)
    return (
      <>
        <a className="btn" href="#analisados">
          Voltar aos casos
        </a>
        <Card>{error ? <Notice error>{error}</Notice> : <p>Carregando caso…</p>}</Card>
      </>
    );
  const reviews = currentReviews(p);
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">
            <a href="#analisados">Casos analisados</a> / {p.code}
          </div>
          <h1>{p.title}</h1>
          <p className="muted">
            Versão documental {p.documentVersion} · {p.shared ? 'Caso da equipe' : 'Caso pessoal'}
          </p>
        </div>
        <div className="actions">
          <button className="btn" disabled={busy} onClick={() => void load()}>
            Atualizar avaliações
          </button>
          <button className="btn" disabled={busy} onClick={() => setModal({ action: 'case' })}>
            Editar dados do caso
          </button>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      {notice && (
        <p role="status" className="statusline">
          {notice}
        </p>
      )}
      <Card>
        <div className="card-head">
          <div>
            <h2>Avaliações desta versão</h2>
            <ReviewChecks reviews={reviews} />
            <span className="mini block">{reviews.length} analistas concluíram a avaliação.</span>
          </div>
          <button className="btn primary" onClick={() => exportDossier(p)}>
            Exportar dossiê
          </button>
        </div>
        {p.divergent && <Notice error>Há divergência entre as manifestações dos analistas.</Notice>}
        {!p.shared && (
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => void action('share', { revision: p.revision })}
            >
              Disponibilizar este caso à equipe
            </button>
          </div>
        )}
      </Card>
      <nav className="steps" aria-label="Etapas do caso">
        {[
          ['dossie', 'Dossiê e análise'],
          ['documentos', 'Documentos e double check'],
          ['revisoes', 'Avaliações e histórico'],
          ['suporte', 'Suporte documental'],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={'step-tab ' + (tab === key ? 'active' : '')}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'dossie' && (
        <>
          <Card>
            <div className="card-head">
              <h2>Dossiê do caso · {p.code}</h2>
              <button className="btn" onClick={() => exportDossier(p)}>
                Exportar dossiê
              </button>
            </div>
            <Dossier project={p} onView={(doc) => setModal({ action: 'view', doc })} />
          </Card>
          <ReviewLedger project={p} />
          <ReviewForm project={p} onSave={saved} />
        </>
      )}
      {tab === 'documentos' && (
        <>
          <Card>
            <div className="card-head">
              <h2>Adicionar documentos</h2>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void action('check', { revision: p.revision })}
              >
                Repetir double check
              </button>
            </div>
            <p className="muted">
              PDF com texto, CSV, Excel, JSON, Markdown, TXT ou ZIP. Cada arquivo recebe um estado
              de leitura.
            </p>
            <label className="upload-zone">
              <strong>Selecionar documentos ou pacote ZIP</strong>
              <span className="mini">Até 10 MB por arquivo · ZIP até 25 MB / 1.500 itens</span>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept=".pdf,.csv,.xlsx,.json,.md,.txt,.zip"
                disabled={busy}
                onChange={(e) => void upload([...(e.target.files || [])])}
              />
            </label>
            <p className="mini">
              ZIPs com diretórios PRJ são separados por caso. PDFs sem texto exigem OCR externo.
            </p>
            {busy && <Notice>{progress || 'Atualizando…'}</Notice>}
          </Card>
          <div className="stats">
            <Metric
              label="Arquivos recebidos"
              value={p.documents.length}
              detail="Inclui cópias, versões e removidos"
            />
            <Metric
              label="Leitura completa"
              value={`${p.check?.fullyRead || 0} / ${p.check?.logical || 0}`}
              detail={`${p.check?.coverage || 0}% do conteúdo lógico recebido`}
            />
            <Metric label="Recálculos e transcrições" value={p.check?.calculations.length || 0} />
          </div>
          <Card>
            <div className="card-head">
              <h2>Checagem prévia</h2>
              <Badge color={p.check?.blocked ? 'amber' : 'gray'}>
                {p.check?.blocked
                  ? 'Complementação necessária'
                  : p.check
                    ? 'Pronto para revisão técnica'
                    : 'Aguardando arquivos'}
              </Badge>
            </div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Achado</th>
                    <th>Origem</th>
                    <th>O que solicitar</th>
                  </tr>
                </thead>
                <tbody>
                  {p.check?.findings.map((f, i) => (
                    <tr key={i}>
                      <td>
                        <Badge color={f.severity === 'block' ? 'red' : 'amber'}>
                          {f.severity === 'block' ? 'Bloqueio' : 'Atenção'}
                        </Badge>
                      </td>
                      <td>{f.message}</td>
                      <td>{f.source}</td>
                      <td>{f.request}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="actions">
              <button
                className="btn"
                onClick={() =>
                  download(
                    p.code + '-checagem.json',
                    JSON.stringify(
                      {
                        code: p.code,
                        version: p.documentVersion,
                        check: p.check,
                        events: p.events,
                      },
                      null,
                      2,
                    ),
                    'application/json',
                  )
                }
              >
                Exportar checagem
              </button>
            </div>
          </Card>
          <Card>
            <h2>Inventário de leitura</h2>
            <p className="muted">
              Corrija dados, substitua arquivos ou remova itens enviados por engano. Originais e
              motivos permanecem no histórico.
            </p>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Estado</th>
                    <th>Leitura / motivo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {p.documents.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.name}</strong>
                        <span className="mini">
                          {Math.round(d.bytes / 1024)} KB ·{' '}
                          {d.hash ? 'SHA-256 ' + d.hash.slice(0, 12) : 'Original não recebido'}
                        </span>
                      </td>
                      <td>
                        <Badge color={d.status === 'read' ? 'green' : 'amber'}>
                          {labels[d.status]}
                        </Badge>
                      </td>
                      <td>
                        {d.removalReason ||
                          d.error ||
                          (d.unreadPages?.length
                            ? 'Páginas pendentes: ' + d.unreadPages.join(', ')
                            : 'Conteúdo extraído')}
                      </td>
                      <td>
                        <div className="doc-actions">
                          <button
                            className="btn small"
                            onClick={() => setModal({ action: 'view', doc: d })}
                          >
                            Conferir
                          </button>
                          {d.status === 'removed' ? (
                            <button
                              className="btn small"
                              disabled={busy}
                              onClick={() => setModal({ action: 'restore', doc: d })}
                            >
                              Restaurar
                            </button>
                          ) : d.status === 'superseded' ? (
                            <span className="mini">Versão preservada</span>
                          ) : (
                            <>
                              {!['excluded', 'duplicate'].includes(d.status) &&
                                d.originalStored !== false && (
                                  <>
                                    {['csv', 'json', 'md', 'txt'].includes(
                                      precheck.base(d.name).split('.').pop() || '',
                                    ) && (
                                      <button
                                        className="btn small"
                                        disabled={busy}
                                        onClick={() => setModal({ action: 'edit', doc: d })}
                                      >
                                        Editar dados
                                      </button>
                                    )}
                                    <button
                                      className="btn small"
                                      disabled={busy}
                                      onClick={() => setModal({ action: 'replace', doc: d })}
                                    >
                                      Substituir arquivo
                                    </button>
                                  </>
                                )}
                              <button
                                className="btn small danger"
                                disabled={busy}
                                onClick={() => setModal({ action: 'remove', doc: d })}
                              >
                                Remover
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {tab === 'revisoes' && (
        <>
          <ReviewLedger project={p} />
          <ReviewForm project={p} onSave={saved} />
          <Card>
            <h2>Rastreabilidade</h2>
            <div className="timeline">
              {p.events
                .slice()
                .reverse()
                .map((e, i) => (
                  <article key={i}>
                    <strong>{e.action}</strong>
                    <p>
                      {e.document} {e.status}
                    </p>
                    {e.reason && <p>Motivo: {e.reason}</p>}
                    <span className="mini">
                      {new Date(e.at).toLocaleString('pt-BR')} · {e.analystName || e.actor}
                    </span>
                  </article>
                ))}
            </div>
          </Card>
        </>
      )}
      {tab === 'suporte' && (
        <Support project={p} onView={(doc) => setModal({ action: 'view', doc })} />
      )}
      <div className="actions">
        <button className="btn" onClick={() => window.print()}>
          Imprimir / salvar PDF
        </button>
      </div>
      {modal && (
        <CorrectionModal
          key={modal.action + '-' + (modal.doc?.id || p.id)}
          project={p}
          doc={modal.doc}
          action={modal.action}
          onSave={saved}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
