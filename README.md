# IOTA ML Node Class Refactor - Phase 1

This patch redesigns the backend node system into:

- `BaseNode` class
- one Python file per node
- category folders
- automatic registry from node classes
- 3 nodes per category only, 33 total nodes
- runtime input routing by target handle/port
- simplified executor that delegates operation to the node class

## Apply

From project root:

```bash
unzip -o /mnt/data/iota_node_class_refactor_phase1.zip
```

Then rebuild:

```bash
docker compose up -d --build
```

## First test workflow

CSV -> Missing Values Report -> Conditional Filter -> Histogram

For Conditional Filter column filtering, connect:

- CSV output to Filter `data` input
- Missing Values Report output to Filter `criteria` input

Settings:

```json
{
  "filter_target": "columns",
  "match_key": "column_name",
  "conditions": {
    "logic": "AND",
    "groups": [
      {
        "logic": "AND",
        "conditions": [
          { "field": "missing_percent", "operator": "<", "value": 10 }
        ]
      }
    ]
  }
}
```
