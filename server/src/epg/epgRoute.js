'use strict';

// GET /epg.xml
// Returns XMLTV EPG data for all enabled channels.
// Configure this URL as the EPG source in Plex/Jellyfin/Emby.

const express = require('express');
const router = express.Router();
const epgGenerator = require('./generator');
const { getDb } = require('../db/lowdb');

router.get('/epg.xml', (req, res) => {
  const db = getDb();
  const xml = epgGenerator.getXMLTV(db.data.channels);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

module.exports = router;