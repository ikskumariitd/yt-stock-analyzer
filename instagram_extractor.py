import os
import re
import json
import time
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import requests
import yt_dlp
from dotenv import load_dotenv

load_dotenv()

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
    
    clean_url = target.split("?")[0].rstrip("/") + "/"
    return clean_url


def extract_username_from_target(handle_or_url: str) -> str:
    """Extracts raw username without @ or URL slashes."""
    target = handle_or_url.strip().rstrip("/")
    if "instagram.com/" in target:
        parts = target.split("instagram.com/")[-1].split("/")
        return parts[0].replace("@", "")
    return target.lstrip("@").split("/")[0]


def get_creator_recent_reels(handle_or_url: str, limit: int = 3) -> List[Dict[str, Any]]:
    """
    Fetches the latest public reels/posts from an Instagram creator handle.
    Uses RapidAPI if RAPIDAPI_KEY is configured in .env, with yt-dlp fallback.
    """
    username = extract_username_from_target(handle_or_url)
    rapidapi_key = os.getenv("RAPIDAPI_KEY")
    rapidapi_host = os.getenv("RAPIDAPI_HOST", "instagram-scraper-stable-api.p.rapidapi.com")

    # 1. Try RapidAPI Scraper (Most Reliable & Bypasses Login Gates)
    if rapidapi_key:
        try:
            logger.info(f"Querying RapidAPI for Instagram creator @{username}...")
            url = f"https://{rapidapi_host}/get_ig_user_posts.php"
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-rapidapi-host": rapidapi_host,
                "x-rapidapi-key": rapidapi_key
            }
            data = {
                "username_or_url": username,
                "amount": str(max(limit, 5))
            }
            
            resp = requests.post(url, headers=headers, data=data, timeout=25)
            if resp.status_code == 200:
                res_data = resp.json()
                posts = res_data.get("posts", [])
                
                results = []
                for p in posts[:limit]:
                    node = p.get("node", {})
                    code = node.get("code")
                    if not code:
                        continue
                    
                    caption = ""
                    if isinstance(node.get("caption"), dict):
                        caption = node.get("caption", {}).get("text", "")
                    elif isinstance(node.get("caption"), str):
                        caption = node.get("caption", "")

                    taken_at = node.get("taken_at")
                    date_str = ""
                    if taken_at:
                        try:
                            date_str = datetime.fromtimestamp(taken_at).strftime('%Y-%m-%d')
                        except Exception:
                            pass

                    title_preview = caption[:80].replace("\n", " ").strip() if caption else f"Reel {code}"

                    results.append({
                        "video_id": f"ig_{code}",
                        "post_id": code,
                        "url": f"https://www.instagram.com/reel/{code}/",
                        "title": title_preview,
                        "author": f"@{username}",
                        "caption": caption,
                        "published_at": date_str,
                        "platform": "instagram"
                    })
                
                if results:
                    logger.info(f"RapidAPI successfully returned {len(results)} posts for @{username}.")
                    return results
            else:
                logger.warning(f"RapidAPI responded with status {resp.status_code}: {resp.text[:120]}")
        except Exception as api_err:
            logger.error(f"RapidAPI Instagram query error for @{username}: {api_err}")

    # 2. Fallback: yt-dlp local extractor
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
                        "author": f"@{username}",
                        "platform": "instagram"
                    })
    except Exception as e:
        logger.error(f"Error fetching creator reels for '{handle_or_url}': {e}")

    return results


def extract_instagram_post_metadata_and_audio(url: str, preloaded_caption: str = "") -> Dict[str, Any]:
    """
    Extracts metadata and audio/caption for an Instagram Reel.
    """
    clean_url = normalize_instagram_url(url)
    post_id = clean_url.split("/")[-2] if "/reel/" in clean_url or "/p/" in clean_url else "reel"
    
    # Try yt-dlp to download media audio track
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': str(CACHE_DIR / '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'noplaylist': True,
    }

    media_path = None
    description = preloaded_caption or ""
    uploader = "Instagram Creator"
    formatted_date = ""

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_url, download=True)
            if info:
                post_id = info.get("id") or post_id
                uploader = info.get("uploader") or info.get("channel") or info.get("uploader_id") or uploader
                description = info.get("description") or info.get("title") or description
                
                downloaded_files = list(CACHE_DIR.glob(f"{post_id}.*"))
                media_path = str(downloaded_files[0]) if downloaded_files else None

                upload_date = info.get("upload_date")
                if upload_date and len(upload_date) == 8:
                    formatted_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"
    except Exception as yt_err:
        logger.warning(f"yt-dlp download note for '{clean_url}' (using caption metadata): {yt_err}")

    title = description[:100].strip() if description else f"Instagram Reel {post_id}"

    return {
        "success": True,
        "platform": "instagram",
        "video_id": f"ig_{post_id}",
        "post_id": post_id,
        "author": f"@{uploader.lstrip('@')}",
        "title": title,
        "caption": description,
        "published_at": formatted_date,
        "media_path": media_path,
        "url": clean_url
    }
