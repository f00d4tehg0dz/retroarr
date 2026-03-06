'use strict';

// Plugin loader: reads JSON configs from the plugins/ directory and produces
// channel objects that merge alongside the standard DECADES × CATEGORIES grid.
//
// Each *.json file in plugins/ defines one custom channel.
// See plugins/README or the plan for the schema.

const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.resolve(__dirname, '../../../plugins');
const YAML_ROOT = path.resolve(__dirname, '../../..'); // repo root for YAML files

/**
 * Parse a YAML file (same format as import-yaml.js).
 * Returns array of { showName, url }.
 */
function parseYamlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  const entries = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('https://')) continue;

    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) continue;

    const url = urlMatch[0];
    const beforeUrl = trimmed.slice(0, trimmed.indexOf(url)).replace(/\s*-\s*$/, '').trim();
    // Strip leading year: "1991 - Doug" → "Doug"
    const showName = beforeUrl.replace(/^\d{4}s?\s*-\s*/, '').trim() || 'Untitled';

    entries.push({ showName, url });
  }

  return entries;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Load all plugin configs from plugins/*.json.
 * Returns an array of channel objects ready to merge into db.data.channels.
 */
function loadPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) return [];

  const files = fs.readdirSync(PLUGINS_DIR).filter((f) => f.endsWith('.json'));
  const channels = [];
  const usedNumbers = new Set();

  for (const file of files) {
    const filePath = path.join(PLUGINS_DIR, file);
    let config;

    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.warn(`[Plugin] Skipping ${file}: invalid JSON — ${err.message}`);
      continue;
    }

    // Validate required fields
    if (!config.name || typeof config.name !== 'string') {
      console.warn(`[Plugin] Skipping ${file}: missing "name"`);
      continue;
    }
    if (!config.channelNumber || typeof config.channelNumber !== 'number') {
      console.warn(`[Plugin] Skipping ${file}: missing or invalid "channelNumber"`);
      continue;
    }
    if (config.channelNumber < 600) {
      console.warn(`[Plugin] Skipping ${file}: channelNumber must be 600+ (got ${config.channelNumber})`);
      continue;
    }
    if (usedNumbers.has(config.channelNumber)) {
      console.warn(`[Plugin] Skipping ${file}: duplicate channelNumber ${config.channelNumber}`);
      continue;
    }
    if (!config.yamlFile || typeof config.yamlFile !== 'string') {
      console.warn(`[Plugin] Skipping ${file}: missing "yamlFile"`);
      continue;
    }

    usedNumbers.add(config.channelNumber);

    // Parse the referenced YAML file
    const yamlPath = path.resolve(YAML_ROOT, config.yamlFile);
    const videoSources = parseYamlFile(yamlPath);

    const id = `ch-plugin-${slugify(config.name)}`;

    channels.push({
      id,
      channelNumber: config.channelNumber,
      name: config.name,
      decade: null,
      category: null,
      enabled: config.enabled !== false,
      isPlugin: true,
      settings: {
        shuffle: config.settings?.shuffle !== false,
        includeCommercials: config.settings?.includeCommercials || false,
      },
      pluginConfig: {
        yamlFile: config.yamlFile,
        configFile: file,
        videoSources,
      },
      cachedVideos: [],
      lastVideoSync: null,
    });

    console.log(`[Plugin] Loaded "${config.name}" (CH ${config.channelNumber}) — ${videoSources.length} sources from ${config.yamlFile}`);
  }

  return channels;
}

/**
 * Get the list of current plugin channel IDs from disk.
 */
function getPluginIds() {
  return loadPlugins().map((ch) => ch.id);
}

module.exports = { loadPlugins, getPluginIds, parseYamlFile };