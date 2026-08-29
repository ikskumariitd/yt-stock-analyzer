import os
import re
import json
import time
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import yt_dlp

logger = logging.getLogger("instagram_extractor")

CACHE_DIR = Path("cache/instagram")
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def is_instagram_url(target: str) -> bool:
    """Checks if target is an Instagram Reel, Post, or Profile URL."""
    target_lower = target.strip().lower()
    return "instagram.com" in target_lower or "instagr.am" in target_lower


def normalize_instagram_url(target: str) -> str:
    """Cleans and standardizes an Instagram Reel or Post URL."""
    target = target.strip()
    if not target.startswith("http"):
        if target.startswith("@"):
            return f"https://www.instagram.com/{target[1:]}/"
        return f"https://www.instagram.com/{target}/"
    
    # Remove tracking query parameters (?utm_source=..., etc.)
    clean_url = target.split("?")[0].rstrip("/") + "/"
    return clean_url


def extract_instagram_post_metadata_and_audio(url: str) -> Dict[str, Any]:
    """
    Downloads audio & metadata from an Instagram Reel / Post using yt-dlp.
    Returns metadata and local audio filepath for Gemini Multimodal Audio analysis.
    """
    clean_url = normalize_instagram_url(url)
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': str(CACHE_DIR / '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'noplaylist': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '128',
        }] if False else []  # Keep raw m4a/mp3 for zero transcoding overhead
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=True)
            if not info:
                return {
                    "success": False,
                    "error": "Could not extract Instagram media info."
                }

            post_id = info.get("id") or clean_url.split("/")[-2]
            uploader = info.get("uploader") or info.get("channel") or info.get("uploader_id") or "Instagram Creator"
            description = info.get("description") or info.get("title") or ""
            title = description[:100].strip() if description else f"Instagram Reel by @{uploader}"
            
            # Find the downloaded file in CACHE_DIR
            downloaded_files = list(CACHE_DIR.glob(f"{post_id}.*"))
            media_path = str(downloaded_files[0]) if downloaded_files else None

            # Format upload date (YYYYMMDD -> YYYY-MM-DD)
            upload_date = info.get("upload_date")
            formatted_date = ""
            if upload_date and len(upload_date) == 8:
                formatted_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"

            return {
                "success": True,
                "platform": "instagram",
                "video_id": f"ig_{post_id}",
                "post_id": post_id,
                "author": f"@{uploader.lstrip('@')}",
                "title": title,
                "caption": description,
                "duration": info.get("duration"),
                "published_at": formatted_date,
                "media_path": media_path,
                "url": clean_url
            }

    except Exception as e:
        logger.error(f"Error extracting Instagram Reel '{url}': {e}")
        return {
            "success": False,
            "error": str(e),
            "platform": "instagram"
        }


def get_creator_recent_reels(handle_or_url: str, limit: int = 3) -> List[Dict[str, Any]]:
    """
    Fetches the latest public reels/posts from an Instagram creator handle.
    """
    clean_url = normalize_instagram_url(handle_or_url)
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'playlist_items': f'1-{limit}'
    }

    results = []
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=False)
            entries = info.get("entries", []) if info else []
            for entry in entries[:limit]:
                if entry:
                    entry_id = entry.get("id")
                    results.append({
                        "video_id": f"ig_{entry_id}",
                        "post_id": entry_id,
                        "url": entry.get("url") or f"https://www.instagram.com/reel/{entry_id}/",
                        "title": entry.get("title") or f"Reel {entry_id}",
                        "author": info.get("uploader") or clean_url.split("/")[-2]
                    })
    except Exception as e:
        logger.error(f"Error fetching creator reels for '{handle_or_url}': {e}")

    return results
