# Security and Privacy Rules

## Trust model

All browser input is untrusted. Authentication establishes identity; it does not automatically grant authorization.

Every sensitive read or mutation must be authorized server-side and, where supported, reinforced by database Row Level Security (RLS).

## Secrets

- Never commit `.env`, `.env.local`, production credentials, JWT secrets, private keys, database passwords, Supabase service-role keys, or third-party API secrets.
- Browser code may only receive values explicitly intended for public exposure.
- Supabase service-role credentials are server-only and must never be bundled into client code.
- If a secret is accidentally committed, remove it from use and rotate it immediately; deleting the file alone is insufficient.

## Authentication

- Use the configured authentication provider consistently.
- Never trust a user ID supplied by the client when the authenticated server session can provide the identity.
- Session and token validation must occur at the relevant server boundary.

## Authorization

Define roles/capabilities explicitly rather than scattering ad hoc checks throughout UI code.

Typical capabilities may include:

- public/read-only visitor,
- authenticated family member,
- contributor/editor,
- administrator/moderator.

The exact role model may evolve, but authorization rules must be centralized and testable.

UI hiding is not authorization. A user who cannot see an Edit button must also be unable to invoke the corresponding mutation directly.

## Living-person privacy

Information about living people requires stricter defaults than historical records.

- Do not expose sensitive personal details publicly by default.
- Minimize collection of phone numbers, email addresses, exact addresses, identification numbers, or other unnecessary personal data.
- If such data becomes required, document its purpose, visibility, retention, and access rules before implementation.
- Search results, metadata, previews, logs, and API errors must respect the same privacy boundaries as profile pages.

## Input validation

All mutation inputs must be validated server-side with an explicit schema.

- Reject malformed IDs and unsupported enum values.
- Apply reasonable text length limits.
- Sanitize or safely render user-provided rich content to prevent XSS.
- Never interpolate raw input into SQL.
- Validate uploaded file type/size server-side if file upload is introduced.

## Database security

- Enable RLS on user-accessible Supabase tables unless a documented server-only design makes that unnecessary.
- Prefer least-privilege policies.
- Do not solve RLS failures by replacing ordinary user access with a service-role client.
- Elevated server actions must explicitly check permission before using elevated credentials.

## Web security

- Use framework protections against XSS and CSRF; do not bypass escaping with unsafe HTML unless content is sanitized.
- Validate redirect targets to avoid open redirects.
- Do not expose internal exception details to users.
- Add rate limiting/abuse protection to high-risk public endpoints when they are introduced.

## Logging and analytics

Never log passwords, access tokens, session cookies, secret keys, or raw sensitive personal data. Analytics should collect the minimum information needed to operate the product.

## Dependency security

Avoid unnecessary packages. Before adding a dependency, verify that it is actively maintained, appropriate for the task, and does not duplicate existing functionality. Security fixes should not be postponed merely to preserve an obsolete API.