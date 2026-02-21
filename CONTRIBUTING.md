# Contributing

> [!WARNING]
> Este repositório está **arquivado para estudo** e não está mais ativo.
> Ele permanece público apenas para referência.
> Não há garantia de resposta, revisão de PR ou correção de issues.

## Development setup

```bash
git clone https://github.com/enoquesousa/sql-clean-app.git
cd sql-clean-app
npm install
cp .env.example .env.local
npm run dev
```

## Code style and conventions

- TypeScript strict mode enabled
- ESLint config: `eslint.config.mjs`
- Prettier config: `.prettierrc`
- Editor baseline: `.editorconfig`
- Naming:
  - Components: PascalCase
  - Utilities and functions: camelCase
  - Files (non-components): kebab-case or domain-based naming

## Branch and PR process

- Branch naming: `type/short-description`
  - Example: `feat/server-side-gemini-processing`
- Commit messages must follow Conventional Commits:

```text
<type>(<scope>): <description>
```

Allowed types:
- `feat` new functionality
- `fix` bug fix
- `refactor` behavior-preserving refactor
- `docs` documentation updates
- `style` non-functional style changes
- `test` test changes
- `chore` maintenance/config changes
- `ci` CI/CD changes
- `perf` performance improvements
- `security` security fixes

## Validation before opening PR

Run locally:

```bash
npm run lint
npm run test
npm run build
```

Or in a single command:

```bash
npm run validate
```

## Review expectations

- Keep PRs atomic and focused
- Include rationale for non-obvious technical decisions
- Update docs whenever behavior/contracts change

## Areas open for contribution

- Integration tests for API route behavior
- SQL conversion edge-case fixtures
- Accessibility and usability improvements in UI flows

## Maintainer

- Portfólio: https://enoquesousa.vercel.app
- GitHub: https://github.com/enoquesousa
