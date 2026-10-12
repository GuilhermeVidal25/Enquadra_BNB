import type { ReactNode } from 'react';
import type { Analyst } from '../types';
function Symbol() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <rect
        x="15"
        y="14"
        width="66"
        height="66"
        rx="8"
        fill="none"
        stroke="#F68B1F"
        strokeWidth="7"
      />
      <path
        d="M24 22 C43 22,51 31,51 45 C41 36,33 34,24 34 Z M72 22 C53 22,45 31,45 45 C55 36,63 34,72 34 Z M47 45 C30 49,25 63,24 81 L42 81 C41 67,43 56,47 45 Z M49 45 C66 49,71 63,72 81 L54 81 C55 67,53 56,49 45 Z"
        fill="#fff"
      />
      <rect x="50" y="72" width="31" height="8" fill="#F68B1F" />
    </svg>
  );
}
export default function Layout({
  page,
  children,
  profile,
  profiles,
  onProfile,
}: {
  page: string;
  children: ReactNode;
  profile: Analyst | null;
  profiles: Analyst[];
  onProfile: (id: string) => void;
}) {
  const nav = [
    ['dashboard', 'Visão geral'],
    ['analisados', 'Casos analisados'],
    ['entrada', 'Novos casos'],
    ['referencias', 'Base de critérios'],
  ];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="bnb-brand-block">
          <div className="bnb-logo-lockup">
            <div className="bnb-symbol">
              <Symbol />
            </div>
            <div className="bnb-wordmark">
              Banco do
              <br />
              Nordeste
            </div>
          </div>
          <div className="app-brand-separator" />
          <div className="app-name">Enquadra</div>
          <div className="tag">Lei do Bem · apoio à decisão</div>
        </div>
        <nav className="nav" aria-label="Principal">
          {nav.map(([key, label]) => (
            <a
              key={key}
              href={'#' + key}
              className={page === key || (page === 'caso' && key === 'analisados') ? 'active' : ''}
              aria-current={page === key ? 'page' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="rule">
          <b>Princípio do sistema</b>
          <p>O sistema lê, confere e organiza evidências.</p>
          <b>A decisão final é sempre do analista.</b>
        </div>
        <div className="sidebar-bottom">
          {profiles.length > 0 ? (
            <>
              <label htmlFor="demo-profile">Perfil da demonstração local</label>
              <select
                id="demo-profile"
                value={profile?.id || profiles[0]?.id}
                onChange={(e) => onProfile(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p>
                Troque o perfil para testar avaliações de duas pessoas. É uma simulação local de
                identidade.
              </p>
            </>
          ) : (
            <p>{profile?.name || 'Analista'}</p>
          )}
          <p>
            Hackathon STS 2026
            <br />
            Conceito para o BNB · dados fictícios
          </p>
        </div>
      </aside>
      <main className="main">
        <header className="institutional-hero">
          <div className="institutional-top">
            <div className="hero-symbol">
              <Symbol />
            </div>
            <div>
              <div className="bank-name">Banco do Nordeste</div>
              <div className="bank-context">Pesquisa, Desenvolvimento e Inovação</div>
            </div>
          </div>
          <div className="application-strip">
            <div className="application-label">Aplicação</div>
            <div>
              <div className="application-name">Enquadra</div>
              <div className="application-subtitle">
                Inteligência documental para análise de inovação e P&D
              </div>
            </div>
            <span className="demo">PROTÓTIPO · React + TypeScript</span>
          </div>
        </header>
        <div className="human-banner">
          <b>Decisão humana obrigatória.</b> O analista confere as fontes, fundamenta os critérios e
          decide.
        </div>
        <div className="content">
          {children}
          <p className="endnote">
            A checagem estrutural e numérica não certifica elegibilidade nem substitui revisão
            técnica. PDFs sem texto exigem OCR externo. O protótipo não constitui aprovação fiscal.
          </p>
        </div>
      </main>
    </div>
  );
}
