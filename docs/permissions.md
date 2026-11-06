# Capabilities

| Capability                                        | ADMIN              | MANAGER          | MEMBER              |
| ------------------------------------------------- | ------------------ | ---------------- | ------------------- |
| Read workspace, clients, projects, tasks, members | Yes                | Yes              | Yes                 |
| Change organization settings                      | Yes                | No               | No                  |
| Add/change/revoke registered memberships          | Yes                | No               | No                  |
| Create/update/delete unreferenced clients         | Yes                | Yes              | No                  |
| Create/update/archive projects                    | Yes                | Yes              | No                  |
| Create/edit/assign/delete tasks                   | Yes                | Yes              | No                  |
| Change task status                                | Any task           | Any task         | Assigned tasks only |
| Activity                                          | Whole organization | Business actions | Own actions         |

These are deliberate Phase 3 workspace-wide read permissions. There are no project-private groups. Capabilities are centralized in the contracts package. The browser hides unavailable controls for usability; the API independently checks current membership, capability, organization and resource ownership in its transaction. Last-Admin protection prevents lockout. Membership assignment is to existing registered accounts; email invitations are out of scope.
