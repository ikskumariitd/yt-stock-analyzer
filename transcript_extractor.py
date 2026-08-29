import re
import urllib.parse
from typing import Dict, Any, Optional, List
import requests
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    CouldNotRetrieveTranscript,
)


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


def fetch_video_metadata_oembed(video_id: str) -> Dict[str, str]:
    """Fetch basic video title and author without needing an API key via public oEmbed."""
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(url)}&format=json"
        resp = requests.get(oembed_url, timeout=5)
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


def get_video_transcript(video_id: str, preferred_languages: List[str] = None) -> Dict[str, Any]:
    """
    Fetch transcript using youtube-transcript-api.
    Returns:
        {
            "success": True,
            "video_id": str,
            "title": str,
            "author": str,
            "full_text": str,
            "timestamped_text": str,
            "raw_segments": list
        }
    """
    if preferred_languages is None:
        preferred_languages = ["en", "en-US", "en-GB", "hi", "hi-Latn"]

    metadata = fetch_video_metadata_oembed(video_id)
    
    try:
        ytt_api = YouTubeTranscriptApi()
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
            return {
                "success": False,
                "video_id": video_id,
                "title": metadata.get("title"),
                "error": "No matching transcript found for this video.",
            }

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
        print(f"⚠️ YouTubeTranscriptApi unavailable for {video_id} ({err_msg[:80]}...). Attempting Gemini Audio Fallback with yt-dlp...")
        
        audio_info = download_youtube_audio_fallback(video_id)
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

        # If audio download also fails, return clean error message
        reason = "YouTube IP Block (429)" if "blocking requests" in err_msg or "429" in err_msg else err_msg[:120]
        return {
            "success": False,
            "video_id": video_id,
            "title": metadata.get("title"),
            "error": f"Transcript & Audio unavailable: {reason}",
        }


def download_youtube_audio_fallback(video_id: str) -> Optional[Dict[str, Any]]:
    """Downloads lightweight audio stream with yt-dlp when YouTube Transcript API is blocked."""
    try:
        import yt_dlp
        import tempfile
        import os

        temp_dir = os.path.join(tempfile.gettempdir(), "alphapulse_yt_audio")
        os.makedirs(temp_dir, exist_ok=True)
        audio_path = os.path.join(temp_dir, f"yt_{video_id}.m4a")

        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio/best',
            'outtmpl': audio_path,
            'quiet': True,
            'noplaylist': True,
            'overwrites': True
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
            return {
                "audio_path": audio_path,
                "title": info.get("title"),
                "author": info.get("uploader") or info.get("channel"),
                "published_at": info.get("upload_date")
            }
    except Exception as dl_err:
        print(f"yt-dlp fallback download failed: {dl_err}")
        return None
