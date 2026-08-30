import os
import sys
import time
import logging
import asyncio
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
import zoneinfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import db
from channel_scanner import get_latest_videos_from_rss, get_channel_id_from_url
from instagram_extractor import is_instagram_url, get_creator_recent_reels
from scan_queue import scan_queue

SGT = zoneinfo.ZoneInfo("Asia/Singapore")
logger = logging.getLogger("scheduler")

# Global scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None
JOB_ID = "automated_video_scan_job"

# Presets mapping runs per day to cron hours in SGT
FREQUENCY_HOURS_MAP = {
    1: "08",                      # 1x daily (08:00 SGT)
    2: "08,20",                   # 2x daily (08:00, 20:00 SGT)
    3: "06,14,22",                # 3x daily (06:00, 14:00, 22:00 SGT)
    4: "00,06,12,18",             # 4x daily (Every 6 hours: 00:00, 06:00, 12:00, 18:00 SGT)
    6: "00,04,08,12,16,20",       # 6x daily (Every 4 hours)
    8: "00,03,06,09,12,15,18,21", # 8x daily (Every 3 hours)
    12: "00,02,04,06,08,10,12,14,16,18,20,22", # 12x daily (Every 2 hours)
    24: "*"                       # Hourly
}


def get_default_config() -> Dict[str, Any]:
    return {
        "enabled": True,
        "runs_per_day": 4,
        "hours": "00,06,12,18",
        "fetch_limit_per_creator": 5
    }


def load_scheduler_config() -> Dict[str, Any]:
    saved = db.get_setting("scheduler_config")
    if saved:
        try:
            return json.loads(saved)
        except Exception:
            pass
    return get_default_config()


def save_scheduler_config(config: Dict[str, Any]):
    db.set_setting("scheduler_config", json.dumps(config))


async def perform_scheduled_channel_check():
    """
    Automated job that runs 4 times a day (or configured frequency).
    Checks all enabled creators, discovers new videos uploaded since each creator's last scan,
    and enqueues them into the sequential 1-at-a-time scan queue.
    """
    now_sgt = datetime.now(SGT)
    timestamp_str = now_sgt.strftime('%Y-%m-%d %H:%M:%S %Z')
    logger.info(f"⏰ [Auto-Scheduler] Starting automated creator check at {timestamp_str}...")

    channels = await asyncio.to_thread(db.get_channels)
    enabled_channels = [c for c in channels if c.get("enabled")]
    total_enqueued = 0
    channels_checked = 0

    scan_queue.log(f"⏰ [Auto-Scan] Checking {len(enabled_channels)} enabled creators for new uploads...")

    for ch in enabled_channels:
        url = ch.get("url") or ch.get("handle")
        name = ch.get("name") or url
        platform = ch.get("platform", "youtube")
        last_scanned = ch.get("last_scanned_at")
        
        # Calculate date boundary from last scan
        after_date = None
        if last_scanned:
            try:
                # Use date portion of last_scanned
                after_dt = datetime.fromisoformat(last_scanned.replace(" ", "T")).date()
                after_date = str(after_dt)
            except Exception:
                after_date = None

        channels_checked += 1

        if platform == "instagram" or is_instagram_url(url):
            try:
                reels = await asyncio.to_thread(get_creator_recent_reels, url, limit=5)
                added_for_creator = 0
                for r in reels:
                    vid = r["video_id"]
                    if not db.is_video_processed(vid):
                        if scan_queue.enqueue_video(
                            video_id=vid,
                            channel_name=ch.get("name", r.get("author", url)),
                            title=r.get("title", ""),
                            published_at=r.get("published_at", ""),
                            platform="instagram",
                            raw_url=r.get("url", ""),
                            caption=r.get("caption", "")
                        ):
                            added_for_creator += 1
                            total_enqueued += 1
                await asyncio.to_thread(db.update_channel_scan_time, url)
                if added_for_creator > 0:
                    logger.info(f"  📷 [Instagram] Enqueued {added_for_creator} new reels from {name}")
            except Exception as e:
                logger.error(f"  ❌ Error checking Instagram creator {name}: {e}")
        else:
            # YouTube Creator
            try:
                ch_id = ch.get("channel_id") or await asyncio.to_thread(get_channel_id_from_url, url)
                if ch_id:
                    videos = await asyncio.to_thread(
                        get_latest_videos_from_rss,
                        channel_id=ch_id,
                        limit=5,
                        after_date=after_date
                    )
                    added_for_creator = 0
                    for v in videos:
                        vid = v["video_id"]
                        if not db.is_video_processed(vid):
                            if scan_queue.enqueue_video(
                                video_id=vid,
                                channel_id=ch_id,
                                channel_name=ch.get("name", v.get("channel_name")),
                                title=v.get("title", ""),
                                published_at=v.get("published", ""),
                                platform="youtube"
                            ):
                                added_for_creator += 1
                                total_enqueued += 1
                    await asyncio.to_thread(db.update_channel_scan_time, url)
                    if added_for_creator > 0:
                        logger.info(f"  🔴 [YouTube] Enqueued {added_for_creator} new videos from {name}")
            except Exception as e:
                logger.error(f"  ❌ Error checking YouTube channel {name}: {e}")

    # Trigger sequential queue worker if new videos were enqueued
    if total_enqueued > 0:
        scan_queue.trigger_worker()
        msg = f"Enqueued {total_enqueued} new videos across {channels_checked} creators."
    else:
        msg = f"All {channels_checked} creators are up to date. No new videos found."

    logger.info(f"⏰ [Auto-Scheduler] {msg}")
    scan_queue.log(f"⏰ [Auto-Scan] {msg}")

    summary = {
        "last_run_time": now_sgt.isoformat(),
        "last_run_formatted": now_sgt.strftime("%d %b %Y, %I:%M %p SGT"),
        "last_run_status": "Success",
        "videos_enqueued": total_enqueued,
        "channels_checked": channels_checked,
        "message": msg
    }
    db.set_setting("scheduler_last_run", json.dumps(summary))


def get_scheduler_status() -> Dict[str, Any]:
    global _scheduler
    config = load_scheduler_config()
    
    last_run_raw = db.get_setting("scheduler_last_run")
    last_run = None
    if last_run_raw:
        try:
            last_run = json.loads(last_run_raw)
        except Exception:
            pass

    next_run_str = None
    if _scheduler and _scheduler.running:
        job = _scheduler.get_job(JOB_ID)
        if job and job.next_run_time:
            next_run_sgt = job.next_run_time.astimezone(SGT)
            next_run_str = next_run_sgt.strftime("%d %b %Y, %I:%M %p SGT")

    return {
        "enabled": config.get("enabled", True),
        "runs_per_day": config.get("runs_per_day", 4),
        "hours": config.get("hours", "00,06,12,18"),
        "timezone": "Asia/Singapore (SGT / UTC+8)",
        "is_running": bool(_scheduler and _scheduler.running),
        "next_run_time": next_run_str,
        "last_run": last_run,
        "schedule_description": f"{config.get('runs_per_day', 4)} times daily ({config.get('hours', '00,06,12,18').replace(',', ':00, ')}:00 SGT)"
    }


def start_scheduler():
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        return

    config = load_scheduler_config()
    _scheduler = AsyncIOScheduler(timezone=SGT)

    runs_per_day = config.get("runs_per_day", 4)
    hours = FREQUENCY_HOURS_MAP.get(runs_per_day, "00,06,12,18")

    if config.get("enabled", True):
        _scheduler.add_job(
            perform_scheduled_channel_check,
            trigger=CronTrigger(hour=hours, minute="0", timezone=SGT),
            id=JOB_ID,
            name="Automated 4x Daily Video Discovery",
            replace_existing=True
        )
        _scheduler.start()
        logger.info(f"🚀 [Auto-Scheduler] Started! Running {runs_per_day}x daily at hours [{hours}] SGT.")
    else:
        logger.info("⏸️ [Auto-Scheduler] Initialized in PAUSED / DISABLED state.")


def update_scheduler_config(enabled: bool, runs_per_day: int = 4) -> Dict[str, Any]:
    global _scheduler
    runs_per_day = max(1, min(24, int(runs_per_day)))
    hours = FREQUENCY_HOURS_MAP.get(runs_per_day, "00,06,12,18")

    config = {
        "enabled": enabled,
        "runs_per_day": runs_per_day,
        "hours": hours,
        "fetch_limit_per_creator": 5
    }
    save_scheduler_config(config)

    if _scheduler is None:
        start_scheduler()
        return get_scheduler_status()

    # Remove existing job if any
    try:
        _scheduler.remove_job(JOB_ID)
    except Exception:
        pass

    if enabled:
        _scheduler.add_job(
            perform_scheduled_channel_check,
            trigger=CronTrigger(hour=hours, minute="0", timezone=SGT),
            id=JOB_ID,
            name="Automated 4x Daily Video Discovery",
            replace_existing=True
        )
        if not _scheduler.running:
            _scheduler.start()
        logger.info(f"⚙️ [Auto-Scheduler] Updated! Scheduled {runs_per_day}x daily at hours [{hours}] SGT.")
    else:
        logger.info("⚙️ [Auto-Scheduler] Paused automated scheduling.")

    return get_scheduler_status()


async def trigger_run_now() -> Dict[str, Any]:
    """Triggers an immediate background execution of the scheduled check."""
    asyncio.create_task(perform_scheduled_channel_check())
    return {
        "success": True,
        "message": "Automated scan triggered immediately in background."
    }

