import os
import sys
import time
import socket
import asyncio
import urllib3.util.connection as urllib_conn

# Force IPv4 to prevent WinError 10051 on unrouted IPv6 Windows networks
urllib_conn.allowed_gai_family = lambda: socket.AF_INET

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, BackgroundTasks, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
from schema import VideoStockSummary
from transcript_extractor import extract_video_id, get_video_transcript
from channel_scanner import get_channel_id_from_url, get_latest_videos_from_rss
from analyzer import analyze_transcript_with_gemini
from scan_queue import scan_queue
import youtube_oauth
from fastapi.responses import RedirectResponse

app = FastAPI(title="YouTube Stock Intelligence API", version="1.0.0")

# Enable CORS for React frontend (Vite dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory scan state
scan_status = {
    "is_scanning": False,
    "current_channel": None,
    "current_video": None,
    "progress_message": "Idle",
    "last_completed_at": None,
    "recent_logs": []
}


def log_scan(msg: str):
    scan_status["progress_message"] = msg
    scan_status["recent_logs"].append(msg)
    if len(scan_status["recent_logs"]) > 50:
        scan_status["recent_logs"].pop(0)


class AddChannelRequest(BaseModel):
    url_or_handle: str
    name: Optional[str] = None


class ScanRequest(BaseModel):
    target: str  # Video URL or Channel URL/Handle
    limit: int = 2


def execute_video_analysis(video_id: str, channel_id: str = "", channel_name: str = "", force: bool = False):
    """Processes a single video, calls Gemini, and saves to DB."""
    if not force and db.is_video_processed(video_id):
        log_scan(f"Skipping already analyzed video: {video_id}")
        return

    log_scan(f"Fetching transcript for video: {video_id}...")
    t_data = get_video_transcript(video_id)
    if not t_data.get("success"):
        log_scan(f"Transcript failed for {video_id}: {t_data.get('error')}")
        return

    ch_name = channel_name or t_data.get("author", "YouTube Channel")
    log_scan(f"Analyzing '{t_data.get('title')}' with Gemini...")

    try:
        summary = analyze_transcript_with_gemini(t_data)
        db.save_video_analysis(
            video_id=video_id,
            channel_id=channel_id,
            channel_name=ch_name,
            title=t_data.get("title", "Video"),
            published_at="",
            video_url=f"https://www.youtube.com/watch?v={video_id}",
            market_outlook=summary.market_outlook,
            summary_text=summary.creator_summary,
            macro_takeaways=summary.macro_key_takeaways,
            recommendations=summary.recommendations
        )
        log_scan(f"✓ Successfully extracted {len(summary.recommendations)} stock calls from {t_data.get('title')}")
    except Exception as e:
        log_scan(f"❌ Gemini extraction error for {video_id}: {str(e)}")


def background_scan_channel(channel_url: str, limit: int = 2):
    try:
        scan_status["is_scanning"] = True
        scan_status["current_channel"] = channel_url
        log_scan(f"Resolving channel: {channel_url}")

        ch_id = get_channel_id_from_url(channel_url)
        if not ch_id:
            log_scan(f"Could not resolve channel ID for: {channel_url}")
            return

        videos = get_latest_videos_from_rss(ch_id, limit=limit)
        log_scan(f"Found {len(videos)} recent videos for {channel_url}")

        for v in videos:
            scan_status["current_video"] = v.get("title")
            execute_video_analysis(
                video_id=v["video_id"],
                channel_id=ch_id,
                channel_name=v.get("channel_name", channel_url),
                force=False
            )
            # Free Tier Rate-Limit Protection (Pause between requests to respect 15 RPM)
            time.sleep(3)

        db.update_channel_scan_time(channel_url)
    finally:
        scan_status["is_scanning"] = False
        scan_status["current_channel"] = None
        scan_status["current_video"] = None
        log_scan("Channel scan completed.")


def background_scan_all_channels(limit: int = 2):
    try:
        scan_status["is_scanning"] = True
        channels = db.get_channels()
        enabled_channels = [c for c in channels if c.get("enabled")]
        log_scan(f"Starting batch scan of {len(enabled_channels)} enabled channels...")

        for ch in enabled_channels:
            url = ch.get("url") or ch.get("handle")
            scan_status["current_channel"] = ch.get("name", url)
            log_scan(f"Scanning channel [{ch.get('name')}]: {url}")
            
            ch_id = ch.get("channel_id") or get_channel_id_from_url(url)
            if ch_id:
                videos = get_latest_videos_from_rss(ch_id, limit=limit)
                for v in videos:
                    scan_status["current_video"] = v.get("title")
                    execute_video_analysis(
                        video_id=v["video_id"],
                        channel_id=ch_id,
                        channel_name=ch.get("name", v.get("channel_name")),
                        force=False
                    )
                db.update_channel_scan_time(url)

        log_scan("Batch scan of all channels completed successfully.")
    finally:
        scan_status["is_scanning"] = False
        scan_status["current_channel"] = None
        scan_status["current_video"] = None


# --- API Routes ---

@app.get("/api/recommendations")
def get_recommendations(
    search: Optional[str] = Query(None, description="Search ticker, company, or thesis"),
    ticker: Optional[str] = Query(None, description="Exact ticker filter"),
    sentiment: Optional[str] = Query(None, description="Sentiment filter: BUY, SELL, WATCHLIST, ACCUMULATE"),
    channel: Optional[str] = Query(None, description="Channel filter"),
    market: Optional[str] = Query(None, description="Market filter: US, India, etc."),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    return db.query_recommendations(
        search=search,
        ticker=ticker,
        sentiment=sentiment,
        channel_name=channel,
        market=market,
        limit=limit,
        offset=offset
    )


@app.get("/api/stats")
def get_stats():
    return db.get_stats()


@app.get("/api/channels")
def get_channels():
    return db.get_channels()


@app.post("/api/channels")
def add_new_channel(req: AddChannelRequest):
    handle_or_url = req.url_or_handle.strip()
    target_url = handle_or_url
    if not target_url.startswith("http"):
        if target_url.startswith("@"):
            target_url = f"https://www.youtube.com/{target_url}"
        else:
            target_url = f"https://www.youtube.com/@{target_url}"

    ch_id = get_channel_id_from_url(target_url)
    db.upsert_channel(
        name=req.name or handle_or_url,
        url=target_url,
        handle=handle_or_url if "@" in handle_or_url else None,
        channel_id=ch_id,
        enabled=True
    )
    return {"success": True, "message": f"Added channel: {req.name or handle_or_url}", "url": target_url}


@app.post("/api/channels/{channel_id}/toggle")
def toggle_channel(channel_id: int):
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE channels SET enabled = NOT enabled WHERE id = ?", (channel_id,))
        conn.commit()
    return {"success": True}


@app.get("/api/auth/youtube/status")
def get_youtube_auth_status():
    creds = youtube_oauth.load_saved_credentials()
    return {
        "connected": creds is not None and creds.valid,
        "has_credentials_config": Path("client_secret.json").exists() or bool(os.getenv("GOOGLE_CLIENT_ID"))
    }


@app.get("/api/auth/youtube/login")
def login_youtube_oauth(request: Request):
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/auth/youtube/callback"
    try:
        auth_url = youtube_oauth.get_authorization_url(redirect_uri)
        return RedirectResponse(auth_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/auth/youtube/callback")
def callback_youtube_oauth(code: str, request: Request):
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/auth/youtube/callback"
    try:
        credentials = youtube_oauth.exchange_code_for_credentials(code=code, redirect_uri=redirect_uri)
        
        # Auto-sync subscriptions immediately upon login
        live_channels = youtube_oauth.fetch_live_youtube_subscriptions(credentials)
        for ch in live_channels:
            db.upsert_channel(
                name=ch["name"],
                url=ch["url"],
                handle=ch["handle"],
                channel_id=ch["channel_id"],
                enabled=True
            )
        return RedirectResponse(f"{base_url}/?auth=success&synced={len(live_channels)}")
    except Exception as e:
        print(f"OAuth Callback Error: {e}")
        return RedirectResponse(f"{base_url}/?auth=error&error={str(e)}")



@app.post("/api/auth/youtube/sync")
def sync_live_youtube_subscriptions():
    credentials = youtube_oauth.load_saved_credentials()
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="YouTube account not connected. Please connect via /api/auth/youtube/login first."
        )

    try:
        live_channels = youtube_oauth.fetch_live_youtube_subscriptions(credentials)
        for ch in live_channels:
            db.upsert_channel(
                name=ch["name"],
                url=ch["url"],
                handle=ch["handle"],
                channel_id=ch["channel_id"],
                enabled=True
            )
        return {
            "success": True,
            "message": f"Successfully live-synced {len(live_channels)} subscribed channels from YouTube!",
            "channels_count": len(live_channels)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch live subscriptions: {str(e)}")



@app.get("/api/scan/status")
def get_scan_status():
    return scan_queue.get_status()


@app.post("/api/queue/clear")
def clear_scan_queue():
    scan_queue.clear_queue()
    return {"success": True, "message": "Scan queue cleared successfully."}


@app.post("/api/scan")
def trigger_scan(req: ScanRequest):
    target = req.target.strip()
    video_id = extract_video_id(target)
    
    if video_id:
        scan_queue.enqueue_video(video_id=video_id, title=f"Video {video_id}")
        return {"success": True, "message": f"Enqueued video for sequential scan: {video_id}"}
    else:
        ch_id = get_channel_id_from_url(target)
        if not ch_id:
            raise HTTPException(status_code=400, detail=f"Could not resolve channel: {target}")
        
        videos = get_latest_videos_from_rss(ch_id, limit=req.limit)
        added = 0
        for v in videos:
            if scan_queue.enqueue_video(
                video_id=v["video_id"],
                channel_id=ch_id,
                channel_name=v.get("channel_name", target),
                title=v.get("title", "")
            ):
                added += 1
        db.update_channel_scan_time(target)
        return {"success": True, "message": f"Enqueued {added} recent videos from {target} (1-by-1 mode)."}


@app.post("/api/scan-all")
def trigger_scan_all(limit: int = 2):
    channels = db.get_channels()
    enabled_channels = [c for c in channels if c.get("enabled")]
    total_added = 0

    for ch in enabled_channels:
        url = ch.get("url") or ch.get("handle")
        ch_id = ch.get("channel_id") or get_channel_id_from_url(url)
        if ch_id:
            videos = get_latest_videos_from_rss(ch_id, limit=limit)
            for v in videos:
                if scan_queue.enqueue_video(
                    video_id=v["video_id"],
                    channel_id=ch_id,
                    channel_name=ch.get("name", v.get("channel_name")),
                    title=v.get("title", "")
                ):
                    total_added += 1
            db.update_channel_scan_time(url)

    return {
        "success": True,
        "message": f"Enqueued {total_added} videos across {len(enabled_channels)} channels for sequential processing (1-at-a-time)."
    }
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

# Mount static build files if present
CLIENT_DIST = Path(__file__).parent / "client" / "dist"
if CLIENT_DIST.exists():
    app.mount("/assets", StaticFiles(directory=CLIENT_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_react_app(full_path: str):
        file_path = CLIENT_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(CLIENT_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🚀 AlphaPulse YouTube Stock Intelligence Platform")
    print("🌐 Dashboard UI: http://127.0.0.1:8000")
    print("📡 API Docs:     http://127.0.0.1:8000/docs")
    print("=" * 60)
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)

