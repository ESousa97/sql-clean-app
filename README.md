# SQL Cleaner

> Transforme um dump difícil em um restore confiável, sem custo de plataforma e sem complicação.

![CI](https://github.com/enoquesousa/sql-clean-app/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/github/license/enoquesousa/sql-clean-app)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![Last Commit](https://img.shields.io/github/last-commit/enoquesousa/sql-clean-app)

---

## Por que este projeto existe

Eu criei essa plataforma por necessidade real.

Eu não tinha mais orçamento para manter o banco de dados na Vercel.
No mesmo período, minha máquina deu tela azul e eu precisei agir rápido para migrar e restaurar dados sem depender de ferramenta paga.

Foi daí que nasceu o SQL Cleaner: uma forma **gratuita, prática e segura** de preparar dumps PostgreSQL para restore.

Se você chegou até aqui, provavelmente já sentiu essa pressão também: pouco tempo, pouco orçamento e muito risco de perder dados.
Este projeto existe para reduzir esse risco.

## O que a plataforma faz

O SQL Cleaner:

- recebe um arquivo `.sql` ou `.txt` de dump PostgreSQL
- separa estrutura e dados
- converte blocos `COPY ... FROM stdin` para `INSERT`
- organiza a saída para facilitar restauração
- gera um arquivo final pronto para download (`restore_clean.sql`)

## Como funciona (em 3 passos)

1. **Upload:** você envia o dump no navegador.
2. **Processamento:** o app divide em seções, trata em blocos e valida a transformação.
3. **Resultado:** você baixa um SQL limpo para restaurar com mais previsibilidade.

## Para quem é

- Devs em migração de ambiente (produção, staging, local)
- Pessoas saindo de serviços pagos para alternativas mais baratas
- Equipes de suporte/infra que precisam agir rápido em incidentes
- Qualquer pessoa que precisa de um caminho simples para recuperar base

## Intuito do projeto

Democratizar a migração e restauração de banco de dados.

A ideia é simples: se eu passei por isso, outras pessoas também passam.
Então a plataforma foi feita para ser uma ponte entre o caos de um dump bruto e a tranquilidade de um restore mais confiável.

## Stack tecnológica

- Next.js 15 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4 + tokens CSS
- Vitest

## Pré-requisitos

- Node.js >= 20
- npm >= 10

## Instalação

```bash
git clone https://github.com/enoquesousa/sql-clean-app.git
cd sql-clean-app
npm install
cp .env.example .env.local
```

Defina a variável `GEMINI_API_KEY` em `.env.local`.

## Executando localmente

```bash
npm run dev
```

Acesse: `http://localhost:3000`

## Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Executa build de produção |
| `npm run lint` | Linting com ESLint |
| `npm run lint:fix` | Corrige lint automaticamente |
| `npm run test` | Testes unitários |
| `npm run test:watch` | Testes em watch |
| `npm run test:coverage` | Cobertura de testes |
| `npm run format` | Formatação com Prettier |
| `npm run format:check` | Verificação de formatação |
| `npm run validate` | Lint + testes + build |

## Segurança e arquitetura

- A chave `GEMINI_API_KEY` fica no servidor (não exposta no front-end)
- O processamento é feito em seções para reduzir falhas em arquivos grandes
- A saída preserva a estrutura de tabelas e organiza os dados por contexto

## Contribuindo

Consulte [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

MIT — veja [LICENSE](LICENSE).

## Autor

Enoque Sousa  
GitHub: https://github.com/enoquesousa
