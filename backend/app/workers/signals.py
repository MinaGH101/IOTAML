"""Reusable cooperative shutdown state for workers and maintenance processes."""
from __future__ import annotations

import signal
import threading
from collections.abc import Callable


class ShutdownSignal:
    """Thread-safe signal flag installed for SIGTERM and SIGINT."""

    def __init__(self) -> None:
        self._event = threading.Event()
        self._previous: dict[int, Callable | int | None] = {}

    @property
    def requested(self) -> bool:
        return self._event.is_set()

    def request(self, _signum: int | None = None, _frame: object | None = None) -> None:
        self._event.set()

    def install(self) -> "ShutdownSignal":
        for signum in (signal.SIGTERM, signal.SIGINT):
            self._previous[signum] = signal.getsignal(signum)
            signal.signal(signum, self.request)
        return self

    def restore(self) -> None:
        for signum, handler in self._previous.items():
            signal.signal(signum, handler)
        self._previous.clear()
