import { Card, Notice } from '../components/UI';
import { criteria } from '../lib/reviews';
export default function References() {
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">Conhecimento estruturado</div>
          <h1>Base de critérios</h1>
          <p className="muted">Referências para a validação da equipe.</p>
        </div>
      </div>
      <Notice error>
        Os critérios apoiam a análise técnica de P&D. O protótipo não verifica os requisitos fiscais
        da empresa nem calcula o incentivo.
      </Notice>
      <Card>
        <h2>Critérios técnicos</h2>
        {criteria.map((n, i) => (
          <div className="doc" key={n}>
            <span className="doc-icon">0{i + 1}</span>
            <div>
              <h3>{n}</h3>
              <p className="muted">
                {
                  [
                    'Investigar o avanço em relação ao conhecimento disponível.',
                    'Identificar a abordagem própria e a contribuição técnica.',
                    'Conferir a dificuldade técnica sem solução previamente determinada.',
                    'Relacionar planejamento, execução, versões e registros.',
                    'Conferir registros para transferir ou reproduzir o conhecimento.',
                  ][i]
                }
              </p>
            </div>
          </div>
        ))}
      </Card>
      <Card>
        <h2>Referências para validação</h2>
        <div className="actions">
          {[
            [
              'Lei nº 11.196/2005',
              'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11196compilado.htm',
            ],
            [
              'Guia da Lei do Bem',
              'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/lei-do-bem/arquivo/pdf/8705_LEI_DO_BEM___O_que_e_inovacao_para_a_Lei_do_Bem_convertido__ANPEI__MCTIC.pdf',
            ],
            [
              'Manual de Frascati 2015 · português',
              'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/indicadores/paginas/referencias/manuais-de-referencia/arquivos/OCDE_ManualFrascati_2015_PT_BR.pdf',
            ],
            [
              'Página oficial da OCDE',
              'https://www.oecd.org/en/publications/2015/10/frascati-manual-2015_g1g57dcb.html',
            ],
          ].map(([title, url]) => (
            <a className="btn" href={url} key={url} target="_blank" rel="noopener noreferrer">
              {title}
            </a>
          ))}
        </div>
        <p className="mini">
          Confira a edição e os trechos aplicáveis ao fundamentar sua conclusão.
        </p>
      </Card>
    </>
  );
}
