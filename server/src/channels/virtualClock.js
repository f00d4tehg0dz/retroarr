'use strict';

// The Virtual Clock is the heart of the "live TV" illusion.
//
// For any channel at any point in time it answers:
//   "Which video is playing right now, and how many seconds in?"
//
// How it works:
//   1. START_EPOCH is a fixed Unix ms timestamp stored in LowDB (set on first boot).
//      All 75 channels share this same reference point.
//   2. The channel's cachedVideos[] are shuffled using a daily seed.
//   3. We loop the shuffled playlist and calculate elapsed time since START_EPOCH.
//   4. posInCycle = (targetTime - START_EPOCH) % totalPlaylistDuration
//   5. Walk the shuffled list to find which video + offset we're in.
//
// Day boundaries:
//   When a video spans midnight the day seed changes. We use the seed from the
//   day the current cycle started (when posInCycle rolled over to 0) to keep
//   the playlist consistent for the full cycle.

const { seededShuffle, buildSeed, getDaySeed } = require('./seededShuffle');

// Get the start epoch from LowDB (avoids circular dependency at require time)
function getStartEpoch() {
  const { getDb } = require('../db/lowdb');
  return getDb().data.startEpoch || 0;
}

/**
 * Returns the current playhead state for a channel.
 *
 * @param {object} channel — LowDB channel object with cachedVideos[]
 * @param {number} [targetTime] — Unix ms timestamp (defaults to now)
 * @returns {{ video, seekSeconds, videoIndex, shuffledList } | null}
 */
function getPlayheadForChannel(channel, targetTime) {
  const now = targetTime !== undefined ? targetTime : Date.now();
  const videos = channel.cachedVideos;

  if (!videos || videos.length === 0) return null;

  const startEpoch = getStartEpoch();
  if (!startEpoch) return null;

  // Total playlist duration in ms (skip videos with no duration)
  const validVideos = videos.filter((v) => v.duration > 0);
  if (validVideos.length === 0) return null;

  const seed = buildSeed(channel.id, now);
  const shuffled = seededShuffle(validVideos, seed);

  const totalDurationMs = shuffled.reduce((sum, v) => sum + v.duration * 1000, 0);
  if (totalDurationMs === 0) return null;

  const elapsed = now - startEpoch;
  if (elapsed < 0) return null;

  const posInCycle = elapsed % totalDurationMs;

  let acc = 0;
  for (let i = 0; i < shuffled.length; i++) {
    const durMs = shuffled[i].duration * 1000;
    if (posInCycle < acc + durMs) {
      return {
        video: shuffled[i],
        seekSeconds: Math.floor((posInCycle - acc) / 1000),
        videoIndex: i,
        shuffledList: shuffled,
      };
    }
    acc += durMs;
  }

  // Fallback (rounding edge case) — return first video, no seek
  return {
    video: shuffled[0],
    seekSeconds: 0,
    videoIndex: 0,
    shuffledList: shuffled,
  };
}

/**
 * Returns the upcoming program queue for a channel starting at targetTime.
 * Used to build the playback queue in streamManager and the EPG lookahead.
 *
 * @param {object} channel
 * @param {number} [targetTime]
 * @param {number} [count] — how many upcoming videos to return
 * @returns {Array<{ video, seekSeconds }>}
 */
function getUpcomingQueue(channel, targetTime, count) {
  count = count || 10;
  const now = targetTime !== undefined ? targetTime : Date.now();

  const playhead = getPlayheadForChannel(channel, now);
  if (!playhead) return [];

  const { shuffledList, videoIndex, seekSeconds } = playhead;
  const queue = [{ video: playhead.video, seekSeconds }];

  for (let i = 1; i < count; i++) {
    const idx = (videoIndex + i) % shuffledList.length;
    queue.push({ video: shuffledList[idx], seekSeconds: 0 });
  }

  return queue;
}

module.exports = { getPlayheadForChannel, getUpcomingQueue };