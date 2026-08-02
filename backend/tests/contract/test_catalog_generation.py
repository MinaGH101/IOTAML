from app.nodes.catalog.generate import OUTPUT_PATH, render_catalog


def test_generated_catalog_is_current() -> None:
    assert OUTPUT_PATH.read_text(encoding="utf-8") == render_catalog()


def test_catalog_contains_only_versioned_unique_nodes() -> None:
    import json

    payload = json.loads(render_catalog())
    ids = [node["id"] for node in payload["nodes"]]
    assert len(ids) == len(set(ids))
    assert all(str(node["cacheVersion"]).strip() for node in payload["nodes"])
