import os
import sys
import argparse
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.markdown import Markdown

from schema import VideoStockSummary, StockRecommendation
from transcript_extractor import extract_video_id, get_video_transcript
from channel_scanner import get_channel_id_from_url, get_latest_videos_from_rss
from analyzer import analyze_transcript_with_gemini, get_default_model

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()
console = Console(force_terminal=True)


def get_sentiment_style(sentiment: str) -> str:
    s = sentiment.upper()
    if "STRONG_BUY" in s:
        return "bold green on black"
    elif "BUY" in s or "ACCUMULATE" in s:
        return "bold green"
    elif "WATCHLIST" in s or "HOLD" in s:
        return "bold yellow"
    elif "SELL" in s or "AVOID" in s:
        return "bold red"
    return "cyan"


def display_video_summary(summary: VideoStockSummary, video_url: str):
    console.print()
    console.print(Panel(
        f"[bold cyan]🎬 Video:[/bold cyan] {summary.video_title}\n"
        f"[bold cyan]🌐 Market Bias:[/bold cyan] {summary.market_outlook}\n"
        f"[bold cyan]📝 Overview:[/bold cyan] {summary.creator_summary}",
        title="[bold yellow]✨ Gemini Stock Intelligence Summary[/bold yellow]",
        border_style="cyan"
    ))

    if not summary.recommendations:
        console.print("[yellow]ℹ️ No specific stock recommendations found in this video.[/yellow]")
        return

    # Build Rich Table
    table = Table(title=f"📊 Stock Calls & Levels ({len(summary.recommendations)} detected)", show_lines=True)
    table.add_column("Ticker / Asset", style="bold white", width=16)
    table.add_column("Action / Sentiment", justify="center", width=14)
    table.add_column("Buy Zone / Entry", style="green", width=18)
    table.add_column("Target Price", style="cyan", width=16)
    table.add_column("Stop Loss", style="red", width=14)
    table.add_column("Horizon", style="magenta", width=12)
    table.add_column("Timestamp", justify="center", width=10)

    for rec in summary.recommendations:
        style = get_sentiment_style(rec.sentiment)
        ticker_display = f"{rec.ticker}\n[dim]({rec.company_name})[/dim]"
        sentiment_display = f"[{style}]{rec.sentiment}[/{style}]\n[dim]{rec.strategy_type}[/dim]"
        buy_display = rec.buy_entry_zone or "Market Price"
        target_display = rec.target_price or "N/A"
        stop_loss_display = rec.stop_loss or "N/A"
        horizon_display = rec.time_horizon or "N/A"
        time_ref = rec.timestamp_reference or "—"

        table.add_row(
            ticker_display,
            sentiment_display,
            buy_display,
            target_display,
            stop_loss_display,
            horizon_display,
            time_ref,
        )

    console.print(table)

    # Detailed Cards for Each Stock
    console.print("\n[bold underline]🔍 Deep Dive Theses & Catalysts:[/bold underline]")
    for i, rec in enumerate(summary.recommendations, 1):
        reasons = "\n".join([f"  • {r}" for r in rec.thesis_and_catalysts]) if rec.thesis_and_catalysts else "  • No specific catalysts stated"
        risks = "\n".join([f"  ⚠️ {r}" for r in rec.risk_factors]) if rec.risk_factors else "  • No major risks noted"
        quote = f"\n[dim italic]\"{rec.quote_excerpt}\"[/dim italic]" if rec.quote_excerpt else ""

        card_content = (
            f"[bold]{rec.company_name} ({rec.ticker})[/bold] — [{get_sentiment_style(rec.sentiment)}]{rec.sentiment}[/{get_sentiment_style(rec.sentiment)}]\n"
            f"[bold]Entry Strategy:[/bold] {rec.buy_entry_zone} | [bold]Target:[/bold] {rec.target_price or 'N/A'} | [bold]Stop Loss:[/bold] {rec.stop_loss or 'N/A'}\n"
            f"[bold]Catalysts & Rationale:[/bold]\n{reasons}\n"
            f"[bold]Key Risks:[/bold]\n{risks}"
            f"{quote}"
        )
        console.print(Panel(card_content, border_style="blue", title=f"#{i} {rec.ticker} Details"))


def save_markdown_report(summary: VideoStockSummary, video_url: str, video_id: str) -> str:
    reports_dir = Path("reports")
    reports_dir.mkdir(exist_ok=True)
    
    filename = f"report_{video_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    filepath = reports_dir / filename

    md_lines = [
        f"# Stock Analysis Report: {summary.video_title}",
        f"- **Video URL:** [{video_url}]({video_url})",
        f"- **Analysis Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- **Market Outlook:** {summary.market_outlook}",
        f"\n## Executive Summary\n{summary.creator_summary}\n",
        "## Stock Recommendations & Key Levels\n",
        "| Ticker | Company | Action | Buy Zone | Target Price | Stop Loss | Time Horizon | Timestamp |",
        "|---|---|---|---|---|---|---|---|",
    ]

    for rec in summary.recommendations:
        time_link = f"[{rec.timestamp_reference}]({video_url})" if rec.timestamp_reference else "N/A"
        md_lines.append(
            f"| **{rec.ticker}** | {rec.company_name} | `{rec.sentiment}` | {rec.buy_entry_zone} | {rec.target_price or 'N/A'} | {rec.stop_loss or 'N/A'} | {rec.time_horizon} | {time_link} |"
        )

    md_lines.append("\n## Detailed Breakdown by Asset\n")
    for rec in summary.recommendations:
        md_lines.append(f"### {rec.ticker} — {rec.company_name} (`{rec.sentiment}`)")
        md_lines.append(f"- **Strategy:** {rec.strategy_type}")
        md_lines.append(f"- **Buy / Entry Zone:** {rec.buy_entry_zone}")
        md_lines.append(f"- **Target Price:** {rec.target_price or 'N/A'}")
        md_lines.append(f"- **Stop Loss:** {rec.stop_loss or 'N/A'}")
        md_lines.append(f"- **Time Horizon:** {rec.time_horizon}")
        md_lines.append("\n**Catalysts & Thesis:**")
        for cat in rec.thesis_and_catalysts:
            md_lines.append(f"- {cat}")
        if rec.risk_factors:
            md_lines.append("\n**Risks:**")
            for risk in rec.risk_factors:
                md_lines.append(f"- {risk}")
        if rec.quote_excerpt:
            md_lines.append(f"\n> *\"{rec.quote_excerpt}\"* (at {rec.timestamp_reference or 'video'})\n")
        md_lines.append("---")

    if summary.macro_key_takeaways:
        md_lines.append("\n## Macro Insights & Market Takeaways")
        for takeaway in summary.macro_key_takeaways:
            md_lines.append(f"- {takeaway}")

    filepath.write_text("\n".join(md_lines), encoding="utf-8")
    return str(filepath)


def generate_mock_summary(title: str, author: str) -> VideoStockSummary:
    """Generate a realistic mock extraction for dry-run demonstration."""
    return VideoStockSummary(
        video_title=title,
        market_outlook="Cautiously Bullish on AI Infrastructure, Bearish on legacy advertising",
        creator_summary=f"In this analysis, {author} highlights high conviction growth plays and warns against overvalued software peers, providing specific accumulation zones for long-term swing positions.",
        recommendations=[
            StockRecommendation(
                ticker="NVDA",
                company_name="NVIDIA Corporation",
                market="US",
                sentiment="BUY",
                strategy_type="SWING_TRADE",
                current_price_mentioned="$124.50",
                buy_entry_zone="$118.00 - $122.00 (Pullback to 20 EMA)",
                target_price="$148.00 (+22% upside)",
                stop_loss="Daily close below $114.00",
                time_horizon="1-3 Months",
                thesis_and_catalysts=[
                    "Blackwell architecture volume ramp exceeding expectations",
                    "Hyperscaler CapEx guidance revised upwards by 15%",
                    "Strong support consolidating at $118 level"
                ],
                risk_factors=[
                    "Potential short-term margin compression during chip transition",
                    "Geopolitical trade restrictions"
                ],
                timestamp_reference="02:45",
                quote_excerpt="I am waiting for any dip into the $120 range to aggressively add to my swing position targeting $148."
            ),
            StockRecommendation(
                ticker="TTD",
                company_name="The Trade Desk Inc.",
                market="US",
                sentiment="WATCHLIST",
                strategy_type="VALUE_BUY",
                current_price_mentioned="$78.20",
                buy_entry_zone="Under $70.00 or post-earnings reset",
                target_price="$95.00",
                stop_loss="None stated",
                time_horizon="6-12 Months",
                thesis_and_catalysts=[
                    "Connected TV (CTV) ad market share expansion",
                    "UID2 adoption accelerating across top publishers"
                ],
                risk_factors=[
                    "Valuation multiple remains rich compared to broad ad sector"
                ],
                timestamp_reference="06:15",
                quote_excerpt="I love the business model, but I would not chase it here at 80 bucks. Look for under 70."
            )
        ],
        macro_key_takeaways=[
            "Tech earnings season showing bifurcated results; hardware outpacing software",
            "Fed interest rate path expected to favor high free-cash-flow large caps"
        ]
    )


def process_single_video(url_or_id: str, model_name: str = "gemini-2.5-flash", mock: bool = False):
    video_id = extract_video_id(url_or_id)
    if not video_id:
        console.print(f"[bold red]❌ Invalid YouTube video URL or ID: {url_or_id}[/bold red]")
        return None

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    console.print(f"\n[cyan]📥 Fetching transcript for video ID:[/cyan] [bold]{video_id}[/bold]...")
    transcript_data = get_video_transcript(video_id)

    if not transcript_data.get("success") and not mock:
        console.print(f"[bold red]❌ Transcript Error:[/bold red] {transcript_data.get('error')}")
        return None

    title = transcript_data.get("title", f"YouTube Video {video_id}")
    author = transcript_data.get("author", "Creator")
    
    if transcript_data.get("success"):
        console.print(f"[green]✓ Transcript fetched successfully ({len(transcript_data.get('full_text', '').split())} words)![/green]")
    
    console.print(f"[bold]Title:[/bold] {title}")
    console.print(f"[bold]Channel:[/bold] {author}")

    if mock:
        console.print(f"\n[bold magenta]🧪 Running in MOCK DEMO Mode (simulating Gemini response)...[/bold magenta]")
        summary = generate_mock_summary(title, author)
    else:
        console.print(f"\n[magenta]🤖 Analyzing with Gemini ({model_name}) for stock calls & price levels...[/magenta]")
        try:
            summary = analyze_transcript_with_gemini(transcript_data, model_name=model_name)
        except Exception as e:
            console.print(f"[bold red]❌ Gemini Analysis Error:[/bold red] {str(e)}")
            return None

    display_video_summary(summary, video_url)
    
    # Save report
    report_path = save_markdown_report(summary, video_url, video_id)
    console.print(f"\n[bold green]💾 Markdown report saved to:[/bold green] [underline]{report_path}[/underline]")
    return summary


def process_channel(channel_url: str, limit: int = 3, model_name: str = "gemini-2.5-flash", mock: bool = False):
    console.print(f"\n[cyan]🔍 Resolving channel:[/cyan] [bold]{channel_url}[/bold]...")
    channel_id = get_channel_id_from_url(channel_url)
    if not channel_id:
        console.print(f"[bold red]❌ Could not resolve channel ID from: {channel_url}[/bold red]")
        return

    console.print(f"[green]✓ Found Channel ID:[/green] [bold]{channel_id}[/bold]")
    console.print(f"[cyan]📡 Fetching latest {limit} videos via RSS feed...[/cyan]")
    videos = get_latest_videos_from_rss(channel_id, limit=limit)

    if not videos:
        console.print(f"[yellow]⚠️ No videos found for this channel.[/yellow]")
        return

    console.print(f"[bold green]Found {len(videos)} recent videos from {videos[0].get('channel_name')}:[/bold green]\n")
    for i, v in enumerate(videos, 1):
        console.print(f"  {i}. [bold]{v['title']}[/bold] ({v['published'][:10]}) -> {v['url']}")

    console.print("\n" + "="*70 + "\n")
    for i, v in enumerate(videos, 1):
        console.print(f"[bold yellow]▶ Processing Video {i}/{len(videos)}: {v['title']}[/bold yellow]")
        process_single_video(v['video_id'], model_name=model_name, mock=mock)
        console.print("\n" + "-"*70 + "\n")


from channel_subscriptions import (
    load_configured_channels,
    save_configured_channels,
    add_channel,
    import_from_google_takeout_csv,
    import_from_text_file
)


def list_subscribed_channels():
    channels = load_configured_channels()
    if not channels:
        console.print("[yellow]No channels configured yet. Add one with --add-channel <handle/url>[/yellow]")
        return

    table = Table(title=f"📺 Monitored Subscribed Channels ({len(channels)} total)", show_lines=True)
    table.add_column("#", justify="center", width=4)
    table.add_column("Channel Name / Handle", style="bold cyan", width=25)
    table.add_column("URL / Target", style="dim", width=45)
    table.add_column("Status", justify="center", width=10)

    for i, ch in enumerate(channels, 1):
        status = "[green]ACTIVE[/green]" if ch.get("enabled", True) else "[dim red]DISABLED[/dim red]"
        name = ch.get("handle") or ch.get("name") or ch.get("url")
        table.add_row(str(i), name, ch.get("url", ""), status)

    console.print(table)


def scan_all_subscribed_channels(limit: int = 2, model_name: str = "gemini-3.7-flash", mock: bool = False):
    channels = load_configured_channels()
    if not channels:
        console.print("[bold red]❌ No subscribed channels found in channels.json![/bold red]")
        console.print("Add channels with: [cyan]python poc_analyzer.py --add-channel @MeetKevin[/cyan]")
        return

    console.print(Panel(
        f"[bold green]🚀 Scanning {len(channels)} Subscribed Channels (Latest {limit} videos each)[/bold green]\n"
        f"[dim]Model: {model_name} | Mock: {mock}[/dim]",
        border_style="green"
    ))

    for i, ch in enumerate(channels, 1):
        if not ch.get("enabled", True):
            continue
        channel_target = ch.get("url") or ch.get("handle")
        console.print(f"\n[bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")
        console.print(f"[bold yellow]📺 [{i}/{len(channels)}] Scanning Channel: {ch.get('name', channel_target)}[/bold yellow]")
        console.print(f"[bold cyan]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold cyan]")
        process_channel(channel_target, limit=limit, model_name=model_name, mock=mock)


def main():
    parser = argparse.ArgumentParser(description="YouTube Stock Recommendation Extractor using Gemini")
    parser.add_argument("--url", "-u", type=str, help="YouTube video URL or Video ID")
    parser.add_argument("--channel", "-c", type=str, help="YouTube Channel URL, handle (@Channel), or Channel ID")
    parser.add_argument("--limit", "-l", type=int, default=2, help="Max recent videos to scan per channel (default: 2)")
    parser.add_argument("--model", "-m", type=str, default=get_default_model(), help=f"Gemini model to use (default: {get_default_model()})")
    parser.add_argument("--mock", action="store_true", help="Run in mock demo mode without needing an API key")
    parser.add_argument("--list-channels", action="store_true", help="List all configured/subscribed channels")
    parser.add_argument("--add-channel", type=str, help="Add a channel URL or @handle to the monitored subscription list")
    parser.add_argument("--scan-all", action="store_true", help="Scan the latest videos from ALL configured subscribed channels")
    parser.add_argument("--import-takeout", type=str, help="Import Google Takeout subscriptions CSV file")
    
    args = parser.parse_args()

    # Channel management commands
    if args.list_channels:
        list_subscribed_channels()
        return

    if args.add_channel:
        success, msg = add_channel(args.add_channel)
        if success:
            console.print(f"[bold green]✓ {msg}[/bold green]")
        else:
            console.print(f"[yellow]ℹ️ {msg}[/yellow]")
        list_subscribed_channels()
        return

    if args.import_takeout:
        try:
            channels = import_from_google_takeout_csv(args.import_takeout)
            console.print(f"[bold green]✓ Successfully imported {len(channels)} channels from Google Takeout![/bold green]")
            list_subscribed_channels()
        except Exception as e:
            console.print(f"[bold red]❌ Import Error:[/bold red] {e}")
        return

    if args.scan_all:
        scan_all_subscribed_channels(limit=args.limit, model_name=args.model, mock=args.mock)
        return

    # Check API key if not mock
    if not os.getenv("GEMINI_API_KEY") and not args.mock:
        console.print(Panel(
            "[bold red]⚠️ GEMINI_API_KEY is not set in environment or .env file![/bold red]\n\n"
            "To analyze with live AI, add to [bold cyan].env[/bold cyan]:\n"
            "[green]GEMINI_API_KEY=your_gemini_api_key_here[/green]\n\n"
            "💡 [yellow]Tip:[/yellow] Run with [bold cyan]--mock[/bold cyan] to test the visual dashboard & report generation without an API key.",
            title="Configuration Notice",
            border_style="yellow"
        ))

    if args.url:
        process_single_video(args.url, model_name=args.model, mock=args.mock)
    elif args.channel:
        process_channel(args.channel, limit=args.limit, model_name=args.model, mock=args.mock)
    else:
        # Interactive mode
        console.print(Panel(
            "[bold green]📈 YouTube Stock Recommendation Scanner (Gemini POC)[/bold green]\n\n"
            "Options:\n"
            " 1. Enter a [bold cyan]YouTube Video URL[/bold cyan]\n"
            " 2. Enter a [bold cyan]Channel Handle[/bold cyan] (e.g., @MeetKevin, @pranjalkamra)\n"
            " 3. Type [bold yellow]'all'[/bold yellow] to scan ALL subscribed channels in channels.json\n"
            " 4. Type [bold yellow]'list'[/bold yellow] to view your subscribed channels\n"
            " 5. Type [bold red]'exit'[/bold red] to quit.",
            border_style="green"
        ))
        
        choice = console.input("\n[bold yellow]Enter command or URL:[/bold yellow] ").strip()
        if choice.lower() in ["exit", "quit", "q"]:
            return
        elif choice.lower() == "list":
            list_subscribed_channels()
        elif choice.lower() == "all":
            scan_all_subscribed_channels(limit=args.limit, model_name=args.model, mock=args.mock)
        elif "@" in choice or "channel" in choice or "youtube.com/c/" in choice:
            process_channel(choice, limit=args.limit, model_name=args.model, mock=args.mock)
        else:
            process_single_video(choice, model_name=args.model, mock=args.mock)


if __name__ == "__main__":
    main()
