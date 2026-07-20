"""Password generation & policy validation."""
from __future__ import annotations

import re
import secrets
import string

_UPPER = string.ascii_uppercase
_LOWER = string.ascii_lowercase
_DIGITS = string.digits
_SPECIALS = "!@#$%^&*()-_=+[]{};:,.?/"

MIN_LENGTH = 8


def generate_strong_password(length: int = 12) -> str:
    """Generate a cryptographically-strong password with mixed classes."""
    if length < MIN_LENGTH:
        length = MIN_LENGTH
    rng = secrets.SystemRandom()
    # Guarantee one of each class
    chars = [
        rng.choice(_UPPER),
        rng.choice(_LOWER),
        rng.choice(_DIGITS),
        rng.choice(_SPECIALS),
    ]
    alphabet = _UPPER + _LOWER + _DIGITS + _SPECIALS
    chars += [rng.choice(alphabet) for _ in range(length - len(chars))]
    rng.shuffle(chars)
    return "".join(chars)


class PasswordPolicyError(ValueError):
    """Raised when a password fails the policy."""


def validate_password(password: str) -> None:
    if not password or len(password) < MIN_LENGTH:
        raise PasswordPolicyError("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        raise PasswordPolicyError("Password must contain an uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise PasswordPolicyError("Password must contain a lowercase letter.")
    if not re.search(r"\d", password):
        raise PasswordPolicyError("Password must contain a number.")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise PasswordPolicyError("Password must contain a special character.")
