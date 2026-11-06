# Tenant isolation

URLs carry an organization ID, never authority. Each protected request authenticates the session. Tenant services then acquire a shared organization lock for reads or an exclusive lock for writes, load active membership for the authenticated user, and evaluate a central capability. Queries always include organizationId. Cross-organization resource identifiers yield not-found responses without leaking the resource.

Client→Project, Project→Task and Membership→Task relationships have composite foreign keys containing organizationId. The service validates referenced records in the same transaction, including active assignment membership. Member status changes additionally require that the task is assigned to that exact membership. Strict DTOs reject unexpected fields and organizationId spoofing.

Membership revocation and role changes acquire the same organization lock as mutations. Last-Admin checks and changes are atomic. Revoking a membership unassigns its tasks in the transaction; historical creator/activity relations remain intact. Access decisions take effect for subsequent requests; already accepted in-flight requests are not claimed to be cancellable.

Negative integration tests must exercise clients, projects, tasks, members, activity, foreign references, role restrictions, revoked sessions and concurrency against PostgreSQL, not only mocked repositories.
