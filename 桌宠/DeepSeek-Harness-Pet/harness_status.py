"""Read local DeepSeek Harness task status without requiring Node.js at runtime."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import zstandard as zstd


SESSIONS_ROOT = Path.home() / ".dsh" / "sessions"
VALID_TODO_STATES = {"pending", "in_progress", "completed"}


def _empty_status(state: str = "offline", message: str | None = None) -> dict[str, Any]:
    value: dict[str, Any] = {
        "state": state,
        "active": False,
        "percent": None,
        "completed": 0,
        "total": 0,
        "inProgress": 0,
        "currentTask": None,
        "todos": [],
    }
    if message:
        value["message"] = message
    return value


def _normalized_path(value: str) -> str:
    return os.path.normcase(os.path.normpath(value)).rstrip("\\/")


def _inside_workspace(cwd: object, workspace: str | None) -> bool:
    if workspace is None:
        return True
    if not isinstance(cwd, str) or not cwd:
        return False
    root = _normalized_path(workspace)
    candidate = _normalized_path(cwd)
    return candidate == root or candidate.startswith(f"{root}{os.sep}")


def _read_records(log_path: Path) -> list[dict[str, Any]]:
    decompressor = zstd.ZstdDecompressor()
    with log_path.open("rb") as source:
        with decompressor.stream_reader(source, read_across_frames=True) as reader:
            text = reader.read().decode("utf-8", errors="replace")
    records: list[dict[str, Any]] = []
    for line in text.splitlines():
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict):
            records.append(record)
    return records


def _safe_todos(value: object) -> list[dict[str, str]] | None:
    if not isinstance(value, list):
        return None
    todos: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            return None
        content = item.get("content")
        status = item.get("status")
        if not isinstance(content, str) or status not in VALID_TODO_STATES:
            return None
        todos.append({"content": content, "status": status})
    return todos


def _project_status(events: list[dict[str, Any]]) -> dict[str, Any]:
    todos: list[dict[str, str]] | None = None
    active = False
    for event in events:
        event_type = event.get("type")
        if event_type == "turn/start":
            todos = None
            active = True
        elif event_type == "turn/end":
            active = False
        elif event_type == "todo/write":
            data = event.get("data")
            todos = _safe_todos(data.get("todos") if isinstance(data, dict) else None)
    if todos is None:
        return _empty_status("working_without_todos" if active else "idle") | {"active": active}

    completed = sum(todo["status"] == "completed" for todo in todos)
    in_progress = sum(todo["status"] == "in_progress" for todo in todos)
    current = next((todo for todo in todos if todo["status"] == "in_progress"), None)
    current = current or next((todo for todo in todos if todo["status"] == "pending"), None)
    current = current or (todos[-1] if todos else None)
    total = len(todos)
    return {
        "state": "completed" if total and completed == total else ("working" if in_progress or active else "idle"),
        "active": active,
        "percent": round(completed / total * 100) if total else None,
        "completed": completed,
        "total": total,
        "inProgress": in_progress,
        "currentTask": current["content"] if current else None,
        "todos": todos,
    }


def _find_newest_session(workspace: str | None) -> dict[str, Any] | None:
    if not SESSIONS_ROOT.is_dir():
        return None
    candidates: list[dict[str, Any]] = []
    for project_dir in SESSIONS_ROOT.iterdir():
        if not project_dir.is_dir():
            continue
        for session_dir in project_dir.iterdir():
            log_path = session_dir / "session.jsonl.zstd"
            if not session_dir.is_dir() or not log_path.is_file():
                continue
            try:
                records = _read_records(log_path)
                header = next((record for record in records if record.get("type") == "session"), None)
                if not _inside_workspace(header.get("cwd") if isinstance(header, dict) else None, workspace):
                    continue
                events = [record for record in records if record.get("type") != "session"]
                candidates.append({
                    "status": _project_status(events),
                    "sessionId": header.get("id") if isinstance(header, dict) else None,
                    "cwd": header.get("cwd") if isinstance(header, dict) else None,
                    "updatedAt": log_path.stat().st_mtime,
                })
            except (OSError, zstd.ZstdError):
                # A session can be appended while it is being read; skip that one
                # and use the next most recent valid session.
                continue
    if not candidates:
        return None
    return max(candidates, key=lambda item: item["updatedAt"])


def read_status() -> dict[str, Any]:
    """Return the newest local Harness status.

    Set DEEPSEEK_HARNESS_WORKSPACE to limit the search to one project root.
    Without it, the newest session across the current user's Harness workspaces
    is used, which makes the packaged desktop program location-independent.
    """

    workspace = os.environ.get("DEEPSEEK_HARNESS_WORKSPACE") or None
    session = _find_newest_session(workspace)
    if session is None:
        return _empty_status("offline", "未找到 DeepSeek Harness 会话")
    return session["status"] | {
        "sessionId": session["sessionId"],
        "cwd": session["cwd"],
        "updatedAt": session["updatedAt"],
    }
