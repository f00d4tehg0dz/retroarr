'use strict';

// 7 Decades × 13 Categories = 91 unique linear TV channels
// Channel numbering: decadeIndex * 13 + categoryIndex + 1  (channels 1–91)
//   60s = 1–13, 70s = 14–26, 80s = 27–39, 90s = 40–52, 00s = 53–65, 10s = 66–78, 20s = 79–91
//   Example: 80s Cartoons = 29, 90s Commercials = 44, 20s Shows = 79
// Plugin channels start at 92+

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

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function buildChannelGrid() {
  const channels = [];
  DECADES.forEach((decade, di) => {
    CATEGORIES.forEach((category, ci) => {
      channels.push({
        id: `ch-${slugify(decade)}-${slugify(category)}`,
        decade,
        category,
        channelNumber: di * 13 + ci + 1,
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
  return channels;
}

module.exports = { DECADES, CATEGORIES, buildChannelGrid };