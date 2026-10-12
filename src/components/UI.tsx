import { useEffect, useRef, type ReactNode } from 'react';
export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: string }) {
  return <span className={'badge ' + color}>{children}</span>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div role={error ? 'alert' : undefined} className={'note ' + (error ? 'amber' : '')}>
      {children}
    </div>
  );
}
export function Card({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <section id={id} className="card">
      {children}
    </section>
  );
}
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="mini">{detail}</span>}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="react-modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <button
        className="btn small modal-close"
        disabled={busy}
        onClick={onClose}
        aria-label="Fechar"
      >
        ✕
      </button>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
