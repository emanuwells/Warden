"""
Fast snapshot export hook for the collector loop (Pipeline Phase 2).

Loads export_payload lazily to avoid import side-effects at module load time.
"""

from __future__ import annotations

import importlib.util
import logging
from pathlib import Path

from src.settings import BASE_DIR, settings

logger = logging.getLogger("warden")

_export_module = None


def _load_export_module():
    global _export_module
    if _export_module is not None:
        return _export_module

    script = BASE_DIR / "scripts" / "export_payload.py"
    spec = importlib.util.spec_from_file_location("warden_export_payload", script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load export module: {script}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _export_module = module
    return module


def export_fast_snapshot_after_collect() -> bool:
    """
    Refresh the fast JSON snapshot after a successful DB insert.
    Returns True on success; failures are logged and do not raise.
    """
    if not settings.export_fast_on_collect:
        return False

    try:
        module = _load_export_module()
        export_fn = getattr(module, "export", None)
        if not callable(export_fn):
            raise RuntimeError("export_payload.export is not callable")
        export_fn(mode="fast")
        logger.debug("Fast snapshot exported after collect.")
        return True
    except Exception as exc:
        logger.warning("Fast snapshot export failed (collector continues): %s", exc)
        return False
