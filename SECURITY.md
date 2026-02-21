# Security Policy

> [!WARNING]
> Este repositório está **arquivado para estudo** e não está mais ativo.
> Ele permanece público apenas para referência.
> Não há garantia de resposta, revisão ou correção de vulnerabilidades.

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a Vulnerability

Please report vulnerabilities privately and responsibly.

- Preferred channel: GitHub Security Advisories
- Fallback email: security@sqlcleaner.local

Include in the report:

- Vulnerability description
- Reproduction steps
- Impact assessment
- Suggested remediation (optional)

## Response SLA

- Initial triage: within 72 hours
- Mitigation plan: within 7 business days
- Patch release target: based on severity and exploitability

## Security baseline

- Secrets are loaded from environment variables only
- `.env` files are gitignored
- Security headers enabled in Next.js config
- Automated audit workflow runs on PRs touching dependencies and weekly schedule
