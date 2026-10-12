# Enquadra · React + TypeScript

Projeto navegável do MVP de análise documental de P&D, preservando o layout e as funcionalidades implementadas.

## Executar

Requisito: Node.js 22.13 ou superior.

```bash
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. A interface React e a API local iniciam juntas.

## Funcionalidades

- Os 40 casos fictícios do evento e seus 560 arquivos originais.
- Dossiê individual, checagem prévia, pendências e conferência numérica.
- Upload de PDF, CSV, XLSX, JSON, Markdown, TXT e ZIP.
- Edição de dados, substituição de documentos, remoção e restauração.
- Avaliações individuais, checks por analista, divergências e histórico por versão.
- Exportação do dossiê e referências da Lei do Bem, Guia e Manual de Frascati.
- Consulta documental local; a integração por IA permanece sem ativação.

Os perfis Analista 1 e Analista 2 são simulações locais. Novos arquivos e avaliações ficam em `.local-data/`, ignorada pelo Git. A revisão humana continua obrigatória; a checagem não constitui aprovação fiscal.

## Compilar

```bash
npm run build
npm run preview
```

A interface está em `src/`, em React + TypeScript. A API local e o armazenamento estão em `server/`, em TypeScript, com o motor JavaScript existente preservado em `server/engine/`. Os dados necessários à demonstração ficam em `data/`.

Esta entrega não inclui arquivos de teste, relatórios de teste, dependências instaladas, builds, credenciais ou dados privados enviados ao Site. O `.gitignore` está pronto para subir o código no GitHub.
