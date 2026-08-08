from __future__ import annotations

import json
from pathlib import Path

APP_DIR = Path.home() / ".doceditor"
SETTINGS_PATH = APP_DIR / "settings.json"
DEFAULT_SETTINGS = {"recent_folders": [], "pinned_folders": []}
MAX_RECENT = 10


def load_settings() -> dict:
    if not SETTINGS_PATH.exists():
        return DEFAULT_SETTINGS.copy()
    data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    return {**DEFAULT_SETTINGS, **data}


def save_settings(settings: dict) -> dict:
    APP_DIR.mkdir(parents=True, exist_ok=True)
    normalized = {
        "recent_folders": list(dict.fromkeys(settings.get("recent_folders", [])))[:MAX_RECENT],
        "pinned_folders": list(dict.fromkeys(settings.get("pinned_folders", []))),
    }
    SETTINGS_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    return normalized


def remember_folder(settings: dict, folder: str | Path) -> dict:
    folder_text = str(Path(folder).expanduser())
    recent = [folder_text] + [x for x in settings.get("recent_folders", []) if x != folder_text]
    settings["recent_folders"] = recent[:MAX_RECENT]
    return save_settings(settings)
