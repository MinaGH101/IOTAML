# Authentication and Authorization

IOTA ML uses two authorization layers:

1. A system role on the user account.
2. A project permission derived from ownership or an explicit assignment.

Every protected API endpoint checks authorization on the server. Hiding a
frontend button is only a usability measure and is not the security boundary.

## System roles

| Role | System behavior |
|---|---|
| `admin` | Full project access and user administration. |
| `manager` | Full access to owned projects, read-only visibility of all other projects, and assignment management for owned projects. |
| `expert` | Full access to owned projects and edit/run access to projects assigned as `edit`. |
| `guest` | View-only access to projects explicitly assigned as `view`. Guests cannot create projects. |

## Project permissions

| Permission | View | Edit | Run | Delete project | Manage assignments |
|---|---:|---:|---:|---:|---:|
| `owner` | Yes | Yes | Yes | Yes | Manager/Admin owners only |
| `edit` | Yes | Yes | Yes | No | No |
| `view` | Yes | No | No | No | No |
| `admin` | Yes | Yes | Yes | Yes | Yes |

Only one active `edit` assignment is allowed per project. Edit access can be
assigned only to an Expert. Multiple view assignments are allowed. Assignment
does not transfer ownership.

Managers always remain read-only on projects they do not own, even if an old or
manually modified database row contains an edit assignment. Guests are also
forced to view-only access if a stale edit assignment exists.

## New-assignment state

A new assignment is stored with `is_new=true`. The project is displayed at the
top of the assignee's project page until the project is opened or the
acknowledgement endpoint is called.

## Admin bootstrap

The startup bootstrap reads:

```text
ADMIN_BOOTSTRAP_ENABLED
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_FIRST_NAME
ADMIN_LAST_NAME
```

The password is consumed only when the configured admin account does not exist.
Normal restarts and Alembic migrations never replace the password stored in the
database. If the database is intentionally deleted and recreated, the same
environment credentials recreate the admin account.

Existing usernames are immutable because project and historical runtime records
use the username as a stable ownership key. Email, profile fields, password,
role, and active state remain editable. A user who owns projects cannot be
changed to Guest or deleted until those projects are transferred or deleted.

## Routes

Authentication:

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
PUT  /api/auth/profile
POST /api/auth/change-password
```

Admin users:

```text
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/{user_id}
PUT    /api/admin/users/{user_id}
DELETE /api/admin/users/{user_id}
```

Projects and assignments:

```text
GET  /api/projects
GET  /api/projects/assignable-users
POST /api/projects/{project_id}/acknowledge
```

## Migration

Alembic revision `20260802_0007` adds canonical roles, revocable login sessions,
and project assignments without deleting existing projects or workflow data.
The Compose migration service runs `alembic upgrade head` before API startup.
