from app.domains.auth.service import _password_hash, _verify_password


def test_password_hash_round_trip() -> None:
    encoded = _password_hash("correct horse battery staple")
    assert encoded.startswith("pbkdf2_sha256$")
    assert _verify_password(encoded, "correct horse battery staple")
    assert not _verify_password(encoded, "wrong")
