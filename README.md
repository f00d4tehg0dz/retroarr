# RetroArr

**Self-hosted YouTube linear TV. Turn YouTube playlists into live cable TV channels organized by decade and genre, complete with HDHomeRun emulation for Plex, Jellyfin, and Emby.**

RetroArr builds a 90+ channel grid (7 decades x 13 categories) that plays 24/7 like real television. Every channel runs on a virtual clock, tune in at any time and the same video is playing for everyone, just like broadcast TV. No recording, no VOD, no on-demand. Just TV.

![RetroArr](https://github.com/f00d4tehg0dz/retroarr/blob/main/client/src/logo.png?raw=true)

---


## Features

- **90+ Live Channels** — 7 decades (60s through 20s) x 13 categories (Cartoons, Sitcoms, Movies, Comedy, Drama, and more)
- **HDHomeRun Emulation** — Detected automatically by Plex, Jellyfin, and Emby as a network tuner via SSDP
- **M3U + XMLTV EPG** — Standard playlist and electronic program guide compatible with any IPTV player
- **Virtual Clock** — Seeded shuffle algorithm ensures every viewer sees the same thing at the same time
- **24-hour EPG** — Auto-generated TV guide synced to the virtual clock
- **Plugin System** — Add custom channels beyond the grid with community-contributed or your own YAML playlists
- **Plugin Repository** — Browse and install community channel packs directly from the dashboard
- **Web Dashboard** — Manage channels, toggle categories, view the TV guide, report broken videos, and install plugins
- **TV Mode** — Full-screen CRT television UI in the browser with channel surfing (mostly demo purposes)
- **Docker Ready** — Single container with FFmpeg and yt-dlp included

---

## Self-Hosting

### Option 1: Docker (Recommended)

Create a `.env` file:

```env
DEVICE_NAME=RetroArr
STREAM_QUALITY=720p
TUNER_COUNT=4
TZ=America/New_York
```

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  retroarr:
    image: f00d4tehg0dz/retroarr:latest
    container_name: retroarr
    restart: unless-stopped
    network_mode: host
    ports:
      - "8888:8888"
      - "1900:1900/udp"
    volumes:
      - retroarr-db:/app/server/db
    env_file: .env
    environment:
      - PORT=8888
      - DB_PATH=/app/server/db/db.json

volumes:
  retroarr-db:
    driver: local
```

```bash
docker compose up -d
```

> **Linux:** Keep `network_mode: host` for SSDP discovery to work. Comment out the `ports` section.
>
> **Windows / macOS:** Comment out `network_mode: host` and uncomment the `ports` section. You'll need to manually add the tuner in your media server.

The dashboard is available at `http://localhost:8888`.

### Option 2: Manual Setup

Prerequisites: Node.js 20+, FFmpeg, yt-dlp, Python 3

```bash
# Clone the repo
git clone https://github.com/f00d4tehg0dz/retroarr.git
cd retroarr

# Install and start the server
cd server
cp .env.example .env        # Edit with your settings
npm install
npm start                    # Starts on port 8888

# Install and start the client (separate terminal)
cd client
npm install
npm run dev                  # Starts Vite dev server
```

For production, build the client and let the server serve it:

```bash
cd client
npm run build                # Outputs to ../server/public/
cd ../server
npm start                    # Serves both API and client on port 8888
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DEVICE_NAME` | `RetroArr` | Name shown in media server tuner list |
| `STREAM_QUALITY` | `720p` | YouTube stream quality (`360p`, `480p`, `720p`, `1080p`) |
| `TUNER_COUNT` | `4` | Number of simultaneous streams |
| `TZ` | `America/New_York` | Timezone for EPG schedule |
| `PORT` | `8888` | HTTP server port |
| `DB_PATH` | `./db/db.json` | Path to LowDB database file |

---

## Connecting Your Media Server

RetroArr emulates an HDHomeRun network tuner. Most media servers will auto-discover it via SSDP on your local network.

### Plex

1. Go to **Settings > Live TV & DVR**
2. Plex should auto-detect "RetroArr" as a tuner, click it to set up
3. When prompted for a guide, select **"Add Guide with XMLTV"** and enter:
   ```
   http://<your-ip>:8888/epg.xml
   ```
4. Channel scan will find all 91+ channels

If Plex doesn't auto-detect (Windows/macOS without host networking), manually enter the device URL: `http://<your-ip>:8888`

### Jellyfin

1. Go to **Dashboard > Live TV**
2. Click **Add Tuner Device** and select **"HD Homerun"**
3. Enter the tuner URL: `http://<your-ip>:8888`
4. Add a guide provider, select **"XMLTV"** and enter:
   ```
   http://<your-ip>:8888/epg.xml
   ```

### Emby

1. Go to **Settings > Live TV**
2. Click **Add Tuner** and select **"HD Homerun"**
3. Enter: `http://<your-ip>:8888`
4. Add an XMLTV guide source: `http://<your-ip>:8888/epg.xml`

### Direct M3U (Any IPTV Player)

Use the M3U playlist URL directly in VLC, IPTV Smarters, TiviMate, or any M3U-compatible player:

```
http://<your-ip>:8888/lineup.m3u
```

### RetroArr TV Mode

Open `http://<your-ip>:8888/tv` in a browser for the built-in CRT TV viewer with channel surfing.

### Endpoints Reference

| Endpoint | Description |
|---|---|
| `/discover.json` | HDHomeRun device identity |
| `/lineup.json` | Channel lineup (JSON) |
| `/lineup.m3u` | Channel lineup (M3U playlist) |
| `/epg.xml` | XMLTV electronic program guide |
| `/api/status` | Server health check |

---

## Custom Plugin Channels

RetroArr supports community-contributed channel packs via the plugin repository. Browse and install them from the **Plugins** page in the dashboard, or create your own.

### Installing Plugins

Open the dashboard and navigate to the **Plugins** page. Browse available community channels, click **Install**, and the channel appears in your lineup immediately.

### Submitting a Custom Plugin

Want to share your own channel with the community? Submit a pull request to the `plugin-repo/` directory with three files:

#### 1. YAML Playlist File

Create `plugin-repo/your-channel.yaml` with one video or playlist per line:

```
1984 - Show Name - https://www.youtube.com/playlist?list=PLxxxxxxxxx
1992 - Another Show - https://www.youtube.com/watch?v=xxxxxxxxxxx
```

#### 2. JSON Config File

Create `plugin-repo/your-channel.json`:

```json
{
  "name": "Your Channel Name",
  "channelNumber": 605,
  "yamlFile": "your-channel.yaml",
  "enabled": true,
  "settings": {
    "shuffle": true,
  }
}
```

Pick a channel number **600 or higher** that isn't already taken. Check `plugin-repo/manifest.json` for existing assignments.

#### 3. Update the Manifest

Add your plugin entry to `plugin-repo/manifest.json`:

```json
{
  "id": "your-channel",
  "name": "Your Channel Name",
  "description": "Brief description of the channel content.",
  "author": "your-github-username",
  "channelNumber": 605,
  "yamlFile": "your-channel.yaml",
  "configFile": "your-channel.json",
  "tags": ["genre", "decade", "type"],
  "icon": "📺"
}
```

#### Submission Guidelines

- Only link to publicly available YouTube content
- Use playlists when possible,  they're easier to maintain
- Test your YAML format matches the existing plugin files
- Channel numbers 100–599 are reserved for the grid,  use 600+
- Keep descriptions concise
- One channel per pull request

Open a PR against the `main` branch and it will be reviewed for inclusion.

---

## Contributing

Contributions are welcome. Here's how to get involved:

1. **Fork** the repository
2. **Create a branch** for your feature or fix (`git checkout -b feature/my-feature`)
3. **Commit** your changes with clear messages
4. **Push** to your fork and open a **Pull Request**

### Areas Where Help is Needed

- New community plugin channel playlists (packs) (see [Custom Plugin Channels](#custom-plugin-channels))
- Bug reports and fixes
- UI/UX improvements to the dashboard
- Documentation improvements
- Testing on different platforms and media servers
- Commercial/bumper video playlists (packs) (I'd like to add this!)

### Development Setup

```bash
# Server with hot reload
cd server && npm install && npm run dev

# Client with hot reload (separate terminal)
cd client && npm install && npm run dev
```

The client dev server proxies API requests to the server on port 8888.

---

## License

RetroArr is licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).

This means:

- You **can** use, modify, and distribute this software freely
- You **can** contribute improvements back to the project
- You **must** share the source code if you distribute a modified version
- You **cannot** use this code in proprietary or closed-source projects
- Any derivative work must be released under the same license

See the full license text in the [LICENSE](LICENSE) file.