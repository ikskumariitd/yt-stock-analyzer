import re
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
import requests


def get_channel_id_from_url(channel_url: str) -> Optional[str]:
    """Extract or resolve YouTube Channel ID from URLs like @handle or /channel/UCxxx."""
    channel_url = channel_url.strip()
    
    # Direct channel ID url
    match_id = re.search(r"youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})", channel_url)
    if match_id:
        return match_id.group(1)
        
    # If raw channel ID is provided
    if channel_url.startswith("UC") and len(channel_url) == 24:
        return channel_url

    # For handle URLs (e.g., https://www.youtube.com/@meetkevin) or custom URLs, scrape the channel page meta tag
    try:
        if not channel_url.startswith("http"):
            if channel_url.startswith("@"):
                channel_url = f"https://www.youtube.com/{channel_url}"
            else:
                channel_url = f"https://www.youtube.com/@{channel_url}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(channel_url, headers=headers, timeout=10)
        if resp.status_code == 200:
            # Look for channelId in page content
            match = re.search(r'"channelId":"(UC[a-zA-Z0-9_-]{22})"', resp.text)
            if match:
                return match.group(1)
            # Alternative meta tag pattern
            match_meta = re.search(r'<meta itemprop="channelId" content="(UC[a-zA-Z0-9_-]{22})"', resp.text)
            if match_meta:
                return match_meta.group(1)
    except Exception:
        pass
    return None


def get_latest_videos_from_rss(channel_id: str, limit: int = 10, after_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch the latest videos from a channel via public YouTube RSS feed (Free & No API key needed).
    Supports optional `after_date` filtering (format: 'YYYY-MM-DD').
    Returns list of dicts: [{'video_id', 'title', 'published', 'link', 'author'}]
    """
    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    videos = []
    try:
        resp = requests.get(rss_url, timeout=10)
        if resp.status_code == 200:
            root = ET.fromstring(resp.content)
            # Atom namespace
            ns = {
                "atom": "http://www.w3.org/2005/Atom",
                "yt": "http://www.youtube.com/xml/schemas/2015",
                "media": "http://search.yahoo.com/mrss/"
            }
            channel_title_elem = root.find("atom:title", ns)
            channel_title = channel_title_elem.text if channel_title_elem is not None else "YouTube Channel"

            entries = root.findall("atom:entry", ns)
            for entry in entries:
                if len(videos) >= limit:
                    break

                video_id_elem = entry.find("yt:videoId", ns)
                title_elem = entry.find("atom:title", ns)
                published_elem = entry.find("atom:published", ns)

                if video_id_elem is not None and title_elem is not None:
                    pub_text = published_elem.text if published_elem is not None else ""
                    
                    # If after_date filter is set, compare YYYY-MM-DD
                    if after_date and pub_text:
                        clean_pub_date = pub_text[:10]
                        clean_after_date = after_date.strip()[:10]
                        if clean_pub_date < clean_after_date:
                            continue

                    videos.append({
                        "video_id": video_id_elem.text,
                        "title": title_elem.text,
                        "published": pub_text,
                        "url": f"https://www.youtube.com/watch?v={video_id_elem.text}",
                        "channel_name": channel_title,
                        "channel_id": channel_id
                    })
    except Exception as e:
        print(f"Error reading RSS for channel {channel_id}: {e}")
    return videos

