"""Email service placeholder — SMTP delivery not yet integrated.

Every function here logs the intent and returns. When SMTP is later
implemented, only this module needs to change.
"""
from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


def _configured() -> bool:
    s = get_settings()
    return bool(getattr(s, "smtp_host", "") and getattr(s, "smtp_username", ""))


def send_admin_welcome(*, to_email: str, name: str, temp_password: str) -> bool:
    log.info(
        "[email:placeholder] welcome → %s (name=%s, temp_password=***, configured=%s)",
        to_email,
        name,
        _configured(),
    )
    return False


def send_password_reset(*, to_email: str, reset_token: str) -> bool:
    log.info(
        "[email:placeholder] reset → %s (token=%s, configured=%s)",
        to_email,
        reset_token,
        _configured(),
    )
    return False


def send_password_changed_notice(*, to_email: str) -> bool:
    log.info("[email:placeholder] password-changed → %s", to_email)
    return False
