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
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, BackgroundTasks, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
import uvicorn

import db
import youtube_oauth
from transcript_extractor import extract_video_id, get_video_transcript
from analyzer import analyze_transcript_with_gemini
from channel_scanner import get_latest_videos_from_rss, get_channel_id_from_url
from scan_queue import scan_queue
import scheduler

# Initialize SQLite database
db.init_db()

app = FastAPI(
    title="AlphaPulse YouTube Stock Intelligence API",
    description="Automated system to ingest YouTube financial videos and extract actionable stock recommendations with key levels.",
    version="1.0.0"
)

# Enable GZip compression for fast data transfer
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Enable CORS for frontend development
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
    after_date: Optional[str] = None  # Optional YYYY-MM-DD



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
    days: Optional[str] = Query(None, description="Filter within past N days, YTD, or ALL"),
    stance_change: Optional[str] = Query(None, description="Stance evolution filter: UPGRADED, DOWNGRADED, REITERATED, INITIAL, CHANGES_ONLY"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    return db.query_recommendations(
        search=search,
        ticker=ticker,
        sentiment=sentiment,
        channel_name=channel,
        market=market,
        days=days,
        stance_change=stance_change,
        limit=limit,
        offset=offset
    )


@app.get("/api/consensus")
def get_consensus(
    search: Optional[str] = Query(None, description="Search ticker, company, or thesis"),
    sentiment: Optional[str] = Query(None, description="Sentiment filter"),
    channel: Optional[str] = Query(None, description="Channel filter"),
    market: Optional[str] = Query(None, description="Market filter"),
    days: Optional[str] = Query(None, description="Filter within past N days, YTD, or ALL"),
    stance_change: Optional[str] = Query(None, description="Stance evolution filter: UPGRADED, DOWNGRADED, REITERATED, CHANGES_ONLY"),
    sort_by: str = Query("mentions", description="Sort by: mentions, date, ticker, bullish")
):
    return db.query_consensus(
        search=search,
        sentiment=sentiment,
        channel_name=channel,
        market=market,
        days=days,
        stance_change=stance_change,
        sort_by=sort_by
    )




@app.get("/api/stats")
def get_stats():
    return db.get_stats()


@app.get("/api/channels")
def get_channels():
    return db.get_channels()


from instagram_extractor import is_instagram_url, normalize_instagram_url, get_creator_recent_reels

@app.post("/api/channels")
async def add_channel(req: AddChannelRequest):
    handle_or_url = req.url_or_handle.strip()
    
    # Check if Instagram creator
    if is_instagram_url(handle_or_url):
        clean_url = normalize_instagram_url(handle_or_url)
        username = clean_url.split("/")[-2]
        db.upsert_channel(
            name=req.name or f"@{username}",
            url=clean_url,
            handle=f"@{username}",
            channel_id=f"ig_{username}",
            platform="instagram",
            enabled=True
        )
        return {
            "success": True,
            "message": f"Added Instagram creator: {req.name or '@' + username}",
            "url": clean_url,
            "platform": "instagram"
        }

    # YouTube Creator
    target_url = handle_or_url
    if not target_url.startswith("http"):
        if target_url.startswith("@"):
            target_url = f"https://www.youtube.com/{target_url}"
        else:
            target_url = f"https://www.youtube.com/@{target_url}"

    ch_id = await asyncio.to_thread(get_channel_id_from_url, target_url)
    db.upsert_channel(
        name=req.name or handle_or_url,
        url=target_url,
        handle=handle_or_url if "@" in handle_or_url else None,
        channel_id=ch_id,
        platform="youtube",
        enabled=True
    )
    return {"success": True, "message": f"Added YouTube channel: {req.name or handle_or_url}", "url": target_url, "platform": "youtube"}


@app.post("/api/channels/{channel_id}/toggle")
def toggle_channel(channel_id: int):
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE channels SET enabled = NOT enabled WHERE id = ?", (channel_id,))
        conn.commit()
    return {"success": True}


@app.delete("/api/channels/{channel_id}")
def remove_channel(channel_id: int):
    db.delete_channel(channel_id)
    return {"success": True, "message": "Channel removed successfully."}


@app.get("/api/channels/{channel_id}/videos")
def get_creator_videos(channel_id: int):
    """Retrieves all tracked videos/reels for a specific creator ordered by upload date DESC."""
    videos = db.get_channel_videos(channel_id)
    return {
        "channel_id": channel_id,
        "count": len(videos),
        "videos": videos
    }



def get_request_base_url(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "http"
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host}".rstrip("/")


@app.get("/api/auth/youtube/status")
def get_youtube_auth_status():
    creds = youtube_oauth.load_saved_credentials()
    return {
        "connected": creds is not None and (creds.valid or bool(creds.refresh_token)),
        "has_credentials_config": Path("client_secret.json").exists() or bool(os.getenv("GOOGLE_CLIENT_ID"))
    }


@app.get("/api/auth/youtube/login")
def login_youtube_oauth(request: Request):
    base_url = get_request_base_url(request)
    redirect_uri = f"{base_url}/api/auth/youtube/callback"
    try:
        auth_url = youtube_oauth.get_authorization_url(redirect_uri)
        return RedirectResponse(auth_url)
    except Exception as e:
        print(f"YouTube Login Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/auth/youtube/callback")
def callback_youtube_oauth(code: str, request: Request):
    base_url = get_request_base_url(request)
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
            detail="YouTube account not connected. Please click Connect YouTube Account to authenticate."
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
            "message": f"Successfully live-synced {len(live_channels)} subscribed channels directly from your YouTube account!",
            "channels_count": len(live_channels)
        }
    except PermissionError as pe:
        raise HTTPException(status_code=401, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch live subscriptions: {str(e)}")




class SettingsRequest(BaseModel):
    cooldown_seconds: Optional[int] = None
    model_cascade: Optional[List[str]] = None


@app.get("/api/scan/settings")
def get_scan_settings():
    return {
        "cooldown_seconds": scan_queue.get_cooldown_seconds(),
        "model_cascade": db.get_model_cascade(),
        "available_models": [
            "gemini-3.5-flash-lite",
            "gemini-3.6-flash",
            "gemini-3.7-flash",
            "gemini-3.5-flash",
            "gemini-flash-lite-latest",
            "gemini-2.5-flash",
            "gemini-2.5-pro"
        ]
    }


@app.post("/api/scan/settings")
def update_scan_settings(req: SettingsRequest):
    if req.cooldown_seconds is not None:
        scan_queue.set_cooldown_seconds(req.cooldown_seconds)
    if req.model_cascade is not None and len(req.model_cascade) > 0:
        db.set_model_cascade(req.model_cascade)
        scan_queue.log(f"⚙️ Model cascade priority updated to: {' -> '.join(req.model_cascade)}")
    return {
        "success": True,
        "cooldown_seconds": scan_queue.get_cooldown_seconds(),
        "model_cascade": db.get_model_cascade()
    }


class SchedulerConfigRequest(BaseModel):
    enabled: bool
    runs_per_day: Optional[int] = 4


@app.on_event("startup")
def on_app_startup():
    scheduler.start_scheduler()


@app.get("/api/scheduler/status")
def get_scheduler_status():
    return scheduler.get_scheduler_status()


@app.post("/api/scheduler/config")
def update_scheduler_config(req: SchedulerConfigRequest):
    return scheduler.update_scheduler_config(enabled=req.enabled, runs_per_day=req.runs_per_day or 4)


@app.post("/api/scheduler/run-now")
async def trigger_scheduler_run_now():
    return await scheduler.trigger_run_now()


@app.get("/api/scan/status")
async def get_scan_status():
    return scan_queue.get_status()


@app.post("/api/queue/clear")
async def clear_scan_queue():
    scan_queue.clear_queue()
    return {"success": True, "message": "Scan queue cleared successfully."}


@app.post("/api/scan")
async def trigger_scan(req: ScanRequest):
    target = req.target.strip()
    
    # 1. Instagram Reel / Post URL
    if is_instagram_url(target):
        if "/reel/" in target or "/p/" in target or "/reels/" in target:
            clean_url = normalize_instagram_url(target)
            post_id = clean_url.split("/")[-2]
            video_id = f"ig_{post_id}"
            scan_queue.enqueue_video(
                video_id=video_id,
                title=f"Instagram Reel {post_id}",
                platform="instagram",
                raw_url=clean_url
            )
            scan_queue.trigger_worker()
            return {"success": True, "message": f"Enqueued Instagram Reel for extraction: {post_id}"}
        else:
            # Instagram Creator Profile
            reels = await asyncio.to_thread(get_creator_recent_reels, target, limit=req.limit)
            added = 0
            for r in reels:
                if scan_queue.enqueue_video(
                    video_id=r["video_id"],
                    channel_name=r.get("author", target),
                    title=r.get("title", ""),
                    published_at=r.get("published_at", ""),
                    platform="instagram",
                    raw_url=r.get("url", ""),
                    caption=r.get("caption", "")
                ):
                    added += 1
            await asyncio.to_thread(db.update_channel_scan_time, target)
            scan_queue.trigger_worker()
            return {"success": True, "message": f"Enqueued {added} Instagram Reels/Posts from {target}."}

    # 2. YouTube Single Video
    video_id = extract_video_id(target)
    if video_id:
        scan_queue.enqueue_video(video_id=video_id, title=f"Video {video_id}", platform="youtube")
        scan_queue.trigger_worker()
        return {"success": True, "message": f"Enqueued YouTube video for sequential scan: {video_id}"}
    
    # 3. YouTube Channel
    ch_id = await asyncio.to_thread(get_channel_id_from_url, target)
    if not ch_id:
        raise HTTPException(status_code=400, detail=f"Could not resolve channel: {target}")
    
    videos = await asyncio.to_thread(
        get_latest_videos_from_rss,
        channel_id=ch_id,
        limit=req.limit,
        after_date=req.after_date
    )
    added = 0
    for v in videos:
        if scan_queue.enqueue_video(
            video_id=v["video_id"],
            channel_id=ch_id,
            channel_name=v.get("channel_name", target),
            title=v.get("title", ""),
            published_at=v.get("published", ""),
            platform="youtube"
        ):
            added += 1
    await asyncio.to_thread(db.update_channel_scan_time, target)
    scan_queue.trigger_worker()
    return {"success": True, "message": f"Enqueued {added} recent videos from {target} (1-by-1 mode)."}


@app.post("/api/scan-all")
async def trigger_scan_all(limit: int = 2, after_date: Optional[str] = None):
    channels = await asyncio.to_thread(db.get_channels)
    enabled_channels = [c for c in channels if c.get("enabled")]
    total_added = 0

    for ch in enabled_channels:
        url = ch.get("url") or ch.get("handle")
        platform = ch.get("platform", "youtube")

        if platform == "instagram" or is_instagram_url(url):
            reels = await asyncio.to_thread(get_creator_recent_reels, url, limit=limit)
            for r in reels:
                if scan_queue.enqueue_video(
                    video_id=r["video_id"],
                    channel_name=ch.get("name", r.get("author", url)),
                    title=r.get("title", ""),
                    published_at=r.get("published_at", ""),
                    platform="instagram",
                    raw_url=r.get("url", ""),
                    caption=r.get("caption", "")
                ):
                    total_added += 1
            await asyncio.to_thread(db.update_channel_scan_time, url)
        else:
            ch_id = ch.get("channel_id") or await asyncio.to_thread(get_channel_id_from_url, url)
            if ch_id:
                videos = await asyncio.to_thread(
                    get_latest_videos_from_rss,
                    channel_id=ch_id,
                    limit=limit,
                    after_date=after_date
                )
                for v in videos:
                    if scan_queue.enqueue_video(
                        video_id=v["video_id"],
                        channel_id=ch_id,
                        channel_name=ch.get("name", v.get("channel_name")),
                        title=v.get("title", ""),
                        published_at=v.get("published", ""),
                        platform="youtube"
                    ):
                        total_added += 1
                await asyncio.to_thread(db.update_channel_scan_time, url)

    scan_queue.trigger_worker()

    date_msg = f" published after {after_date}" if after_date else ""
    return {
        "success": True,
        "message": f"Enqueued {total_added} videos/reels{date_msg} across {len(enabled_channels)} creators for sequential processing."
    }


@app.get("/api/scan/audit")
async def get_scan_audit(
    status: Optional[str] = None,
    platform: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Retrieves the history/audit log of all scanned videos & reels, including in-progress/queued."""
    audit_data = await asyncio.to_thread(
        db.get_scan_audit_logs,
        status=status,
        platform=platform,
        search=search,
        limit=limit,
        offset=offset
    )

    # Prepend any currently processing or queued items
    active_queue = scan_queue.get_queued_items()
    filtered_queue = []
    for item in active_queue:
        if status and status.upper() not in ["ALL", item["status"]]:
            continue
        if platform and platform.lower() not in ["all", item.get("platform", "youtube").lower()]:
            continue
        if search:
            s_low = search.lower()
            if s_low not in item.get("title", "").lower() and s_low not in item.get("channel_name", "").lower():
                continue
        
        filtered_queue.append({
            "id": f"q_{item['video_id']}",
            "video_id": item["video_id"],
            "channel_name": item.get("channel_name") or "Creator",
            "title": item.get("title") or f"Video {item['video_id']}",
            "video_url": item.get("raw_url") or (f"https://www.instagram.com/reel/{item['video_id'].replace('ig_', '')}/" if item.get("platform") == "instagram" else f"https://www.youtube.com/watch?v={item['video_id']}"),
            "platform": item.get("platform") or "youtube",
            "published_at": item.get("published_at") or "",
            "status": item["status"],  # 'PROCESSING' or 'QUEUED'
            "stocks_count": 0,
            "tickers": [],
            "error_message": None,
            "duration_seconds": 0,
            "scanned_at": datetime.fromtimestamp(item.get("enqueued_at", time.time()), tz=timezone.utc).isoformat()
        })

    audit_data["queued"] = len(active_queue)
    audit_data["items"] = filtered_queue + audit_data.get("items", [])
    return audit_data


class RescanRequest(BaseModel):
    video_id: str
    url: Optional[str] = None
    channel_name: Optional[str] = None
    title: Optional[str] = None
    platform: Optional[str] = "youtube"


class PurgeAuditRequest(BaseModel):
    statuses: Optional[List[str]] = None


@app.post("/api/scan/audit/purge")
async def purge_audit_logs(req: Optional[PurgeAuditRequest] = None):
    """Purges skipped, failed, and too-long audit records to keep UI clean."""
    statuses = req.statuses if req else None
    deleted_count = await asyncio.to_thread(db.purge_audit_logs, statuses)
    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Successfully purged {deleted_count} skipped/failed audit logs."
    }


@app.post("/api/scan/rescan")
async def trigger_rescan(req: RescanRequest):
    """Forces re-scanning of a specific video or reel."""
    with db.get_connection() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM videos WHERE video_id = ?", (req.video_id,))
        c.execute("DELETE FROM recommendations WHERE video_id = ?", (req.video_id,))
        conn.commit()

    scan_queue.enqueue_video(
        video_id=req.video_id,
        channel_name=req.channel_name or "Creator",
        title=req.title or f"Rescan {req.video_id}",
        platform=req.platform or "youtube",
        raw_url=req.url or ""
    )
    scan_queue.trigger_worker()
    return {"success": True, "message": f"Enqueued {req.video_id} for fresh re-scan."}


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

