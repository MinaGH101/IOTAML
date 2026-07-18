# Reusable workflow components

IOTA ML components are immutable, versioned sub-workflows that behave like normal typed nodes. They are stored independently from projects so private and organization components can be reused in other workflows; project-scoped components are available only inside their project.

## Creating a component

1. Select at least two connected nodes in the workflow canvas.
2. Click the **Group / Component** icon in the top-left actions.
3. Enter a name, description, semantic version, visibility, and review the automatically detected public ports.
4. Confirm **Create and replace**. The selected graph is replaced by one component node and external edges are safely rewired.

Disconnected selections are rejected. Internal node coordinates are normalized before persistence.

## Editing the internal workflow

Double-click a component node or open the current component from the right-panel component library. A breadcrumb banner shows that the editor is inside the component.

- **Ports and parameters** controls the component's public contract.
- Internal ports are private unless published.
- Internal node parameters are private unless explicitly exposed.
- Leaving with unsaved changes requires confirmation.
- Saving creates a new immutable semantic version; it never mutates an older version.

## Version behavior

Every component instance is pinned to a concrete component-version ID and embeds an immutable execution snapshot. Changing the library's current version does not silently change existing workflows.

The component library version manager supports:

- viewing every immutable version;
- opening an older version as the base for a new version;
- selecting a library current version;
- exporting a specific version;
- deleting an unused, non-current version.

After editing a component from a workflow instance, the UI offers to upgrade only that instance. The upgrade is blocked when connected public port IDs are no longer compatible.

## Runtime and caching

A component is executed as a real node. Its internal node IDs are namespaced under the parent node, so progress and errors can identify the exact internal node. Nested components are supported up to 12 levels. Dependency cycles are rejected.

Internal nodes use the normal deterministic artifact cache. Cache identity includes the pinned component graph hash, exposed settings, upstream artifact digests, and each internal node implementation version. Updating one internal branch invalidates only that branch and its downstream dependents.

## Import and export

`.iotacomp.json` packages include:

- root component metadata and immutable version;
- typed public interface;
- exposed parameters;
- internal graph and graph hash;
- changelog;
- all nested component dependencies, recursively.

Import is transactional. Dependencies are imported first, internal registry IDs and snapshots are remapped, and the entire import is rolled back if any dependency or graph is invalid.

## Deletion and dependency safety

A component or component version cannot be deleted while referenced by:

- a current workflow draft;
- a named workflow version;
- another component version.

Archive components that should no longer appear in the palette but must remain available to existing workflows.

## API surface

```text
GET    /api/components
POST   /api/components
GET    /api/components/{id}
PATCH  /api/components/{id}
DELETE /api/components/{id}

GET    /api/components/{id}/versions
POST   /api/components/{id}/versions
GET    /api/components/{id}/versions/{version_id}
POST   /api/components/{id}/versions/{version_id}/make-current
DELETE /api/components/{id}/versions/{version_id}

GET    /api/components/{id}/registry
GET    /api/components/{id}/usage
GET    /api/components/{id}/export
POST   /api/components/import
```

## Database migration

The feature is created by Alembic revision:

```text
20260716_0004_reusable_workflow_components
```

Run:

```bash
cd backend
alembic upgrade head
```
