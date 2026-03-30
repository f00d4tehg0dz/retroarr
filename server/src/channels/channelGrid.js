'use strict';

// 7 Decades × 13 Categories = 91 unique linear TV channels
// Channel numbering: decadeIndex * 13 + categoryIndex + 1  (channels 1–91)
//   60s = 1–13, 70s = 14–26, 80s = 27–39, 90s = 40–52, 00s = 53–65, 10s = 66–78, 20s = 79–91
//   Example: 80s Cartoons = 29, 90s Commercials = 44, 20s Shows = 79
// Standalone channels (non-decade): 92–94
// Plugin channels start at 95+

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s'];

const CATEGORIES = [
  'Shows',
  'Sitcoms',
  'Cartoons',
  'Movies',
  'Commercials',
  'Drama',
  'Specials',
  'Theme Songs',
  'Trailers',
  'Bumpers',
  'Kids',
  'Documentary',
  'Talk TV',
];

// Temporarily disabled channels — no content available yet.
// Remove a channel number from this set to re-enable it.
const DISABLED_CHANNELS = new Set([
  10,  // 60s Bumpers
  11,  // 60s Kids
  12,  // 60s Documentary
  13,  // 60s Talk TV
  23,  // 70s Bumpers
  25,  // 70s Documentary
  35,  // 80s Trailers
  36,  // 80s Bumpers
  38,  // 80s Documentary
  39,  // 80s Talk TV
  48,  // 90s Trailers
  51,  // 90s Documentary
  52,  // 90s Talk TV
  57,  // 00s Commercials
  60,  // 00s Theme Songs
  61,  // 00s Trailers
  62,  // 00s Bumpers
  65,  // 00s Talk TV
  74,  // 10s Trailers
  75,  // 10s Bumpers
  77,  // 10s Documentary
  78,  // 10s Talk TV
  86,  // 20s Theme Songs
  87,  // 20s Trailers
  88,  // 20s Bumpers
  90,  // 20s Documentary
  91,  // 20s Talk TV
]);

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function buildChannelGrid() {
  const channels = [];
  DECADES.forEach((decade, di) => {
    CATEGORIES.forEach((category, ci) => {
      const channelNumber = di * 13 + ci + 1;
      if (DISABLED_CHANNELS.has(channelNumber)) return;
      channels.push({
        id: `ch-${slugify(decade)}-${slugify(category)}`,
        decade,
        category,
        channelNumber,
        name: `${decade} ${category}`,
        enabled: true,
        settings: {
          shuffle: true,
          includeCommercials: false,
        },
        cachedVideos: [],
        lastVideoSync: null,
      });
    });
  });

  // Standalone channels — span multiple decades, not part of the grid matrix
  const STANDALONE_CHANNELS = [
    { id: 'ch-classic-nickelodeon',      channelNumber: 92, name: 'Classic Nickelodeon',        category: 'Cartoons', decade: '90s' },
    { id: 'ch-saturday-morning',         channelNumber: 93, name: 'Saturday Morning Cartoons',  category: 'Cartoons', decade: '80s' },
    { id: 'ch-unsolved-mysteries',       channelNumber: 94, name: 'Unsolved Mysteries',         category: 'Shows',    decade: '80s' },
  ];

  for (const sc of STANDALONE_CHANNELS) {
    channels.push({
      ...sc,
      enabled: true,
      settings: { shuffle: true, includeCommercials: false },
      cachedVideos: [],
      lastVideoSync: null,
    });
  }

  return channels;
}

module.exports = { DECADES, CATEGORIES, buildChannelGrid };