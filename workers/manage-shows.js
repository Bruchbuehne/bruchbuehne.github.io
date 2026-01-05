#!/usr/bin/env node

/**
 * Simple CLI tool to manage shows in Cloudflare KV
 *
 * Usage:
 *   node manage-shows.js init
 *   node manage-shows.js list
 *   node manage-shows.js add "Title" "YYYY-MM-DD HH:MM" "Location" capacity
 *   node manage-shows.js update SHOW_ID --capacity 60
 *   node manage-shows.js delete SHOW_ID
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';

const KV_NAMESPACE_NAME = 'RESERVATIONS';
const KV_KEY = 'shows';

// Get KV namespace ID from wrangler.toml
function getKVNamespaceId() {
  try {
    const toml = readFileSync('./wrangler.toml', 'utf-8');
    const match = toml.match(/id\s*=\s*["']([^"']+)["']/);
    if (!match) {
      console.error('❌ Could not find KV namespace ID in wrangler.toml');
      console.error('   Make sure you have run: wrangler kv:namespace create "RESERVATIONS"');
      process.exit(1);
    }
    return match[1];
  } catch (error) {
    console.error('❌ Error reading wrangler.toml:', error.message);
    process.exit(1);
  }
}

// Execute wrangler KV command
function kvGet() {
  const namespaceId = getKVNamespaceId();
  try {
    const result = execSync(
      `wrangler kv key get "${KV_KEY}" --namespace-id="${namespaceId}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(result);
  } catch (error) {
    // Key doesn't exist yet
    return [];
  }
}

function kvPut(shows) {
  const namespaceId = getKVNamespaceId();
  const json = JSON.stringify(shows, null, 2);

  // Write to temp file and use it (safer than passing large JSON on command line)
  const tmpFile = '/tmp/shows.json';
  writeFileSync(tmpFile, json);

  try {
    execSync(
      `wrangler kv key put "${KV_KEY}" --path="${tmpFile}" --namespace-id="${namespaceId}"`,
      { encoding: 'utf-8', stdio: 'inherit' }
    );
    unlinkSync(tmpFile);
  } catch (error) {
    unlinkSync(tmpFile);
    throw error;
  }
}

// Format date for German locale
function formatGermanDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Generate show ID from date
function generateShowId(dateString) {
  // Format: YYYY-MM-DD-HH:MM
  return dateString.replace(' ', '-');
}

// Commands

function init() {
  console.log('🎭 Initializing shows with Die Nashörner...\n');

  const shows = [
    {
      id: '2025-07-07-19:00',
      title: 'Die Nashörner',
      date: '2025-07-07 19:00:00',
      dateFormatted: formatGermanDate('2025-07-07 19:00:00'),
      location: 'Bruchbühne Tübingen',
      capacity: 50,
      reserved: 0
    },
    {
      id: '2025-07-08-19:00',
      title: 'Die Nashörner',
      date: '2025-07-08 19:00:00',
      dateFormatted: formatGermanDate('2025-07-08 19:00:00'),
      location: 'Bruchbühne Tübingen',
      capacity: 50,
      reserved: 0
    },
    {
      id: '2025-07-10-19:00',
      title: 'Die Nashörner',
      date: '2025-07-10 19:00:00',
      dateFormatted: formatGermanDate('2025-07-10 19:00:00'),
      location: 'Bruchbühne Tübingen',
      capacity: 50,
      reserved: 0
    },
    {
      id: '2025-07-11-19:00',
      title: 'Die Nashörner',
      date: '2025-07-11 19:00:00',
      dateFormatted: formatGermanDate('2025-07-11 19:00:00'),
      location: 'Bruchbühne Tübingen',
      capacity: 50,
      reserved: 0
    }
  ];

  kvPut(shows);
  console.log('✅ Initialized 4 shows for Die Nashörner (July 2025)');
  console.log('\nRun "node manage-shows.js list" to see them');
}

function list() {
  const shows = kvGet();

  if (shows.length === 0) {
    console.log('📭 No shows found. Run "node manage-shows.js init" to initialize.');
    return;
  }

  console.log('🎭 Shows:\n');
  console.log('ID'.padEnd(20) + 'Title'.padEnd(25) + 'Date'.padEnd(35) + 'Location'.padEnd(30) + 'Capacity  Reserved  Available');
  console.log('─'.repeat(145));

  shows.forEach(show => {
    const available = show.capacity - (show.reserved || 0);
    console.log(
      show.id.padEnd(20) +
      show.title.padEnd(25) +
      show.dateFormatted.padEnd(35) +
      (show.location || 'N/A').padEnd(30) +
      String(show.capacity).padEnd(10) +
      String(show.reserved || 0).padEnd(10) +
      String(available)
    );
  });

  console.log(`\nTotal: ${shows.length} shows`);
}

function add(title, dateTime, location, capacity) {
  if (!title || !dateTime || !location || !capacity) {
    console.error('❌ Usage: node manage-shows.js add "Title" "YYYY-MM-DD HH:MM" "Location" capacity');
    console.error('   Example: node manage-shows.js add "Die Nashörner" "2025-07-07 19:00" "Bruchbühne Tübingen" 50');
    process.exit(1);
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
  if (!dateRegex.test(dateTime)) {
    console.error('❌ Invalid date format. Use: YYYY-MM-DD HH:MM');
    console.error('   Example: 2025-07-07 19:00');
    process.exit(1);
  }

  const capacityNum = parseInt(capacity);
  if (isNaN(capacityNum) || capacityNum < 1) {
    console.error('❌ Capacity must be a positive number');
    process.exit(1);
  }

  const shows = kvGet();
  const showId = generateShowId(dateTime);

  // Check if show already exists
  if (shows.find(s => s.id === showId)) {
    console.error(`❌ Show with ID "${showId}" already exists`);
    console.error('   Use "update" to modify existing shows');
    process.exit(1);
  }

  const newShow = {
    id: showId,
    title,
    date: dateTime + ':00', // Add seconds
    dateFormatted: formatGermanDate(dateTime + ':00'),
    location,
    capacity: capacityNum,
    reserved: 0
  };

  shows.push(newShow);

  // Sort by date
  shows.sort((a, b) => new Date(a.date) - new Date(b.date));

  kvPut(shows);

  console.log('✅ Show added successfully!');
  console.log('\nDetails:');
  console.log(`  ID: ${newShow.id}`);
  console.log(`  Title: ${newShow.title}`);
  console.log(`  Date: ${newShow.dateFormatted}`);
  console.log(`  Location: ${newShow.location}`);
  console.log(`  Capacity: ${newShow.capacity}`);
}

function update(showId, options) {
  const shows = kvGet();
  const show = shows.find(s => s.id === showId);

  if (!show) {
    console.error(`❌ Show with ID "${showId}" not found`);
    console.error('   Run "node manage-shows.js list" to see all shows');
    process.exit(1);
  }

  // Parse options
  let updated = false;
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];

    if (opt === '--capacity' && options[i + 1]) {
      const newCapacity = parseInt(options[i + 1]);
      if (isNaN(newCapacity) || newCapacity < 1) {
        console.error('❌ Capacity must be a positive number');
        process.exit(1);
      }
      if (newCapacity < show.reserved) {
        console.error(`❌ Cannot set capacity to ${newCapacity} (already ${show.reserved} reservations)`);
        process.exit(1);
      }
      show.capacity = newCapacity;
      updated = true;
      i++;
    } else if (opt === '--location' && options[i + 1]) {
      show.location = options[i + 1];
      updated = true;
      i++;
    } else if (opt === '--title' && options[i + 1]) {
      show.title = options[i + 1];
      updated = true;
      i++;
    }
  }

  if (!updated) {
    console.error('❌ No valid options provided');
    console.error('   Available options: --capacity, --location, --title');
    console.error('   Example: node manage-shows.js update 2025-07-07-19:00 --capacity 60');
    process.exit(1);
  }

  kvPut(shows);

  console.log('✅ Show updated successfully!');
  console.log('\nUpdated show:');
  console.log(`  ID: ${show.id}`);
  console.log(`  Title: ${show.title}`);
  console.log(`  Date: ${show.dateFormatted}`);
  console.log(`  Location: ${show.location}`);
  console.log(`  Capacity: ${show.capacity}`);
  console.log(`  Reserved: ${show.reserved}`);
}

function deleteShow(showId) {
  const shows = kvGet();
  const show = shows.find(s => s.id === showId);

  if (!show) {
    console.error(`❌ Show with ID "${showId}" not found`);
    process.exit(1);
  }

  if (show.reserved > 0) {
    console.error(`❌ Cannot delete show with ${show.reserved} reservations`);
    console.error('   Please handle reservations first or use --force');
    process.exit(1);
  }

  const newShows = shows.filter(s => s.id !== showId);
  kvPut(newShows);

  console.log('✅ Show deleted successfully!');
  console.log(`   Deleted: ${show.title} (${show.dateFormatted})`);
}

// Main
const command = process.argv[2];

switch (command) {
  case 'init':
    init();
    break;
  case 'list':
    list();
    break;
  case 'add':
    add(process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
    break;
  case 'update':
    update(process.argv[3], process.argv.slice(4));
    break;
  case 'delete':
    deleteShow(process.argv[3]);
    break;
  default:
    console.log('🎭 Bruchbühne Show Management\n');
    console.log('Usage:');
    console.log('  node manage-shows.js init');
    console.log('  node manage-shows.js list');
    console.log('  node manage-shows.js add "Title" "YYYY-MM-DD HH:MM" "Location" capacity');
    console.log('  node manage-shows.js update SHOW_ID --capacity 60');
    console.log('  node manage-shows.js update SHOW_ID --location "New Location"');
    console.log('  node manage-shows.js delete SHOW_ID');
    console.log('\nExamples:');
    console.log('  node manage-shows.js add "Die Nashörner" "2025-07-07 19:00" "Bruchbühne Tübingen" 50');
    console.log('  node manage-shows.js update 2025-07-07-19:00 --capacity 60');
    console.log('  node manage-shows.js delete 2025-07-07-19:00');
    process.exit(command ? 1 : 0);
}
