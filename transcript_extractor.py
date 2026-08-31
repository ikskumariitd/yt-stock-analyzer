import os
import re
import sys
import base64
import tempfile
import urllib.parse
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import http.cookiejar
import requests
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    CouldNotRetrieveTranscript,
)
from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig


def extract_video_id(url_or_id: str) -> Optional[str]:
    """Extract standard 11-character YouTube video ID from various URL formats."""
    url_or_id = url_or_id.strip()
    if len(url_or_id) == 11 and re.match(r"^[A-Za-z0-9_-]{11}$", url_or_id):
        return url_or_id

    patterns = [
        r"(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})",
        r"[?&]v=([A-Za-z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    return None


def sanitize_cookie_file(src_path: str) -> str:
    """
    Creates a sanitized Netscape cookie file containing browser visitor tokens
    (VISITOR_INFO1_LIVE, PREF, YSC, etc.) while stripping account login tokens
    (LOGIN_INFO, SID, HSID, SSID) that trigger YouTube's account-specific SABR streaming blocks.
    """
    if not src_path or not os.path.isfile(src_path):
        return src_path
    
    dest_path = os.path.join(tempfile.gettempdir(), "alphapulse_visitor_cookies.txt")
    try:
        lines = Path(src_path).read_text(encoding="utf-8").splitlines()
        cleaned = []
        for line in lines:
            if line.startswith("#") or not line.strip():
                cleaned.append(line)
            elif not any(k in line for k in ["LOGIN_INFO", "SID\t", "HSID", "SSID", "APISID", "SAPISID"]):
                cleaned.append(line)
        Path(dest_path).write_text("\n".join(cleaned), encoding="utf-8")
        return dest_path
    except Exception as e:
        print(f"[COOKIES] Failed to sanitize cookies: {e}")
        return src_path


def get_youtube_cookies_path(sanitize: bool = True) -> Optional[str]:
    """
    Resolves YouTube cookies file path from environment variables or local directory.
    Supports:
    1. YOUTUBE_COOKIES_FILE (explicit path to cookies.txt)
    2. YOUTUBE_COOKIES_CONTENT (raw Netscape cookies text in env var)
    3. YOUTUBE_COOKIES_BASE64 (base64 encoded Netscape cookies text in env var)
    4. Standard local cookie files: cookies.txt, youtube_cookies.txt, yt_cookies.txt
    """
    raw_path = None
    cookie_file_env = os.getenv("YOUTUBE_COOKIES_FILE")
    if cookie_file_env and os.path.isfile(cookie_file_env):
        raw_path = os.path.abspath(cookie_file_env)

    if not raw_path:
        cookie_content = os.getenv("YOUTUBE_COOKIES_CONTENT")
        if cookie_content and cookie_content.strip():
            temp_cookie = os.path.join(tempfile.gettempdir(), "alphapulse_yt_cookies.txt")
            try:
                Path(temp_cookie).write_text(cookie_content.strip(), encoding="utf-8")
                raw_path = temp_cookie
            except Exception as err:
                print(f"[COOKIES] Failed to write YOUTUBE_COOKIES_CONTENT: {err}")

    if not raw_path:
        cookie_b64 = os.getenv("YOUTUBE_COOKIES_BASE64")
        if cookie_b64 and cookie_b64.strip():
            try:
                decoded = base64.b64decode(cookie_b64.strip()).decode("utf-8")
                temp_cookie = os.path.join(tempfile.gettempdir(), "alphapulse_yt_cookies.txt")
                Path(temp_cookie).write_text(decoded, encoding="utf-8")
                raw_path = temp_cookie
            except Exception as err:
                print(f"[COOKIES] Failed to decode YOUTUBE_COOKIES_BASE64: {err}")

    if not raw_path:
        for candidate in ["cookies.txt", "youtube_cookies.txt", "yt_cookies.txt"]:
            if os.path.isfile(candidate):
                raw_path = os.path.abspath(candidate)
                break

    if raw_path and sanitize:
        return sanitize_cookie_file(raw_path)
    return raw_path


def get_youtube_proxy_config() -> Tuple[Optional[Any], Optional[str]]:
    """
    Resolves proxy configuration for YouTubeTranscriptApi and yt-dlp.
    Returns (YouTubeTranscriptApi ProxyConfig, yt-dlp proxy_url string).
    """
    ws_user = os.getenv("WEBSHARE_PROXY_USERNAME")
    ws_pass = os.getenv("WEBSHARE_PROXY_PASSWORD")
    if ws_user and ws_pass:
        ws_user = ws_user.strip()
        ws_pass = ws_pass.strip()
        ws_user_rot = ws_user if ws_user.endswith("-rotate") else f"{ws_user}-rotate"
        proxy_url = f"http://{ws_user_rot}:{ws_pass}@p.webshare.io:80"
        try:
            return WebshareProxyConfig(proxy_username=ws_user, proxy_password=ws_pass), proxy_url
        except Exception:
            return None, proxy_url

    proxy_url = os.getenv("YOUTUBE_PROXY") or os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
    if proxy_url and proxy_url.strip():
        proxy_url = proxy_url.strip()
        try:
            return GenericProxyConfig(http_url=proxy_url, https_url=proxy_url), proxy_url
        except Exception:
            return None, proxy_url

    return None, None


def get_requests_session_with_cookies() -> requests.Session:
    """Creates a configured requests session with modern browser User-Agent and loaded cookies if available."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    })
    cookie_path = get_youtube_cookies_path(sanitize=True)
    if cookie_path and os.path.isfile(cookie_path):
        try:
            jar = http.cookiejar.MozillaCookieJar(cookie_path)
            jar.load(ignore_discard=True, ignore_expires=True)
            session.cookies = jar
        except Exception as ce:
            print(f"[COOKIES] Could not load cookies from {cookie_path}: {ce}")
    return session


def build_ytdlp_opts(extra_opts: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Builds robust yt-dlp options with sanitized cookies, proxies, and browser headers
    to bypass YouTube IP blocks and SABR streaming locks.
    """
    opts: Dict[str, Any] = {
        'quiet': True,
        'no_warnings': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        'nocheckcertificate': True
    }

    cookie_path = get_youtube_cookies_path(sanitize=True)
    if cookie_path:
        opts['cookiefile'] = cookie_path

    _, proxy_url = get_youtube_proxy_config()
    if proxy_url:
        opts['proxy'] = proxy_url

    if extra_opts:
        opts.update(extra_opts)

    return opts


def fetch_video_metadata_oembed(video_id: str) -> Dict[str, str]:
    """Fetch basic video title and author without needing an API key via public oEmbed."""
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(url)}&format=json"
        resp = requests.get(oembed_url, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "title": data.get("title", f"YouTube Video ({video_id})"),
                "author": data.get("author_name", "Unknown Channel"),
                "author_url": data.get("author_url", ""),
            }
    except Exception:
        pass
    return {"title": f"YouTube Video ({video_id})", "author": "Unknown Channel", "author_url": ""}


def format_seconds(seconds: float) -> str:
    """Format seconds into MM:SS or HH:MM:SS."""
    s = int(seconds)
    hours = s // 3600
    minutes = (s % 3600) // 60
    sec = s % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{sec:02d}"
    return f"{minutes:02d}:{sec:02d}"


def format_duration_readable(seconds: float) -> str:
    """Formats seconds into human-readable duration e.g. '2h 15m' or '45m'."""
    s = int(seconds)
    hours = s // 3600
    minutes = (s % 3600) // 60
    sec = s % 60
    if hours > 0:
        return f"{hours}h {minutes:02d}m"
    if minutes > 0:
        return f"{minutes}m {sec:02d}s"
    return f"{sec}s"


def get_youtube_video_duration(video_id: str) -> Optional[float]:
    """Fast pre-check of YouTube video duration in seconds using hardened yt-dlp metadata."""
    try:
        import yt_dlp
        # 1. Try mobile android client
        try:
            ydl_opts_mobile = {
                'quiet': True,
                'no_warnings': True,
                'skip_download': True,
                'extract_flat': True,
                'extractor_args': {'youtube': {'player_client': ['android']}},
                'nocheckcertificate': True
            }
            with yt_dlp.YoutubeDL(ydl_opts_mobile) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                if info and info.get("duration"):
                    return float(info["duration"])
        except Exception:
            pass

        # 2. Fallback to generic extractor options
        ydl_opts = build_ytdlp_opts({
            'skip_download': True,
            'extract_flat': True,
        })
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            return info.get("duration") if info else None
    except Exception:
        return None


def get_video_transcript(video_id: str, preferred_languages: List[str] = None) -> Dict[str, Any]:
    """
    Fetch transcript using hardened YouTubeTranscriptApi session with cookies & proxy.
    Automatically cascades to yt-dlp multi-client audio download + Gemini Multimodal on any block.
    """
    if preferred_languages is None:
        preferred_languages = ["en", "en-US", "en-GB", "hi", "hi-Latn"]

    metadata = fetch_video_metadata_oembed(video_id)
    session = get_requests_session_with_cookies()
    proxy_config, _ = get_youtube_proxy_config()
    
    try:
        ytt_api = YouTubeTranscriptApi(proxy_config=proxy_config, http_client=session)
        # Fetch list of transcripts
        transcript_list = ytt_api.list(video_id)
        transcript = None
        
        # Try finding preferred language transcript
        try:
            transcript = transcript_list.find_transcript(preferred_languages)
        except Exception:
            # Fallback: get first available transcript and translate to English if possible
            try:
                available = list(transcript_list)
                if available:
                    first_tr = available[0]
                    if first_tr.is_translatable:
                        transcript = first_tr.translate('en')
                    else:
                        transcript = first_tr
            except Exception:
                pass

        if not transcript:
            raise CouldNotRetrieveTranscript(video_id)

        raw_snippets = transcript.fetch()
        
        # Process snippets (support both object attributes and dict keys)
        text_lines = []
        timestamped_lines = []
        raw_segments = []

        for snippet in raw_snippets:
            if hasattr(snippet, "text"):
                text = str(snippet.text).strip()
                start = float(getattr(snippet, "start", 0))
                duration = float(getattr(snippet, "duration", 0))
            elif isinstance(snippet, dict):
                text = str(snippet.get("text", "")).strip()
                start = float(snippet.get("start", 0))
                duration = float(snippet.get("duration", 0))
            else:
                continue

            if text:
                start_fmt = format_seconds(start)
                text_lines.append(text)
                timestamped_lines.append(f"[{start_fmt}] {text}")
                raw_segments.append({"text": text, "start": start, "duration": duration, "time_formatted": start_fmt})

        full_text = " ".join(text_lines)
        timestamped_text = "\n".join(timestamped_lines)

        return {
            "success": True,
            "video_id": video_id,
            "title": metadata.get("title"),
            "author": metadata.get("author"),
            "full_text": full_text,
            "timestamped_text": timestamped_text,
            "raw_segments": raw_segments,
        }

    except Exception as e:
        # Auto Fallback to Direct YouTube Audio Extraction with yt-dlp + Gemini Multimodal
        err_msg = str(e)
        print(f"[FALLBACK] YouTubeTranscriptApi unavailable for {video_id} ({err_msg[:70]}...). Attempting Gemini Audio Fallback with yt-dlp...")
        
        audio_info = download_youtube_audio_fallback(video_id)
        if audio_info and audio_info.get("too_long"):
            return {
                "success": False,
                "video_id": video_id,
                "title": audio_info.get("title") or metadata.get("title"),
                "author": audio_info.get("author") or metadata.get("author"),
                "too_long": True,
                "duration_formatted": audio_info.get("duration_formatted", "1h+"),
                "error": f"Video length: {audio_info.get('duration_formatted', '1h+')} (exceeds 1-hour limit)",
            }

        if audio_info and audio_info.get("audio_path"):
            return {
                "success": True,
                "video_id": video_id,
                "title": audio_info.get("title") or metadata.get("title"),
                "author": audio_info.get("author") or metadata.get("author"),
                "audio_fallback": True,
                "audio_path": audio_info["audio_path"],
                "published_at": audio_info.get("published_at"),
                "full_text": "[Direct Audio Processing via Gemini Multimodal]",
                "timestamped_text": "[Direct Audio Processing via Gemini Multimodal]"
            }

        # If audio download also fails, provide informative message
        is_ip_block = any(token in err_msg.lower() for token in ["blocking requests", "429", "bot", "ipblocked", "requestblocked", "potoken"])
        reason = "YouTube IP Block (429 - set YOUTUBE_PROXY or YOUTUBE_COOKIES_CONTENT)" if is_ip_block else err_msg[:120]
        return {
            "success": False,
            "video_id": video_id,
            "title": metadata.get("title"),
            "error": f"Transcript & Audio unavailable: {reason}",
        }


def download_youtube_audio_fallback(video_id: str) -> Optional[Dict[str, Any]]:
    """
    Downloads lightweight audio stream with yt-dlp when YouTube Transcript API is blocked.
    Uses multi-stage fallback:
    1. Sanitized Visitor Cookies (bypasses bot challenges + avoids SABR account blocks)
    2. Android mobile client
    3. Generic authed client with proxy if configured
    """
    try:
        import yt_dlp

        temp_dir = os.path.join(tempfile.gettempdir(), "alphapulse_yt_audio")
        os.makedirs(temp_dir, exist_ok=True)
        audio_path = os.path.join(temp_dir, f"yt_{video_id}.m4a")

        # 1. Primary Strategy: Sanitized Visitor Cookies + modern browser clients
        try:
            ydl_opts_sanitized = build_ytdlp_opts({
                'format': 'bestaudio[ext=m4a]/bestaudio/best',
                'outtmpl': audio_path,
                'noplaylist': True,
                'overwrites': True,
            })
            with yt_dlp.YoutubeDL(ydl_opts_sanitized) as ydl:
                info_pre = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                dur = (info_pre.get("duration") if info_pre else None) or 0
                if dur > 3600:
                    dur_str = format_duration_readable(dur)
                    print(f"⏱️ Video {video_id} is {dur_str} (> 1 hour). Skipping audio download.")
                    return {
                        "too_long": True,
                        "duration_formatted": dur_str,
                        "duration": dur,
                        "title": info_pre.get("title") if info_pre else None,
                        "author": (info_pre.get("uploader") or info_pre.get("channel")) if info_pre else None,
                        "published_at": info_pre.get("upload_date") if info_pre else None
                    }

                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
                if info and os.path.exists(audio_path):
                    return {
                        "audio_path": audio_path,
                        "title": info.get("title"),
                        "author": info.get("uploader") or info.get("channel"),
                        "published_at": info.get("upload_date"),
                        "duration": info.get("duration") or dur
                    }
        except Exception as san_err:
            print(f"[FALLBACK 1] Sanitized cookie download notice: {san_err}")

        # 2. Secondary Strategy: Android mobile client (bypasses bot challenges without cookies)
        try:
            ydl_opts_android = {
                'format': 'bestaudio[ext=m4a]/bestaudio/best',
                'outtmpl': audio_path,
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
                'overwrites': True,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android']
                    }
                },
                'nocheckcertificate': True
            }
            _, proxy_url = get_youtube_proxy_config()
            if proxy_url:
                ydl_opts_android['proxy'] = proxy_url

            with yt_dlp.YoutubeDL(ydl_opts_android) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
                if info and os.path.exists(audio_path):
                    return {
                        "audio_path": audio_path,
                        "title": info.get("title"),
                        "author": info.get("uploader") or info.get("channel"),
                        "published_at": info.get("upload_date"),
                        "duration": info.get("duration") or 0
                    }
        except Exception as android_err:
            print(f"[FALLBACK 2] Android audio extraction notice: {android_err}")

        # 3. Tertiary Strategy: Direct Android mobile client (without proxy)
        try:
            ydl_opts_direct = {
                'format': 'bestaudio[ext=m4a]/bestaudio/best',
                'outtmpl': audio_path,
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
                'overwrites': True,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android']
                    }
                },
                'nocheckcertificate': True
            }
            with yt_dlp.YoutubeDL(ydl_opts_direct) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
                if info and os.path.exists(audio_path):
                    return {
                        "audio_path": audio_path,
                        "title": info.get("title"),
                        "author": info.get("uploader") or info.get("channel"),
                        "published_at": info.get("upload_date"),
                        "duration": info.get("duration") or 0
                    }
        except Exception as dir_err:
            print(f"[FALLBACK 3] Direct audio extraction notice: {dir_err}")

        return None
    except Exception as dl_err:
        print(f"yt-dlp fallback download failed: {dl_err}")
        return None

