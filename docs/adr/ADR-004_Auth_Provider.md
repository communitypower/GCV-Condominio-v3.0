# ADR-004: Auth Provider

Date: 2026-06-13

Status: Approved

## Context

GCV Condominio requires user authentication. While production environments will eventually use a managed identity provider (e.g. Supabase Auth, Clerk, or Auth0), requiring external services during local development and testing introduces friction, network dependencies, and cost.

## Decision

For local development and testing:
1. Implement a **local Mock Session** using signed, HTTP-only, secure cookies.
2. Provide a mock-login API endpoint (`/api/v1/auth/mock-login`) allowing developer/agent to assume roles and mock memberships.
3. Keep the architectural layer decoupled so we can swap mock sessions for a production JWT/provider strategy easily.

## Rationale

- **Zero Dependency**: Works completely offline.
- **Speed**: Speeds up integration tests and agent execution.
- **Flexibility**: Pre-aligns with secure cookie-based session management principles.

## Alternatives Considered

- **Immediate Managed Auth (e.g., Auth0/Clerk)**: Requires API keys and cloud configurations, adding billing and latency overhead to local-first development.
- **Unsecured local tokens (localStorage)**: Risks exposing tokens to cross-site scripting (XSS) and does not match production security postures.

## Consequences

Positive:
- No external network or service requirements for local runs.
- Simple testing and verification of role flows.

Tradeoffs:
- Requires swapping cookie parser integration when transitioning to the production auth provider.
