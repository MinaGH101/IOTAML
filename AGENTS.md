# Graphify-assisted navigation

When the `graphify` MCP server is available for this repository, use it before broad code searches or reading many files to:

- identify the implementation, callers, dependencies, and linked tests relevant to a request;
- assess the static impact of a proposed change; and
- narrow source reads to the files and symbols returned by the graph.

Treat Graphify as a navigation and impact-analysis aid, not as a source of truth. Verify important findings in the current source before making changes. If Graphify is unavailable, stale, or does not cover the requested area, continue with the normal repository investigation workflow.
