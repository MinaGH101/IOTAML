from app.workers.maintenance import _LOCK_IDS


def test_maintenance_jobs_have_stable_lock_ids() -> None:
    assert set(_LOCK_IDS) == {"artifacts", "stale-runs", "cache", "logs", "all"}
    assert len(set(_LOCK_IDS.values())) == len(_LOCK_IDS)
