"""
Warden — Collector (The Agent)
Extracts system metrics via psutil and returns a structured JSON payload.

Metrics captured:
  - CPU: total %, per-core %
  - RAM: total, used, free, percent, swap
  - Disk: total, used, free, percent, I/O
  - Network: bytes sent/recv, Mbps up/down
"""

import heapq
import json
import logging
import os
import subprocess
import time
import platform
import socket
from datetime import datetime, timezone
from pathlib import Path

import psutil

from src.settings import settings


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_prev_net = psutil.net_io_counters()
_prev_disk_io = psutil.disk_io_counters()
_prev_ts = time.monotonic()
_boot_ts = psutil.boot_time()
_disk_top_cache: dict | None = None
_disk_top_cache_ts: float = 0.0
_proc_cpu_prev: dict[int, tuple[float, float]] = {}
_host_static = {
    "hostname": socket.gethostname(),
    "fqdn": socket.getfqdn(),
    "os": platform.system(),
    "os_release": platform.release(),
    "platform": platform.platform(),
}
logger = logging.getLogger("warden.collector")


def _normalize_exclude_prefixes(prefixes: list[str] | None) -> list[str]:
    values = prefixes or []
    normalized: list[str] = []
    for item in values:
        try:
            p = str(Path(item)).rstrip("/")
        except Exception:
            continue
        if p:
            normalized.append(p)
    return normalized


def _is_excluded_path(path: str, excludes: list[str]) -> bool:
    if path == "/":
        return False
    for prefix in excludes:
        if not prefix:
            continue
        if path == prefix or path.startswith(prefix + "/"):
            return True
    return False


def _scan_disk_top_consumers_local() -> dict:
    root_path = settings.disk_top_root or "/"
    max_items = max(1, int(settings.disk_top_max_items))
    timeout_seconds = max(1, int(settings.disk_top_timeout_seconds))
    excludes = _normalize_exclude_prefixes(settings.disk_top_exclude_prefixes)
    started = time.monotonic()
    deadline = started + timeout_seconds
    top_heap: list[tuple[int, str]] = []
    dir_totals: dict[str, int] = {}
    scanned_files = 0
    skipped_errors = 0
    truncated = False

    try:
        for dirpath, dirnames, filenames in os.walk(root_path, topdown=True, onerror=lambda _: None, followlinks=False):
            norm_dir = os.path.normpath(dirpath)
            if _is_excluded_path(norm_dir, excludes):
                dirnames[:] = []
                continue

            # prune children before walking them
            kept_dirs = []
            for child in dirnames:
                child_path = os.path.normpath(os.path.join(norm_dir, child))
                if not _is_excluded_path(child_path, excludes):
                    kept_dirs.append(child)
            dirnames[:] = kept_dirs

            if time.monotonic() >= deadline:
                truncated = True
                break

            for name in filenames:
                if time.monotonic() >= deadline:
                    truncated = True
                    break
                path = os.path.join(norm_dir, name)
                try:
                    st = os.stat(path, follow_symlinks=False)
                except (FileNotFoundError, PermissionError, OSError):
                    skipped_errors += 1
                    continue
                if not os.path.isfile(path):
                    continue
                size = int(getattr(st, "st_size", 0) or 0)
                scanned_files += 1
                cur_dir = norm_dir
                while True:
                    dir_totals[cur_dir] = dir_totals.get(cur_dir, 0) + size
                    if cur_dir == "/" or cur_dir == root_path or cur_dir == os.path.normpath(root_path):
                        break
                    parent = os.path.dirname(cur_dir) or "/"
                    if parent == cur_dir:
                        break
                    cur_dir = parent
                if len(top_heap) < max_items:
                    heapq.heappush(top_heap, (size, path))
                elif size > top_heap[0][0]:
                    heapq.heapreplace(top_heap, (size, path))
            if truncated:
                break
    except Exception as exc:
        logger.warning("Disk top scan failed: %s", exc, exc_info=True)
        return {
            "root_path": root_path,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": int((time.monotonic() - started) * 1000),
            "truncated": True,
            "max_items": max_items,
            "source": "local_scan",
            "visibility_scope": "user_limited",
            "warning": "local scan failed",
            "items": [],
            "error": str(exc),
        }

    items = [
        {
            "path": path,
            "dir": os.path.dirname(path) or "/",
            "size_bytes": int(size),
        }
        for size, path in sorted(top_heap, key=lambda x: x[0], reverse=True)
    ]
    folders = [
        {
            "path": folder,
            "dir": os.path.dirname(folder) or "/",
            "size_bytes": int(size),
        }
        for folder, size in heapq.nlargest(max_items, dir_totals.items(), key=lambda kv: kv[1])
    ]
    duration_ms = int((time.monotonic() - started) * 1000)
    logger.debug(
        "Disk top scan complete root=%s files=%d items=%d truncated=%s errors=%d duration_ms=%d",
        root_path, scanned_files, len(items), truncated, skipped_errors, duration_ms
    )
    return {
        "root_path": root_path,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "duration_ms": duration_ms,
        "truncated": truncated,
        "max_items": max_items,
        "source": "local_scan",
        "visibility_scope": "user_limited",
        "warning": None,
        "items": items,
        "files": items,
        "folders": folders,
        "scanned_files": scanned_files,
        "skipped_errors": skipped_errors,
    }


def _scan_disk_top_consumers_via_sudo_helper() -> dict:
    helper_cmd = (settings.disk_top_sudo_helper_cmd or "/usr/local/sbin/warden-disk-top-helper").strip()
    timeout_seconds = max(2, int(settings.disk_top_sudo_timeout_seconds))
    started = time.monotonic()

    if not helper_cmd:
        raise RuntimeError("DISK_TOP_SUDO_HELPER_CMD is empty")

    cmd = ["sudo", "-n", helper_cmd]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
    )

    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    if proc.returncode != 0:
        raise RuntimeError(f"sudo helper rc={proc.returncode}: {stderr or stdout or 'no output'}")
    if not stdout:
        raise RuntimeError("sudo helper returned empty stdout")

    try:
        payload = json.loads(stdout)
    except Exception as exc:
        raise RuntimeError(f"sudo helper returned invalid JSON: {exc}") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("sudo helper payload is not an object")

    payload.setdefault("root_path", settings.disk_top_root or "/")
    payload.setdefault("generated_at", datetime.now(timezone.utc).isoformat())
    payload.setdefault("duration_ms", int((time.monotonic() - started) * 1000))
    payload.setdefault("truncated", False)
    payload.setdefault("max_items", max(1, int(settings.disk_top_max_items)))
    payload.setdefault("items", [])
    payload.setdefault("files", payload.get("items", []))
    payload.setdefault("folders", [])
    payload["source"] = "sudo_helper"
    payload["visibility_scope"] = "system"
    payload.setdefault("warning", None)
    if not payload.get("folders"):
        helper_warning = "helper may be outdated (no folder totals)" if payload.get("files") else None
        if helper_warning:
            payload["warning"] = f"{payload['warning']} | {helper_warning}" if payload.get("warning") else helper_warning
    return payload


def _scan_disk_top_consumers_with_mode() -> dict:
    mode = (settings.disk_top_scan_mode or "local").strip().lower()
    if mode not in {"local", "sudo_helper", "auto"}:
        logger.warning("Invalid DISK_TOP_SCAN_MODE=%s; using local", mode)
        mode = "local"

    if mode == "local":
        return _scan_disk_top_consumers_local()

    try:
        payload = _scan_disk_top_consumers_via_sudo_helper()
        logger.debug(
            "Disk top helper ok source=%s scope=%s truncated=%s duration_ms=%s",
            payload.get("source"),
            payload.get("visibility_scope"),
            payload.get("truncated"),
            payload.get("duration_ms"),
        )
        return payload
    except Exception as exc:
        logger.warning("Disk top helper failed, falling back to local scan: %s", exc)
        local_payload = _scan_disk_top_consumers_local()
        local_payload["warning"] = "root helper unavailable; using local scan"
        local_payload["visibility_scope"] = "user_limited"
        local_payload["source"] = "local_scan"
        local_payload["helper_error"] = str(exc)
        return local_payload


def _get_disk_top_consumers() -> dict:
    global _disk_top_cache, _disk_top_cache_ts
    if not settings.disk_top_enabled:
        return {
            "root_path": settings.disk_top_root or "/",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": 0,
            "truncated": False,
            "max_items": max(1, int(settings.disk_top_max_items)),
            "source": "local_scan",
            "visibility_scope": "user_limited",
            "warning": "disabled",
            "items": [],
            "disabled": True,
        }

    now = time.monotonic()
    ttl = max(1, int(settings.disk_top_scan_interval_seconds))
    if _disk_top_cache and (now - _disk_top_cache_ts) < ttl:
        return _disk_top_cache

    _disk_top_cache = _scan_disk_top_consumers_with_mode()
    _disk_top_cache_ts = now
    return _disk_top_cache


def _safe_proc_name(proc: psutil.Process) -> str:
    try:
        return proc.name() or f"pid-{proc.pid}"
    except Exception:
        return f"pid-{proc.pid}"


def _collect_top_processes() -> dict:
    global _proc_cpu_prev
    now = time.monotonic()
    cpu_count = max(1, psutil.cpu_count(logical=True) or 1)
    cpu_rows: list[dict] = []
    mem_rows: list[dict] = []
    net_rows: list[dict] = []
    proc_meta: dict[int, dict] = {}

    current_cpu_state: dict[int, tuple[float, float]] = {}
    for proc in psutil.process_iter(attrs=["pid"]):
        try:
            pid = proc.pid
            name = _safe_proc_name(proc)
            create_time = float(proc.create_time())
            cput = proc.cpu_times()
            total_cpu = float(getattr(cput, "user", 0.0) + getattr(cput, "system", 0.0))
            rss = int(proc.memory_info().rss)
            current_cpu_state[pid] = (create_time, total_cpu)

            cpu_pct = 0.0
            prev = _proc_cpu_prev.get(pid)
            if prev and abs(prev[0] - create_time) < 1e-6:
                delta_proc = max(0.0, total_cpu - prev[1])
                delta_wall = max(0.001, now - _prev_ts if _prev_ts else 0.001)
                cpu_pct = (delta_proc / delta_wall) * 100.0

            row_base = {"pid": pid, "name": name}
            cpu_rows.append({**row_base, "cpu_percent": round(cpu_pct, 1)})
            mem_rows.append({**row_base, "rss_bytes": rss})
            proc_meta[pid] = row_base
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
        except Exception:
            continue

    _proc_cpu_prev = current_cpu_state

    net_warning = None
    try:
        conn_counts: dict[int, dict[str, int]] = {}
        for c in psutil.net_connections(kind="inet"):
            pid = getattr(c, "pid", None)
            if pid is None:
                continue
            slot = conn_counts.setdefault(pid, {"connections": 0, "established": 0, "listen": 0})
            slot["connections"] += 1
            status = str(getattr(c, "status", "") or "")
            if status == "ESTABLISHED":
                slot["established"] += 1
            elif status == "LISTEN":
                slot["listen"] += 1
        for pid, counts in conn_counts.items():
            if pid not in proc_meta:
                continue
            if counts["connections"] <= 0:
                continue
            net_rows.append({
                **proc_meta[pid],
                "connections": int(counts["connections"]),
                "established": int(counts["established"]),
                "listen": int(counts["listen"]),
            })
    except Exception as exc:
        net_warning = f"network_processes_unavailable: {exc}"

    cpu_top = sorted([r for r in cpu_rows if r["cpu_percent"] > 0], key=lambda r: r["cpu_percent"], reverse=True)[:10]
    mem_top = sorted(mem_rows, key=lambda r: r["rss_bytes"], reverse=True)[:10]
    net_top = sorted(net_rows, key=lambda r: (r["connections"], r["established"]), reverse=True)[:10]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "top_cpu": cpu_top,
        "top_memory": mem_top,
        "top_network": net_top,
        "network_metric": "inet_connections",
        "network_metric_label": "ligações de rede (não largura de banda)",
        "warning": net_warning,
    }


def _bytes_to_mb(b: int) -> float:
    return round(b / (1024 * 1024), 2)


def _bytes_to_gb(b: int) -> float:
    return round(b / (1024 ** 3), 2)


def _mbps(delta_bytes: float, delta_seconds: float) -> float:
    if delta_seconds <= 0:
        return 0.0
    return round((delta_bytes * 8) / (1024 * 1024 * delta_seconds), 3)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def collect() -> dict:
    """
    Capture a full snapshot of system resources.
    Returns a dict ready to be serialised as JSON.
    """
    global _prev_net, _prev_disk_io, _prev_ts

    now_ts = time.monotonic()
    elapsed = now_ts - _prev_ts if _prev_ts else 1.0

    # ---- CPU ----
    cpu_total = psutil.cpu_percent(interval=0)
    cpu_per_core = psutil.cpu_percent(interval=0, percpu=True)
    cpu_freq = psutil.cpu_freq()
    load_avg = None
    try:
        load_avg = [round(x, 2) for x in psutil.getloadavg()]
    except (AttributeError, OSError):
        pass  # Windows doesn't support getloadavg

    # ---- RAM ----
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    # ---- Disk ----
    disk = psutil.disk_usage("/")
    disk_io = psutil.disk_io_counters()
    disk_read_rate = 0.0
    disk_write_rate = 0.0
    if disk_io and _prev_disk_io:
        disk_read_rate = _bytes_to_mb(disk_io.read_bytes - _prev_disk_io.read_bytes) / max(elapsed, 0.01)
        disk_write_rate = _bytes_to_mb(disk_io.write_bytes - _prev_disk_io.write_bytes) / max(elapsed, 0.01)
    disk_top = _get_disk_top_consumers()

    # ---- Network ----
    net = psutil.net_io_counters()
    net_up_mbps = _mbps(net.bytes_sent - _prev_net.bytes_sent, elapsed)
    net_down_mbps = _mbps(net.bytes_recv - _prev_net.bytes_recv, elapsed)

    process_tops = _collect_top_processes()

    # Update previous values
    _prev_net = net
    _prev_disk_io = disk_io
    _prev_ts = now_ts

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "host": {
            **_host_static,
            "system_uptime_seconds": max(0, int(time.time() - _boot_ts)),
        },
        "cpu": {
            "total_percent": cpu_total,
            "per_core": cpu_per_core,
            "cores": psutil.cpu_count(logical=True),
            "freq_mhz": round(cpu_freq.current, 1) if cpu_freq else None,
            "load_avg": load_avg,
        },
        "memory": {
            "total_gb": _bytes_to_gb(mem.total),
            "used_gb": _bytes_to_gb(mem.used),
            "free_gb": _bytes_to_gb(mem.available),
            "percent": mem.percent,
            "swap_total_gb": _bytes_to_gb(swap.total),
            "swap_used_gb": _bytes_to_gb(swap.used),
            "swap_percent": swap.percent,
        },
        "disk": {
            "total_gb": _bytes_to_gb(disk.total),
            "used_gb": _bytes_to_gb(disk.used),
            "free_gb": _bytes_to_gb(disk.free),
            "percent": disk.percent,
            "read_mb_s": round(disk_read_rate, 2),
            "write_mb_s": round(disk_write_rate, 2),
            "top_consumers": disk_top,
        },
        "network": {
            "upload_mbps": net_up_mbps,
            "download_mbps": net_down_mbps,
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv,
            "packets_sent": net.packets_sent,
            "packets_recv": net.packets_recv,
        },
        "processes": process_tops,
    }
