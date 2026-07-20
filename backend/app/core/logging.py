import logging
import sys

_configured = False

# Fingerprints of noisy third-party log messages we want to suppress.
_SUPPRESS_FRAGMENTS: tuple[str, ...] = (
    "Failed to send telemetry event",
    "Anonymized telemetry",
)


class _TelemetryFilter(logging.Filter):
    """Drop known ChromaDB telemetry noise from the log stream."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        msg = record.getMessage()
        return not any(frag in msg for frag in _SUPPRESS_FRAGMENTS)


def setup_logging(level: int = logging.INFO) -> None:
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s")
    )
    handler.addFilter(_TelemetryFilter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    setup_logging()
    return logging.getLogger(name)
