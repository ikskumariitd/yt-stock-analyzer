import os
import sys
import json
import requests
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

console = Console(force_terminal=True)
CHANNELS_FILE = Path("channels.json")


def fetch_subscriptions_via_token(access_token: str):
    """Fetch subscribed channels using a valid Google OAuth access token."""
    url = "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    channels = []
    next_page_token = None
    
    while True:
        req_url = url
        if next_page_token:
            req_url += f"&pageToken={next_page_token}"
            
        resp = requests.get(req_url, headers=headers)
        if resp.status_code != 200:
            console.print(f"[bold red]❌ YouTube API Error ({resp.status_code}):[/bold red] {resp.text}")
            return None
            
        data = resp.json()
        for item in data.get("items", []):
            snippet = item.get("snippet", {})
            title = snippet.get("title", "")
            resource_id = snippet.get("resourceId", {})
            channel_id = resource_id.get("channelId", "")
            
            channels.append({
                "name": title,
                "channel_id": channel_id,
                "url": f"https://www.youtube.com/channel/{channel_id}",
                "handle": title,
                "enabled": True
            })
            
        next_page_token = data.get("nextPageToken")
        if not next_page_token or len(channels) >= 100:
            break
            
    return channels


def save_and_display_channels(channels):
    CHANNELS_FILE.write_text(json.dumps(channels, indent=2, ensure_ascii=False), encoding="utf-8")
    table = Table(title=f"📺 Your Subscribed YouTube Channels ({len(channels)} total)", show_lines=True)
    table.add_column("#", justify="center", width=4)
    table.add_column("Channel Name", style="bold cyan", width=30)
    table.add_column("Channel URL", style="dim", width=45)

    for i, ch in enumerate(channels, 1):
        table.add_row(str(i), ch.get("name", ""), ch.get("url", ""))

    console.print(table)
    console.print(f"\n[bold green]✓ Saved {len(channels)} channels to channels.json![/bold green]")
    console.print("You can now run [bold cyan]python poc_analyzer.py --scan-all[/bold cyan] to scan them all!")


def main():
    console.print(Panel(
        "[bold green]📥 Fetch Your Subscribed YouTube Channels[/bold green]\n\n"
        "Because YouTube requires personal account authorization to list your private subscriptions,\n"
        "choose the easiest method below:",
        border_style="green"
    ))

    console.print("\n[bold yellow]Option 1: Instant Google Takeout Import (Zero Setup)[/bold yellow]")
    console.print("1. Open: [blue underline]https://takeout.google.com/[/blue underline]")
    console.print("2. Deselect all -> Select only [bold]YouTube (subscriptions)[/bold]")
    console.print("3. Download the zip (~5 sec) and get [bold]subscriptions.csv[/bold]")
    console.print("4. Run: [bold cyan]python poc_analyzer.py --import-takeout subscriptions.csv[/bold cyan]")

    console.print("\n" + "-"*70 + "\n")
    console.print("[bold yellow]Option 2: Add Favorite Channel Handles Manually[/bold yellow]")
    console.print("Run: [bold cyan]python poc_analyzer.py --add-channel @ChannelHandle[/bold cyan]")
    console.print("Example: [bold cyan]python poc_analyzer.py --add-channel @MeetKevin[/bold cyan]")

    console.print("\n" + "-"*70 + "\n")
    console.print("[bold yellow]Option 3: Quick Terminal Interactive Input[/bold yellow]")
    
    handles = console.input("\n[bold cyan]Paste channel handles or URLs separated by commas (or press Enter to skip):[/bold cyan] ").strip()
    if handles:
        items = [h.strip() for h in handles.split(",") if h.strip()]
        existing = []
        if CHANNELS_FILE.exists():
            try:
                existing = json.loads(CHANNELS_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass
        
        urls = {c.get("url") for c in existing}
        for item in items:
            target = item if item.startswith("http") else (f"https://www.youtube.com/{item}" if item.startswith("@") else f"https://www.youtube.com/@{item}")
            if target not in urls:
                existing.append({
                    "name": item,
                    "handle": item,
                    "url": target,
                    "enabled": True
                })
                urls.add(target)
        
        save_and_display_channels(existing)


if __name__ == "__main__":
    main()
