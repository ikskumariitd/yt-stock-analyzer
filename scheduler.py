import time
import logging
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger
from server import background_scan_all_channels

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("StockWatcher")


def run_scheduled_scan():
    logger.info("⏰ Triggering automated YouTube channel scan...")
    try:
        background_scan_all_channels(limit=2)
        logger.info("✓ Automated scan completed successfully.")
    except Exception as e:
        logger.error(f"❌ Scheduled scan error: {e}")


def main():
    scheduler = BlockingScheduler()
    # Check every 6 hours by default
    scheduler.add_job(
        run_scheduled_scan,
        trigger=IntervalTrigger(hours=6),
        id="youtube_channel_scan_job",
        name="Scan Subscribed Financial YouTube Channels",
        replace_existing=True
    )
    
    logger.info("🚀 YouTube Stock Watcher Scheduler started (Scanning every 6 hours). Press Ctrl+C to stop.")
    
    # Run initial scan on startup
    run_scheduled_scan()
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 Scheduler stopped.")


if __name__ == "__main__":
    main()
