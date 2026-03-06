'use strict';

// GET /playlist.m3u
// M3U playlist for Jellyfin/Emby/VLC users who prefer manual IPTV import
// over HDHomeRun emulation. Contains all enabled channels.

const express = require('express');
const router = express.Router();
const config = require('../config');
const { getDb } = require('../db/lowdb');

router.get('/playlist.m3u', (req, res) => {
  const db = getDb();
  const hostIp = config.getLocalIp();

  const enabledChannels = db.data.channels.filter((ch) => ch.enabled);

  let m3u = '#EXTM3U x-tvg-url="http://' + hostIp + ':' + config.port + '/epg.xml"\n\n';

  for (const ch of enabledChannels) {
    m3u += `#EXTINF:-1 tvg-id="ch${ch.channelNumber}" tvg-name="${ch.name}" tvg-chno="${ch.channelNumber}" group-title="${ch.decade}",${ch.name}\n`;
    m3u += `http://${hostIp}:${config.port}/stream/${ch.id}\n\n`;
  }

  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.setHeader('Content-Disposition', 'attachment; filename="retroarr.m3u"');
  res.send(m3u);
});

module.exports = router;