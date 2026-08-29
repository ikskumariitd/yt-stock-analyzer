import db
import server
import channel_scanner

channels = [c for c in db.get_channels() if c.get('name') in ['Moneyvest', 'BWB - Business With Brian']]
for c in channels:
    print('Scanning channel:', c['name'])
    vids = channel_scanner.get_latest_videos_from_rss(c['channel_id'], limit=2)
    for v in vids:
        print(' - Analyzing video:', v['title'], v['video_id'])
        server.execute_video_analysis(v['video_id'], c['channel_id'], c['name'], force=True)

print('Scan complete! Checking database...')
res = db.query_recommendations(limit=50)
print('Total Recommendations in DB:', res['total'])
for r in res['items']:
    print(f"[{r['channel_name']}] {r['ticker']} ({r['sentiment']}) | Entry: {r.get('buy_entry_zone')} | Target: {r.get('target_price')}")
