'use strict';

// Deterministic Fisher-Yates shuffle using Mulberry32 PRNG.
//
// This module is shared by virtualClock.js and epg/generator.js.
// CRITICAL: Both must produce identical orderings for the same inputs
// or the EPG guide will show different programs than what actually plays.
//
// Seed strategy:
//   seed = `${channelId}-${getDaySeed(timestamp)}`
//   getDaySeed returns a number that changes once per day at midnight UTC
//   → same channel on same calendar day always produces the same ordering
//   → different days produce different orderings (fresh feeling)

// Mulberry32 — fast 32-bit seeded PRNG, zero dependencies.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// djb2 string hash → 32-bit unsigned integer
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Returns a day index (days since Unix epoch) that is stable for 24h
function getDaySeed(timestamp) {
  return Math.floor(timestamp / (24 * 60 * 60 * 1000));
}

// Deterministic Fisher-Yates shuffle.
// Does NOT mutate the input array — returns a new array.
function seededShuffle(array, seedString) {
  const rand = mulberry32(hashString(seedString));
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// Build the seed string for a channel at a given timestamp.
// Call this the same way in virtualClock AND epg/generator.
function buildSeed(channelId, timestamp) {
  return `${channelId}-${getDaySeed(timestamp)}`;
}

module.exports = { seededShuffle, buildSeed, getDaySeed };