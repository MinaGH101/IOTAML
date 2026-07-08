from __future__ import annotations

def sanitize_filename(name: str) -> str:
    return ''.join(ch for ch in name if ch.isalnum() or ch in ('-', '_', '.', ' ')).strip() or 'artifact'
