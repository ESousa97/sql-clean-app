# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.2.1] - 2026-02-21

### Changed

- Repository status updated to archived-for-study in governance and community docs
- Issue and PR templates now display visible archival warning at the top
- Issue config keeps blank issues disabled and adds archived project notice link
- Dependabot configured with `open-pull-requests-limit: 0` to avoid opening new PRs

## [0.2.0] - 2026-02-21

### Added

- Server-side processing route `POST /api/clean-sql-section`
- SQL processing domain module under `src/features/sql-cleaner`
- Unit tests with Vitest and coverage thresholds
- Repository governance: issue templates, PR template, CODEOWNERS, Dependabot
- CI workflows for quality and security audit
- Project docs: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY
- Formatting and validation tooling (`prettier`, `validate` script)

### Changed

- Refactored `SqlCleanerApp` to remove monolithic implementation and improve reliability
- Migrated Gemini API key usage from client-side input to server environment variable
- Centralized visual tokens and reusable UI classes in `globals.css`
- Updated dependencies to patched versions (notably `next` and `eslint-config-next`)

### Fixed

- Removed insecure wildcard CORS configuration
- Added secure default HTTP headers in Next.js configuration

### Security

- Eliminated client-side API key exposure pattern
- Added recurring dependency audit workflow
