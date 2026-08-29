import os
import sys
import time
import asyncio
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict

import db
from transcript_extractor import get_video_transcript
from analyzer import analyze_transcript_with_gemini

logger = logging.getLogger("scan_queue")


@dataclass
class QueueItem:
    video_id: str
    channel_id: str = ""
    channel_name: str = ""
    title: str = ""
    published_at: str = ""
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

    def log(self, message: str):
        timestamp = time.strftime("%H:%M:%S")
        log_line = f"[{timestamp}] {message}"
        self._logs.append(log_line)
        if len(self._logs) > 60:
            self._logs.pop(0)
        print(log_line)

    def enqueue_video(self, video_id: str, channel_id: str = "", channel_name: str = "", title: str = "", published_at: str = "") -> bool:
        """Enqueue a single video if not already queued."""
        if any(item.video_id == video_id for item in self._queue):
            return False
        if self._current_item and self._current_item.video_id == video_id:
            return False

        item = QueueItem(
            video_id=video_id,
            channel_id=channel_id,
            channel_name=channel_name,
            title=title or f"Video {video_id}",
            published_at=published_at
        )
        self._queue.append(item)
        self._total_batch_size += 1
        self.log(f"📥 Enqueued: {item.title} ({video_id})")
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
                    self._current_item = None
                    await asyncio.sleep(0.3)
                    continue

                self.log(f"⏳ Processing [{self._completed_in_batch + 1}/{self._total_batch_size}]: '{item.title}'...")

                # 2. Fetch Transcript
                try:
                    t_data = await asyncio.to_thread(get_video_transcript, item.video_id)
                    if not t_data.get("success"):
                        item.status = "failed"
                        item.error = t_data.get("error", "No transcript available")
                        self.log(f"⚠️ Transcript unavailable for '{item.title}': {item.error}")
                    else:
                        ch_name = item.channel_name or t_data.get("author", "YouTube Creator")
                        item.title = t_data.get("title", item.title)

                        # 3. Gemini Extraction
                        self.log(f"🧠 Extracting stock calls with Gemini for '{item.title}'...")
                        summary = await asyncio.to_thread(analyze_transcript_with_gemini, t_data)

                        # 4. Save to SQLite
                        await asyncio.to_thread(
                            db.save_video_analysis,
                            video_id=item.video_id,
                            channel_id=item.channel_id,
                            channel_name=ch_name,
                            title=item.title,
                            published_at=item.published_at or t_data.get("published_at", ""),
                            video_url=f"https://www.youtube.com/watch?v={item.video_id}",
                            market_outlook=summary.market_outlook,
                            summary_text=summary.creator_summary,
                            macro_takeaways=summary.macro_key_takeaways,
                            recommendations=summary.recommendations
                        )

                        item.status = "completed"
                        self.log(f"✓ Extracted and saved {len(summary.recommendations)} stock calls from '{item.title}'!")

                except Exception as e:
                    item.status = "failed"
                    item.error = str(e)
                    self.log(f"❌ Error processing '{item.title}': {str(e)}")

                item.finished_at = time.time()
                self._completed_in_batch += 1
                self._current_item = None

                # 5. Free-Tier 3s Cooldown between videos
                if self._queue:
                    self.log("☕ Cooldown 3s before next video (Free Tier safe)...")
                    await asyncio.sleep(3)

        except Exception as general_err:
            self.log(f"Worker exception: {general_err}")
        finally:
            self._is_processing = False
            self._total_batch_size = 0
            self._completed_in_batch = 0
            self._current_item = None
            self.log("🏁 All queued videos processed. Worker idle.")

    def get_status(self) -> Dict[str, Any]:
        """Return comprehensive status for frontend UI."""
        total = self._total_batch_size
        completed = self._completed_in_batch
        percent = (completed / total * 100) if total > 0 else 0.0

        return {
            "is_scanning": self._is_processing or len(self._queue) > 0,
            "current_item": asdict(self._current_item) if self._current_item else None,
            "pending_count": len(self._queue),
            "completed_count": completed,
            "total_in_batch": total,
            "progress_percent": round(percent, 1),
            "queue_items": [asdict(item) for item in self._queue[:10]],
            "logs": self._logs[-25:]
        }


# Global singleton queue
scan_queue = SequentialScanQueue()
