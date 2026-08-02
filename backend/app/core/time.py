"""UTC time helpers shared by ORM and services."""
from __future__ import annotations
from datetime import datetime, timezone

def utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

def utcnow() -> datetime:
    return datetime.now(timezone.utc)
