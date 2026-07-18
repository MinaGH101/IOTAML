from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import joblib

from app.config import get_settings
from app.services.node_cache_keys import full_cache_key, static_fingerprint


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


class RuntimeNodeCache:
    """Child-process cache adapter.

    Cache files are only loaded from the manifest prepared by the trusted parent
    worker. The parent verifies artifact ownership and SHA-256 before exposing a
    path, and this adapter verifies the checksum again before deserializing.
    """

    def __init__(self, manifest: dict[str, Any] | None, output_dir: Path, *, external_inputs: dict[str, Any], target_column: str | None, task_type: str) -> None:
        self.manifest = manifest or {"enabled": False, "entries": {}, "static": {}}
        self.enabled = bool(self.manifest.get("enabled"))
        self.entries: dict[str, dict[str, Any]] = dict(self.manifest.get("entries") or {})
        self.static: dict[str, dict[str, Any]] = dict(self.manifest.get("static") or {})
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.external_inputs = external_inputs
        self.target_column = target_column
        self.task_type = task_type
        self.output_digests: dict[str, str] = {}
        self.output_artifacts: dict[str, int] = {}
        self.records: list[dict[str, Any]] = []

    def _descriptor(self, node: dict[str, Any]) -> dict[str, Any]:
        node_id = str(node.get("id"))
        descriptor = self.static.get(node_id)
        if descriptor:
            return descriptor
        fingerprint, policy = static_fingerprint(node)
        return {"static_fingerprint": fingerprint, **policy}

    def parent_refs(self, node_id: str, edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
        refs: list[dict[str, Any]] = []
        for edge in edges:
            if str(edge.get("target")) != node_id:
                continue
            source = str(edge.get("source"))
            digest = self.output_digests.get(source)
            if not digest:
                continue
            ref = {
                "node_id": source,
                "digest": digest,
                "source_handle": edge.get("sourceHandle"),
                "target_handle": edge.get("targetHandle"),
                "input_name": str(edge.get("targetHandle") or "input"),
            }
            if source in self.output_artifacts:
                ref["artifact_id"] = self.output_artifacts[source]
            refs.append(ref)
        return refs

    def _relevant_external_inputs(self, resolved_params: dict[str, Any], parent_refs: list[dict[str, Any]]) -> dict[str, Any]:
        dataset_ids: set[str] = set()

        def collect(value: Any, key: str | None = None) -> None:
            if isinstance(value, dict):
                for child_key, child in value.items():
                    collect(child, str(child_key))
            elif isinstance(value, list):
                for child in value:
                    collect(child, key)
            elif key and key.endswith("dataset_id"):
                try:
                    dataset_ids.add(str(int(value)))
                except (TypeError, ValueError):
                    return

        collect(resolved_params)
        primary = self.external_inputs.get("primary_dataset_id")
        if not parent_refs and primary is not None:
            try:
                dataset_ids.add(str(int(primary)))
            except (TypeError, ValueError):
                pass
        datasets = self.external_inputs.get("datasets") or {}
        return {
            "datasets": {dataset_id: datasets[dataset_id] for dataset_id in sorted(dataset_ids) if dataset_id in datasets},
        }

    def key_for(self, node: dict[str, Any], resolved_params: dict[str, Any], parent_refs: list[dict[str, Any]]) -> tuple[str, dict[str, Any]]:
        descriptor = self._descriptor(node)
        key = full_cache_key(
            static_key=str(descriptor.get("static_fingerprint") or ""),
            resolved_params=resolved_params,
            upstream=[{
                "node_id": item.get("node_id"),
                "digest": item.get("digest"),
                "source_handle": item.get("source_handle"),
                "target_handle": item.get("target_handle"),
            } for item in parent_refs],
            external_inputs=self._relevant_external_inputs(resolved_params, parent_refs),
            target_column=self.target_column,
            task_type=self.task_type,
        )
        return key, descriptor

    def lookup(self, node: dict[str, Any], resolved_params: dict[str, Any], parent_refs: list[dict[str, Any]]) -> tuple[Any | None, dict[str, Any]]:
        key, descriptor = self.key_for(node, resolved_params, parent_refs)
        meta = {"cache_key": key, **descriptor}
        if not self.enabled or not descriptor.get("cacheable"):
            return None, meta
        entry = self.entries.get(key)
        if not entry:
            return None, meta
        path = Path(str(entry.get("path") or ""))
        expected = str(entry.get("checksum_sha256") or "")
        try:
            if not path.is_file() or not expected or _sha256_file(path) != expected:
                return None, meta
            value = joblib.load(path)
        except Exception:
            return None, meta
        node_id = str(node.get("id"))
        self.output_digests[node_id] = str(entry.get("output_digest") or expected)
        if entry.get("artifact_id"):
            self.output_artifacts[node_id] = int(entry["artifact_id"])
        hit_record = {
            "node_id": node_id,
            "node_type": descriptor.get("node_type"),
            "node_version": descriptor.get("node_version"),
            "static_fingerprint": descriptor.get("static_fingerprint"),
            "cache_key": key,
            "cacheable": True,
            "cache_hit": True,
            "cache_entry_id": entry.get("cache_entry_id"),
            "artifact_id": entry.get("artifact_id"),
            "source_run_id": entry.get("source_run_id"),
            "output_digest": self.output_digests[node_id],
            "size_bytes": entry.get("size_bytes"),
            "parent_nodes": parent_refs,
            "status": "cached",
        }
        self.records.append(hit_record)
        return value, hit_record


    def remember_result(self, node_id: str, result: Any) -> str:
        try:
            digest = str(joblib.hash(result, hash_name="sha1"))
        except Exception:
            digest = hashlib.sha256(repr(result).encode("utf-8", errors="replace")).hexdigest()
        self.output_digests[node_id] = digest
        return digest

    def store(self, node: dict[str, Any], result: Any, resolved_params: dict[str, Any], parent_refs: list[dict[str, Any]], timing: dict[str, Any]) -> dict[str, Any] | None:
        key, descriptor = self.key_for(node, resolved_params, parent_refs)
        node_id = str(node.get("id"))
        if not self.enabled or not descriptor.get("cacheable"):
            self.remember_result(node_id, result)
            return None
        target = self.output_dir / f"{key}.joblib"
        temporary = target.with_suffix(".joblib.tmp")
        try:
            joblib.dump(result, temporary, compress=get_settings().node_cache_compression)
            temporary.replace(target)
            digest = _sha256_file(target)
        except Exception:
            temporary.unlink(missing_ok=True)
            target.unlink(missing_ok=True)
            self.remember_result(node_id, result)
            return None
        self.output_digests[node_id] = digest
        record = {
            "node_id": node_id,
            "node_type": descriptor.get("node_type"),
            "node_version": descriptor.get("node_version"),
            "static_fingerprint": descriptor.get("static_fingerprint"),
            "cache_key": key,
            "cacheable": True,
            "cache_hit": False,
            "path": str(target),
            "output_digest": digest,
            "size_bytes": target.stat().st_size,
            "parent_nodes": parent_refs,
            "status": "succeeded",
            **timing,
        }
        self.records.append(record)
        return record
