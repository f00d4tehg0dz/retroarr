'use strict';

// 7 Decades × 13 Categories = 91 unique linear TV channels
// Channel numbering: (decadeIndex + 1) * 100 + (categoryIndex + 1)
//   60s = 100s, 70s = 200s, 80s = 300s, 90s = 400s, 00s = 500s, 10s = 600s, 20s = 700s
//   Example: 80s Cartoons = 303, 90s Commercials = 405, 20s Shows = 701

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
        channelNumber: (di + 1) * 100 + (ci + 1),
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