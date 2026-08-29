import os
import sys
import time
import asyncio
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict

import db
from transcript_extractor import get_video_transcript
from instagram_extractor import extract_instagram_post_metadata_and_audio
from analyzer import analyze_transcript_with_gemini, analyze_instagram_media_with_gemini

logger = logging.getLogger("scan_queue")


@dataclass
class QueueItem:
    video_id: str
    channel_id: str = ""
    channel_name: str = ""
    title: str = ""
    published_at: str = ""
    platform: str = "youtube"  # 'youtube' | 'instagram'
    raw_url: str = ""
    caption: str = ""
    status: str = "pending"  # pending, processing, completed, skipped, failed
    error: Optional[str] = None
    enqueued_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None


class SequentialScanQueue:
    def __init__(self):
        self._queue: List[QueueItem] = []
        self._current_item: Optional[QueueItem] = None
        self._is_processing: bool = False
        self._logs: List[str] = []
        self._total_batch_size: int = 0
        self._completed_in_batch: int = 0
        self._worker_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self._cooldown_seconds: int = int(db.get_setting("scan_cooldown_seconds", "3600"))
        self._cooldown_end_time: Optional[float] = None

    def get_cooldown_seconds(self) -> int:
        return self._cooldown_seconds

    def set_cooldown_seconds(self, secs: int):
        self._cooldown_seconds = max(0, int(secs))
        db.set_setting("scan_cooldown_seconds", str(self._cooldown_seconds))
        mins = round(self._cooldown_seconds / 60, 1)
        self.log(f"⚙️ Scan cooling period updated to {self._cooldown_seconds}s ({mins} min)")

    def log(self, message: str):
        timestamp = time.strftime("%H:%M:%S")
        log_line = f"[{timestamp}] {message}"
        self._logs.append(log_line)
        if len(self._logs) > 60:
            self._logs.pop(0)
        try:
            print(log_line)
        except Exception:
            pass

    def enqueue_video(
        self,
        video_id: str,
        channel_id: str = "",
        channel_name: str = "",
        title: str = "",
        published_at: str = "",
        platform: str = "youtube",
        raw_url: str = "",
        caption: str = ""
    ) -> bool:
        """Enqueue a single video/reel if not already queued."""
        if any(item.video_id == video_id for item in self._queue):
            return False
        if self._current_item and self._current_item.video_id == video_id:
            return False

        item = QueueItem(
            video_id=video_id,
            channel_id=channel_id,
            channel_name=channel_name,
            title=title or f"{platform.title()} Video {video_id}",
            published_at=published_at,
            platform=platform,
            raw_url=raw_url,
            caption=caption
        )
        self._queue.append(item)
        self._total_batch_size += 1
        platform_icon = "📷" if platform == "instagram" else "🎬"
        self.log(f"📥 Enqueued {platform_icon}: {item.title} ({video_id})")
        self.trigger_worker()
        return True

    def clear_queue(self):
        """Clear pending queue items and reset batch counts."""
        canceled_count = len(self._queue)
        self._queue.clear()
        self._total_batch_size = 0
        self._completed_in_batch = 0
        self._current_item = None
        self._is_processing = False
        self.log(f"⏹️ Queue stopped & cleared ({canceled_count} pending items removed).")

    def trigger_worker(self):
        """Schedules the background processing task on the running loop."""
        try:
            loop = asyncio.get_running_loop()
            if not self._worker_task or self._worker_task.done():
                self._worker_task = loop.create_task(self._process_all_items())
        except RuntimeError:
            pass

    async def _process_all_items(self):
        """Processes items from the queue 1-by-1 sequentially."""
        if self._is_processing:
            return

        self._is_processing = True
        self.log("🚀 Sequential Scan Worker started (1 video at a time).")

        try:
            while self._queue:
                item = self._queue.pop(0)
                self._current_item = item
                item.status = "processing"

                # 1. Smart Deduplication Check
                if db.is_video_processed(item.video_id):
                    item.status = "skipped"
                    item.finished_at = time.time()
                    self._completed_in_batch += 1
                    self.log(f"⚡ [Skipped - Already in DB]: {item.title}")
                    
                    v_url = item.raw_url or (f"https://www.instagram.com/reel/{item.video_id.replace('ig_', '')}/" if item.platform == "instagram" else f"https://www.youtube.com/watch?v={item.video_id}")
                    await asyncio.to_thread(
                        db.log_scan_audit,
                        video_id=item.video_id,
                        channel_name=item.channel_name,
                        title=item.title,
                        video_url=v_url,
                        platform=item.platform,
                        published_at=item.published_at,
                        status="SKIPPED",
                        error_message="Already processed in database (deduplicated)"
                    )
                    
                    self._current_item = None
                    await asyncio.sleep(0.3)
                    continue

                self.log(f"⏳ Processing [{self._completed_in_batch + 1}/{self._total_batch_size}]: '{item.title}'...")
                item_start_time = time.time()
                
                max_attempts = 3
                success = False
                last_err = None

                for attempt in range(1, max_attempts + 1):
                    try:
                        if item.platform == "instagram":
                            # Instagram Reel / Post extraction
                            target_url = item.raw_url or f"https://www.instagram.com/reel/{item.video_id.replace('ig_', '')}/"
                            ig_data = await asyncio.to_thread(extract_instagram_post_metadata_and_audio, target_url, item.caption)
                            if not ig_data.get("success"):
                                raise RuntimeError(ig_data.get("error", "Instagram extraction failed"))

                            ch_name = item.channel_name or ig_data.get("author", "Instagram Creator")
                            item.title = ig_data.get("title", item.title)
                            if item.caption:
                                ig_data["caption"] = item.caption

                            self.log(f"🧠 Extracting stock calls with Gemini for Instagram Post/Reel '{item.title}'...")
                            summary = await asyncio.to_thread(analyze_instagram_media_with_gemini, ig_data)
                            if not summary:
                                raise RuntimeError("Gemini extraction returned empty result")

                            await asyncio.to_thread(
                                db.save_video_analysis,
                                video_id=item.video_id,
                                channel_id=item.channel_id or ig_data.get("author", ""),
                                channel_name=ch_name,
                                title=item.title,
                                published_at=item.published_at or ig_data.get("published_at", ""),
                                video_url=ig_data.get("url") or target_url,
                                market_outlook=summary.market_outlook,
                                summary_text=summary.creator_summary,
                                macro_takeaways=summary.macro_key_takeaways,
                                recommendations=summary.recommendations,
                                platform="instagram"
                            )

                        else:
                            # YouTube Video extraction
                            t_data = await asyncio.to_thread(get_video_transcript, item.video_id)
                            if not t_data.get("success"):
                                raise RuntimeError(t_data.get("error", "No transcript available"))

                            ch_name = item.channel_name or t_data.get("author", "YouTube Creator")
                            item.title = t_data.get("title", item.title)

                            if t_data.get("audio_fallback") and t_data.get("audio_path"):
                                self.log(f"🎙️ Running Gemini Audio extraction for '{item.title}' (IP-block resilient fallback)...")
                                summary = await asyncio.to_thread(
                                    analyze_instagram_media_with_gemini,
                                    {
                                        "title": item.title,
                                        "author": ch_name,
                                        "caption": f"YouTube video audio track: {item.title}",
                                        "media_path": t_data["audio_path"]
                                    }
                                )
                                # Cleanup temp audio
                                try:
                                    if os.path.exists(t_data["audio_path"]):
                                        os.remove(t_data["audio_path"])
                                except Exception:
                                    pass
                            else:
                                self.log(f"🧠 Extracting stock calls with Gemini for '{item.title}'...")
                                summary = await asyncio.to_thread(analyze_transcript_with_gemini, t_data)

                            if not summary:
                                raise RuntimeError("Gemini extraction returned empty result")

                            pub_date = item.published_at or t_data.get("published_at", "")
                            await asyncio.to_thread(
                                db.save_video_analysis,
                                video_id=item.video_id,
                                channel_id=item.channel_id,
                                channel_name=ch_name,
                                title=item.title,
                                published_at=pub_date,
                                video_url=f"https://www.youtube.com/watch?v={item.video_id}",
                                market_outlook=summary.market_outlook,
                                summary_text=summary.creator_summary,
                                macro_takeaways=summary.macro_key_takeaways,
                                recommendations=summary.recommendations,
                                platform="youtube"
                            )

                        item.status = "completed"
                        v_url = (ig_data.get("url") or target_url) if item.platform == "instagram" else f"https://www.youtube.com/watch?v={item.video_id}"
                        tickers = [r.ticker for r in summary.recommendations]
                        
                        await asyncio.to_thread(
                            db.log_scan_audit,
                            video_id=item.video_id,
                            channel_name=ch_name,
                            title=item.title,
                            video_url=v_url,
                            platform=item.platform,
                            published_at=item.published_at or (ig_data.get("published_at") if item.platform == "instagram" else t_data.get("published_at")),
                            model_used=getattr(summary, "model_used", "gemini-3.5-flash-lite"),
                            status="SUCCESS",
                            stocks_count=len(summary.recommendations),
                            tickers=tickers,
                            duration_seconds=time.time() - item_start_time
                        )
                        
                        self.log(f"✓ Extracted and saved {len(summary.recommendations)} stock calls from '{item.title}'!")
                        success = True
                        break

                    except Exception as e:
                        last_err = e
                        err_msg = str(e)
                        is_rate_limit = any(term in err_msg.lower() for term in ["429", "resource_exhausted", "quota", "too many requests", "rate limit", "blocking requests"])
                        
                        if attempt < max_attempts and is_rate_limit:
                            backoff_seconds = 15 * (2 ** (attempt - 1))  # 15s, 30s, 60s
                            self.log(f"⚠️ Rate limit detected on '{item.title}'. Exponential backoff: Waiting {backoff_seconds}s before retry (Attempt {attempt}/{max_attempts})...")
                            await asyncio.sleep(backoff_seconds)
                        else:
                            break

                if not success:
                    item.status = "failed"
                    item.error = str(last_err)
                    self.log(f"❌ Error processing '{item.title}': {str(last_err)}")
                    
                    v_url = item.raw_url or (f"https://www.instagram.com/reel/{item.video_id.replace('ig_', '')}/" if item.platform == "instagram" else f"https://www.youtube.com/watch?v={item.video_id}")
                    await asyncio.to_thread(
                        db.log_scan_audit,
                        video_id=item.video_id,
                        channel_name=item.channel_name,
                        title=item.title,
                        video_url=v_url,
                        platform=item.platform,
                        published_at=item.published_at,
                        status="FAILED",
                        error_message=str(last_err),
                        duration_seconds=time.time() - item_start_time
                    )

                item.finished_at = time.time()
                self._completed_in_batch += 1
                self._current_item = None

                # Configurable cooling period between queued videos
                if self._queue:
                    cd = self._cooldown_seconds
                    if cd > 0:
                        cd_mins = round(cd / 60, 1)
                        self.log(f"☕ Cooling period: Waiting {cd}s ({cd_mins}m) before next video...")
                        self._cooldown_end_time = time.time() + cd
                        while time.time() < self._cooldown_end_time and self._queue:
                            await asyncio.sleep(1)
                        self._cooldown_end_time = None

        except Exception as general_err:
            self.log(f"Worker exception: {general_err}")
        finally:
            self._is_processing = False
            self._total_batch_size = 0
            self._completed_in_batch = 0
            self._current_item = None
            self._cooldown_end_time = None
            self.log("🏁 All queued videos processed. Worker idle.")

    def get_queued_items(self) -> List[Dict[str, Any]]:
        """Returns currently processing and queued items for live audit inspection."""
        items = []
        if self._current_item:
            curr = asdict(self._current_item)
            curr["status"] = "PROCESSING"
            items.append(curr)
        for q in self._queue:
            q_dict = asdict(q)
            q_dict["status"] = "QUEUED"
            items.append(q_dict)
        return items

    def get_status(self) -> Dict[str, Any]:
        """Returns the current queue status for polling."""
        curr = asdict(self._current_item) if self._current_item else None
        total = self._total_batch_size
        done = self._completed_in_batch
        pct = int((done / total * 100)) if total > 0 else 0
        cd_remaining = int(max(0, self._cooldown_end_time - time.time())) if self._cooldown_end_time else 0

        msg = "Idle"
        if cd_remaining > 0 and self._queue:
            mins_left = cd_remaining // 60
            secs_left = cd_remaining % 60
            msg = f"☕ Cooling down ({mins_left}m {secs_left}s remaining before next video)..."
        elif self._is_processing and curr:
            msg = f"Analyzing video: '{curr.get('title', '')[:50]}...'"
        elif self._is_processing:
            msg = "Processing queue..."

        return {
            "is_scanning": self._is_processing,
            "queue_length": len(self._queue),
            "total_in_batch": total,
            "completed_count": done,
            "progress_percent": pct,
            "current_item": curr,
            "progress_message": msg,
            "cooldown_seconds": self._cooldown_seconds,
            "cooldown_remaining_seconds": cd_remaining,
            "logs": self._logs[-25:]
        }


# Global singleton instance
scan_queue = SequentialScanQueue()
