# Domain model

User has many Memberships and RefreshSessions. Organization owns Membership, Client, Project, Task and AuditEvent. A Membership connects a User to one Organization and carries ADMIN, MANAGER or MEMBER plus an active flag. Revocation preserves historical references.

Project belongs to one Client within its Organization. Task belongs to a Project and references creator and optional assignee Memberships in that same Organization. Composite foreign keys use `(id, organizationId)`. Task version provides optimistic concurrency. Client/project/task states use small enums; no billing, notification or analytics models are introduced.

RefreshSession stores only a hash of a random refresh secret, a family identifier, expiry and revocation time. Rotation creates a successor and revokes its predecessor atomically. Reuse revokes the family. AuthThrottle is a small PostgreSQL fixed-window counter for authentication abuse; it avoids introducing Redis.

AuditEvent stores organization, actor membership, action, entity type/id, safe change metadata and timestamp. Never store passwords, token values or entire request bodies. Organization locks serialize membership and operational mutations; business changes and audit inserts share transactions.
