"""Generate a PBKDF2 password hash for USER_FILE provisioning."""
from __future__ import annotations

import getpass

from app.domains.auth.service import _password_hash


def main() -> None:
    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")
    if not password:
        raise SystemExit("Password must not be empty.")
    if password != confirm:
        raise SystemExit("Passwords do not match.")
    print(_password_hash(password))


if __name__ == "__main__":
    main()
