"""Regression and contract tests for node cache."""

from __future__ import annotations

from pathlib import Path

from app.workflow.caching.keys import canonical_json, full_cache_key, sha256_json, static_fingerprint
from app.workflow.caching.runtime import RuntimeNodeCache, _sha256_file


def _node() -> dict:
    return {
        "id": "manual-json-1",
        "type": "mlNode",
        "data": {
            "registryId": "DI-001",
            "params": {"json_text": '[{"x": 1}]'},
        },
    }


def test_canonical_json_and_cache_key_are_order_independent() -> None:
    left = {"b": 2, "a": {"y": 2, "x": 1}}
    right = {"a": {"x": 1, "y": 2}, "b": 2}
    assert canonical_json(left) == canonical_json(right)
    assert sha256_json(left) == sha256_json(right)

    key_a = full_cache_key(
        static_key="static",
        resolved_params={"b": 2, "a": 1},
        upstream=[{"node_id": "a", "digest": "1"}],
        external_inputs={"datasets": {"7": {"checksum": "abc"}}},
        target_column="target",
        task_type="classification",
    )
    key_b = full_cache_key(
        static_key="static",
        resolved_params={"a": 1, "b": 2},
        upstream=[{"digest": "1", "node_id": "a"}],
        external_inputs={"datasets": {"7": {"checksum": "abc"}}},
        target_column="target",
        task_type="classification",
    )
    assert key_a == key_b


def test_cache_key_changes_for_parameters_or_upstream_content(tmp_path: Path) -> None:
    cache = RuntimeNodeCache(
        {"enabled": True, "entries": {}, "static": {}},
        tmp_path,
        external_inputs={"primary_dataset_id": 7, "datasets": {"7": {"checksum": "abc"}}},
        target_column="target",
        task_type="classification",
    )
    node = _node()
    key_a, _ = cache.key_for(node, {"value": 1}, [])
    key_b, _ = cache.key_for(node, {"value": 2}, [])
    key_c, _ = cache.key_for(node, {"value": 1}, [{"node_id": "upstream", "digest": "different"}])
    assert key_a != key_b
    assert key_a != key_c


def test_paid_review_nodes_are_durable_and_pure_dynamic_forms_stay_safe() -> None:
    def review_node(node_id: str, mode: str) -> dict:
        return {
            "id": f"{node_id.lower()}-1",
            "type": "mlNode",
            "data": {"registryId": node_id, "params": {"input_mode": mode}},
        }

    assert static_fingerprint(review_node("RV-001", "static"))[1]["cacheable"] is True
    assert static_fingerprint(review_node("RV-011", "static"))[1]["cacheable"] is True
    assert static_fingerprint(review_node("RV-003", "static"))[1]["cacheable"] is True
    assert static_fingerprint(review_node("RV-003", "dynamic"))[1]["cacheable"] is True
    assert static_fingerprint(review_node("RV-004", "static"))[1]["cacheable"] is True
    assert static_fingerprint(review_node("RV-005", "static"))[1]["cacheable"] is True
    assert static_fingerprint(review_node("RV-001", "dynamic"))[1]["cacheable"] is False
    assert static_fingerprint(review_node("RV-002", "dynamic"))[1]["cacheable"] is False
    for node_id in ("RV-011", "RV-003", "RV-004", "RV-005"):
        assert static_fingerprint(review_node(node_id, "static"))[1]["cache_persistent"] is True


def test_review_model_names_are_part_of_relevant_cache_keys(tmp_path: Path) -> None:
    node = {
        "id": "ocr-1",
        "type": "mlNode",
        "data": {"registryId": "RV-011", "params": {"max_pages": 60}},
    }
    first = RuntimeNodeCache(
        {"enabled": True, "entries": {}, "static": {}},
        tmp_path / "first",
        external_inputs={"models": {"ocr": "mistral-ocr-latest"}},
        target_column=None,
        task_type="auto",
    )
    second = RuntimeNodeCache(
        {"enabled": True, "entries": {}, "static": {}},
        tmp_path / "second",
        external_inputs={"models": {"ocr": "different-ocr-model"}},
        target_column=None,
        task_type="auto",
    )
    assert first.key_for(node, node["data"]["params"], [])[0] != second.key_for(
        node, node["data"]["params"], []
    )[0]


def test_declared_artifact_checksums_are_part_of_relevant_cache_keys(tmp_path: Path) -> None:
    node = {
        "id": "ocr-1",
        "type": "mlNode",
        "data": {"registryId": "RV-011", "params": {"pdf_files": [11], "max_pages": 60}},
    }
    first = RuntimeNodeCache(
        {"enabled": True, "entries": {}, "static": {}},
        tmp_path / "first-artifact",
        external_inputs={"models": {"ocr": "ocr-model"}, "artifacts": {"11": "first-checksum"}},
        target_column=None,
        task_type="auto",
    )
    second = RuntimeNodeCache(
        {"enabled": True, "entries": {}, "static": {}},
        tmp_path / "second-artifact",
        external_inputs={"models": {"ocr": "ocr-model"}, "artifacts": {"11": "changed-checksum"}},
        target_column=None,
        task_type="auto",
    )
    assert first.key_for(node, node["data"]["params"], [])[0] != second.key_for(
        node, node["data"]["params"], []
    )[0]


def test_runtime_cache_round_trip_uses_verified_manifest(tmp_path: Path) -> None:
    node = _node()
    result = {"rows": [{"x": 1}, {"x": 2}], "metadata": {"count": 2}}
    writer = RuntimeNodeCache(
        {"enabled": True, "entries": {}, "static": {}},
        tmp_path / "writer",
        external_inputs={"primary_dataset_id": 7, "datasets": {"7": {"checksum": "abc"}}},
        target_column=None,
        task_type="auto",
    )
    record = writer.store(node, result, node["data"]["params"], [], {"duration_ms": 4})
    assert record is not None
    cache_path = Path(record["path"])
    assert cache_path.is_file()

    fingerprint, policy = static_fingerprint(node)
    manifest = {
        "enabled": True,
        "static": {node["id"]: {"static_fingerprint": fingerprint, **policy}},
        "entries": {
            record["cache_key"]: {
                "cache_entry_id": 42,
                "artifact_id": 99,
                "path": str(cache_path),
                "checksum_sha256": _sha256_file(cache_path),
                "output_digest": record["output_digest"],
                "source_run_id": 3,
                "size_bytes": cache_path.stat().st_size,
            }
        },
    }
    reader = RuntimeNodeCache(
        manifest,
        tmp_path / "reader",
        external_inputs={"primary_dataset_id": 7, "datasets": {"7": {"checksum": "abc"}}},
        target_column=None,
        task_type="auto",
    )
    cached, hit = reader.lookup(node, node["data"]["params"], [])
    assert cached == result
    assert hit["status"] == "cached"
    assert hit["artifact_id"] == 99
    assert reader.output_artifacts[node["id"]] == 99

    cache_path.write_bytes(b"tampered")
    rejected, _ = reader.lookup(node, node["data"]["params"], [])
    assert rejected is None


def test_selected_node_refreshes_only_itself_while_upstream_cache_still_hits(tmp_path: Path) -> None:
    upstream = _node()
    selected = {
        "id": "selected",
        "type": "mlNode",
        "data": {"registryId": "UT-002", "params": {}},
    }
    writer = RuntimeNodeCache(
        {"enabled": True, "entries": {}, "static": {}},
        tmp_path / "force-writer",
        external_inputs={}, target_column=None, task_type="auto",
    )
    upstream_record = writer.store(upstream, {"value": 1}, upstream["data"]["params"], [], {})
    parent_refs = writer.parent_refs("selected", [{"source": upstream["id"], "target": "selected"}])
    selected_record = writer.store(selected, {"value": 2}, {}, parent_refs, {})
    assert upstream_record is not None and selected_record is not None

    def entry(record):
        path = Path(record["path"])
        return {
            "cache_entry_id": 1,
            "artifact_id": 1,
            "path": str(path),
            "checksum_sha256": _sha256_file(path),
            "output_digest": record["output_digest"],
            "source_run_id": 1,
            "size_bytes": path.stat().st_size,
        }

    manifest = {
        "enabled": True,
        "force_node_ids": ["selected"],
        "entries": {
            upstream_record["cache_key"]: entry(upstream_record),
            selected_record["cache_key"]: entry(selected_record),
        },
        "static": {},
    }
    reader = RuntimeNodeCache(
        manifest, tmp_path / "force-reader",
        external_inputs={}, target_column=None, task_type="auto",
    )
    upstream_value, upstream_meta = reader.lookup(upstream, upstream["data"]["params"], [])
    assert upstream_value == {"value": 1}
    assert upstream_meta["status"] == "cached"
    refreshed_parents = reader.parent_refs("selected", [{"source": upstream["id"], "target": "selected"}])
    selected_value, selected_meta = reader.lookup(selected, {}, refreshed_parents)
    assert selected_value is None
    assert selected_meta["cache_refresh"] is True
    refresh_record = reader.store(selected, {"value": 3}, {}, refreshed_parents, {})
    assert refresh_record is not None
    assert refresh_record["cache_refresh"] is True


def test_persisted_cache_records_create_artifacts_lineage_and_reusable_manifest(tmp_path: Path) -> None:
    import joblib
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.core.database import Base
    from app.domains.artifacts.models import Artifact, ArtifactLineage, NodeCacheEntry, NodeExecution
    from app.infrastructure.storage.service import get_storage_backend
    from app.domains.projects.models import Project
    from app.domains.runs.models import Run
    from app.domains.workflows.models import Workflow
    from app.workflow.caching.service import persist_run_cache_records, prepare_cache_manifest
    from app.infrastructure.queue.state import utcnow

    get_storage_backend.cache_clear()
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        project = Project(name="Project", owner_username="admin")
        db.add(project)
        db.flush()
        source = _node()
        target = {
            "id": "pass-1",
            "type": "mlNode",
            "data": {"registryId": "UT-002", "params": {}},
        }
        graph = {
            "nodes": [source, target],
            "edges": [{"id": "edge-1", "source": source["id"], "target": target["id"]}],
        }
        workflow = Workflow(
            name="Cached workflow",
            graph=graph,
            project_id=project.id,
            owner_username="admin",
            revision=1,
            graph_hash=sha256_json(graph),
        )
        db.add(workflow)
        db.flush()
        run = Run(
            workflow_name=workflow.name,
            workflow_graph=graph,
            workflow_id=workflow.id,
            workflow_revision=workflow.revision,
            project_id=project.id,
            owner_username="admin",
            status="succeeded",
            queued_at=utcnow(),
            node_statuses={},
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        source_path = tmp_path / "source.joblib"
        target_path = tmp_path / "target.joblib"
        joblib.dump({"value": 1}, source_path)
        joblib.dump({"value": 1}, target_path)
        source_static, source_policy = static_fingerprint(source)
        target_static, target_policy = static_fingerprint(target)
        source_digest = _sha256_file(source_path)
        target_digest = _sha256_file(target_path)
        source_key = full_cache_key(
            static_key=source_static,
            resolved_params=source["data"]["params"],
            upstream=[],
            external_inputs={"datasets": {}},
            target_column=None,
            task_type="auto",
        )
        target_key = full_cache_key(
            static_key=target_static,
            resolved_params={},
            upstream=[{"node_id": source["id"], "digest": source_digest, "source_handle": None, "target_handle": None}],
            external_inputs={"datasets": {}},
            target_column=None,
            task_type="auto",
        )
        records = [
            {
                "node_id": source["id"],
                "node_type": source_policy["node_type"],
                "node_version": source_policy["node_version"],
                "static_fingerprint": source_static,
                "cache_key": source_key,
                "cacheable": True,
                "cache_persistent": True,
                "cache_hit": False,
                "path": str(source_path),
                "output_digest": source_digest,
                "size_bytes": source_path.stat().st_size,
                "parent_nodes": [],
                "status": "succeeded",
            },
            {
                "node_id": target["id"],
                "node_type": target_policy["node_type"],
                "node_version": target_policy["node_version"],
                "static_fingerprint": target_static,
                "cache_key": target_key,
                "cacheable": True,
                "cache_hit": False,
                "path": str(target_path),
                "output_digest": target_digest,
                "size_bytes": target_path.stat().st_size,
                "parent_nodes": [{"node_id": source["id"], "input_name": "input"}],
                "status": "succeeded",
            },
        ]
        stats = persist_run_cache_records(db, run, records)
        db.commit()
        assert stats["writes"] == 2
        assert db.query(NodeCacheEntry).count() == 2
        assert db.query(NodeExecution).count() == 2
        assert db.query(ArtifactLineage).count() == 1
        durable_entry = db.query(NodeCacheEntry).filter(NodeCacheEntry.cache_key == source_key).one()
        durable_artifact = db.get(Artifact, durable_entry.artifact_id)
        assert durable_entry.pinned is True
        assert durable_entry.expires_at is None
        assert durable_artifact is not None and durable_artifact.pinned is True
        assert durable_artifact.expires_at is None

        run.selected_node_id = source["id"]
        manifest = prepare_cache_manifest(db, run, tmp_path / "manifest")
        assert manifest["enabled"] is True
        assert manifest["force_node_ids"] == [source["id"]]
        assert source_key in manifest["entries"]
        assert target_key in manifest["entries"]
        assert Path(manifest["entries"][source_key]["path"]).is_file()

        refreshed_path = tmp_path / "source-refreshed.joblib"
        joblib.dump({"value": 9}, refreshed_path)
        refreshed_digest = _sha256_file(refreshed_path)
        old_artifact_id = durable_entry.artifact_id
        refresh_record = {
            **records[0],
            "path": str(refreshed_path),
            "output_digest": refreshed_digest,
            "size_bytes": refreshed_path.stat().st_size,
            "cache_refresh": True,
        }
        refresh_stats = persist_run_cache_records(db, run, [refresh_record])
        db.commit()
        db.refresh(durable_entry)
        assert refresh_stats["writes"] == 1
        assert durable_entry.artifact_id != old_artifact_id
        assert durable_entry.output_digest == refreshed_digest
        assert db.get(Artifact, old_artifact_id) is not None
        replacement = db.get(Artifact, durable_entry.artifact_id)
        assert replacement is not None and replacement.pinned is True
