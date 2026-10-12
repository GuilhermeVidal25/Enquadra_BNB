import { useState, type FormEvent } from 'react';
import type { CaseDocument, DataTable, Project } from '../types';
import { mutation, api } from '../lib/api';
import { extractFile, serializeCSV } from '../lib/documents';
import { precheck } from '../lib/precheck';
import { Modal, Notice } from './UI';
export type CorrectionAction = 'case' | 'edit' | 'replace' | 'remove' | 'restore' | 'view';
export default function CorrectionModal({
  project: p,
  doc,
  action,
  onSave,
  onClose,
}: {
  project: Project;
  doc?: CaseDocument;
  action: CorrectionAction;
  onSave: (p: Project) => void;
  onClose: () => void;
}) {
  const titles = {
    case: 'Editar dados do caso',
    edit: 'Corrigir dados do documento',
    replace: 'Substituir documento',
    remove: 'Remover documento da análise',
    restore: 'Restaurar documento',
    view: 'Conferir documento',
  };
  const [reason, setReason] = useState(''),
    [code, setCode] = useState(p.code),
    [title, setTitle] = useState(p.title),
    [text, setText] = useState(doc?.text || ''),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const ext = doc ? precheck.base(doc.name).split('.').pop() : '';
  const [table, setTable] = useState<DataTable | null>(() => {
    if (action === 'edit' && ext === 'csv')
      try {
        const t = precheck.parseCSV(doc?.text || '');
        return t.rows.length <= 200 && t.columns.length <= 30 ? t : null;
      } catch {}
    return null;
  });
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let result: Project;
      if (action === 'case')
        result = await mutation<Project>(
          '/cases/' + p.id,
          { revision: p.revision, code: code.trim().toUpperCase(), title, reason },
          'PATCH',
        );
      else if (action === 'replace') {
        if (!file || file.size > 10 * 1024 * 1024)
          throw Error('Selecione um arquivo de até 10 MB.');
        const f = new FormData();
        f.append('file', file, file.name);
        f.append('analysis', JSON.stringify(await extractFile(file, file.name)));
        f.append('revision', String(p.revision));
        f.append('replaces', doc!.id);
        f.append('reason', reason);
        result = await api<Project>('/cases/' + p.id + '/documents', { method: 'POST', body: f });
      } else
        result = await mutation<Project>(
          '/cases/' + p.id + '/documents/' + doc!.id + '/' + action,
          {
            revision: p.revision,
            reason,
            ...(action === 'edit' ? { text: table ? serializeCSV(table) : text } : {}),
          },
        );
      onSave(result);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={titles[action]} onClose={onClose} busy={busy}>
      {doc && <p className="muted">{doc.name}</p>}
      {action === 'view' ? (
        <>
          <p className="mini">
            SHA-256: {doc?.hash || 'Original não recebido'} · estado: {doc?.status}
          </p>
          {doc?.error && <Notice error>{doc.error}</Notice>}
          <pre className="document-text">
            {doc?.text ||
              'Não há texto extraído. Confira o original ou forneça uma versão legível.'}
          </pre>
          {doc?.originalStored !== false && (
            <a className="btn" href={'/api/cases/' + p.id + '/files/' + doc?.id}>
              Baixar original / versão
            </a>
          )}
        </>
      ) : (
        <form onSubmit={(e) => void save(e)}>
          <fieldset disabled={busy}>
            {action === 'case' && (
              <>
                <label className="field" htmlFor="edit-code">
                  Código
                </label>
                <input
                  id="edit-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  maxLength={40}
                  pattern="[-A-Za-z0-9_]+"
                />
                <label className="field" htmlFor="edit-title">
                  Nome do projeto
                </label>
                <input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                />
                <p className="mini">
                  Alterar o código exige conferir os identificadores nos documentos.
                </p>
              </>
            )}
            {action === 'edit' &&
              (table ? (
                <>
                  <div className="tablewrap csv-editor">
                    <table>
                      <thead>
                        <tr>
                          {table.columns.map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((r, i) => (
                          <tr key={i}>
                            {table.columns.map((c) => (
                              <td key={c}>
                                <textarea
                                  aria-label={c + ' linha ' + (i + 2)}
                                  value={String(r[c] ?? '')}
                                  onChange={(e) =>
                                    setTable({
                                      ...table,
                                      rows: table.rows.map((row, n) =>
                                        n === i ? { ...row, [c]: e.target.value } : row,
                                      ),
                                    })
                                  }
                                />
                              </td>
                            ))}
                            <td>
                              <button
                                type="button"
                                className="btn small danger"
                                onClick={() =>
                                  setTable({ ...table, rows: table.rows.filter((_, n) => n !== i) })
                                }
                              >
                                Remover linha
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="btn small"
                    disabled={table.rows.length >= 200}
                    onClick={() =>
                      setTable({
                        ...table,
                        rows: [
                          ...table.rows,
                          Object.fromEntries(table.columns.map((c) => [c, ''])),
                        ],
                      })
                    }
                  >
                    Adicionar linha
                  </button>
                </>
              ) : (
                <>
                  <label className="field" htmlFor="edit-content">
                    Conteúdo ({ext})
                  </label>
                  <textarea
                    id="edit-content"
                    className="raw-editor"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                    maxLength={2097152}
                  />
                </>
              ))}
            {action === 'replace' && (
              <>
                <label className="field" htmlFor="replace-file">
                  Nova versão
                </label>
                <input
                  id="replace-file"
                  type="file"
                  accept={'.' + ext}
                  required
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <p className="mini">
                  Mesmo formato; até 10 MB. O caminho usado na análise será mantido.
                </p>
              </>
            )}
            {action === 'remove' && (
              <Notice error>
                O documento sairá das evidências atuais. Pendências serão recalculadas. Você poderá
                restaurá-lo pelo inventário.
              </Notice>
            )}
            {action === 'restore' && (
              <Notice>O documento voltará às evidências atuais e será conferido novamente.</Notice>
            )}
            <label className="field" htmlFor="correction-reason">
              Motivo da alteração
            </label>
            <textarea
              id="correction-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={5}
              maxLength={2000}
            />
            <p className="mini">
              A versão anterior e as avaliações ficam no histórico; a checagem será atualizada.
            </p>
            {error && <Notice error>{error}</Notice>}
            <div className="actions">
              <button className={'btn ' + (action === 'remove' ? 'danger' : 'primary')}>
                {busy
                  ? 'Salvando…'
                  : action === 'remove'
                    ? 'Confirmar remoção'
                    : 'Salvar e verificar'}
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
