from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class AppError(Exception):
    code: str
    message: str
    status_code: int = 400
    details: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        super().__init__(self.message)


class NotFoundError(AppError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code=code, message=message, status_code=404, details=details or {})


class ConflictError(AppError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code=code, message=message, status_code=409, details=details or {})


class ValidationAppError(AppError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None, status_code: int = 400) -> None:
        super().__init__(code=code, message=message, status_code=status_code, details=details or {})


class PermissionDeniedError(AppError):
    def __init__(self, message: str = "You do not have permission to perform this action.", details: dict[str, Any] | None = None) -> None:
        super().__init__(code="PERMISSION_DENIED", message=message, status_code=403, details=details or {})


class StorageUnavailableError(AppError):
    def __init__(self, message: str = "Artifact storage is unavailable.", details: dict[str, Any] | None = None) -> None:
        super().__init__(code="STORAGE_UNAVAILABLE", message=message, status_code=503, details=details or {})


class QuotaExceededError(AppError):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code="STORAGE_QUOTA_EXCEEDED", message=message, status_code=413, details=details or {})
