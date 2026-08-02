"""Small dependency-free Prometheus metrics registry."""

from __future__ import annotations

from collections import Counter
from threading import Lock

_lock = Lock()
_requests: Counter[tuple[str, str, int]] = Counter()
_errors: Counter[str] = Counter()
_duration_ms: Counter[tuple[str, str]] = Counter()


def record_request(method: str, path: str, status_code: int, duration_ms: int) -> None:
    normalized_path = path if len(path) <= 200 else path[:200]
    with _lock:
        _requests[(method, normalized_path, status_code)] += 1
        _duration_ms[(method, normalized_path)] += max(0, duration_ms)
        if status_code >= 400:
            _errors[str(status_code)] += 1


def render_prometheus() -> str:
    lines = [
        '# HELP iota_api_requests_total Total API requests.',
        '# TYPE iota_api_requests_total counter',
    ]
    with _lock:
        for (method, path, status), value in sorted(_requests.items()):
            lines.append(f'iota_api_requests_total{{method="{method}",path="{path}",status="{status}"}} {value}')
        lines += ['# HELP iota_api_request_duration_ms_total Cumulative API request duration.', '# TYPE iota_api_request_duration_ms_total counter']
        for (method, path), value in sorted(_duration_ms.items()):
            lines.append(f'iota_api_request_duration_ms_total{{method="{method}",path="{path}"}} {value}')
        lines += ['# HELP iota_api_errors_total Total API errors.', '# TYPE iota_api_errors_total counter']
        for status, value in sorted(_errors.items()):
            lines.append(f'iota_api_errors_total{{status="{status}"}} {value}')
    return '\n'.join(lines) + '\n'
