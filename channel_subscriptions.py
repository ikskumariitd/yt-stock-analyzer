import os
import csv
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

CHANNELS_FILE = Path("channels.json")


def load_configured_channels() -> List[Dict[str, str]]:
    """Load saved channels from channels.json."""
    if CHANNELS_FILE.exists():
        try:
            return json.loads(CHANNELS_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def save_configured_channels(channels: List[Dict[str, str]]):
    """Save channel list to channels.json."""
    CHANNELS_FILE.write_text(json.dumps(channels, indent=2, ensure_ascii=False), encoding="utf-8")


def add_channel(name_or_url: str, handle: Optional[str] = None):
    """Add a channel to monitored list."""
    channels = load_configured_channels()
    # Check if already exists
    for ch in channels:
        if ch.get("url") == name_or_url or ch.get("handle") == name_or_url:
            return False, f"Channel '{name_or_url}' already in list."
            
    channels.append({
        "name": handle or name_or_url,
        "url": name_or_url,
        "handle": handle or name_or_url,
        "enabled": True
    })
    save_configured_channels(channels)
    return True, f"Added channel: {name_or_url}"


def import_from_google_takeout_csv(csv_path: str) -> List[Dict[str, str]]:
    """
    Import subscribed channels from Google Takeout YouTube subscriptions CSV:
    Takeout file columns typically: 'Channel Id', 'Channel Url', 'Channel Title'
    """
    imported = []
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {csv_path}")

    with open(path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            channel_id = row.get("Channel Id") or row.get("Channel ID") or ""
            channel_url = row.get("Channel Url") or row.get("Channel URL") or ""
            channel_title = row.get("Channel Title") or row.get("Title") or ""
            
            if channel_id or channel_url:
                imported.append({
                    "name": channel_title or channel_id,
                    "channel_id": channel_id,
                    "url": channel_url or f"https://www.youtube.com/channel/{channel_id}",
                    "handle": channel_title,
                    "enabled": True
                })

    # Merge with existing
    existing = load_configured_channels()
    existing_urls = {c.get("url") for c in existing}
    added_count = 0

    for ch in imported:
        if ch.get("url") not in existing_urls:
            existing.append(ch)
            existing_urls.add(ch.get("url"))
            added_count += 1

    save_configured_channels(existing)
    return existing


def import_from_text_file(txt_path: str) -> List[Dict[str, str]]:
    """Import channels from a simple text file (one channel URL or @handle per line)."""
    path = Path(txt_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {txt_path}")

    existing = load_configured_channels()
    existing_urls = {c.get("url") for c in existing}
    
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and line not in existing_urls:
                existing.append({
                    "name": line,
                    "url": line,
                    "handle": line,
                    "enabled": True
                })
                existing_urls.add(line)

    save_configured_channels(existing)
    return existing
