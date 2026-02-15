import pg from 'pg';
import { loadEnvIfNeeded } from '../lib/load_env.mjs';

loadEnvIfNeeded();
process.stdout.write(`Starting script...\n`)
process.stdout.write(`Env loaded. DB URL: ${process.env.DATABASE_URL ? 'Set' : 'Not Set'}\n`)

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    process.stdout.write('Connecting to DB...\n')
    // 1. Get current settings
    const res = await pool.query("select data from site_settings where id = 'global'");
    process.stdout.write(`Query result rows: ${res.rows.length}\n`)
    
    if (res.rows.length === 0) {
      process.stdout.write('No global settings found.\n')
      return;
    }

    const settings = res.rows[0].data;
    const currentAvatar = settings.about?.avatar;
    process.stdout.write(`Current Avatar URL: ${String(currentAvatar || '')}\n`)

    if (!currentAvatar) {
        process.stdout.write('No avatar set.\n')
        return;
    }

    // Check if it's an internal S3 URL
    const s3Match = currentAvatar.match(/^http:\/\/[\d\.]+:\d+\/[^/]+\/(.+)$/);
    process.stdout.write(`Match result: ${s3Match ? 'matched' : 'not_matched'}\n`)
    
    if (s3Match) {
        const key = s3Match[1]; // e.g. uploads/xxx.jpg
        const newUrl = `/media/s3/${key}`;
        process.stdout.write(`Converting ${currentAvatar} -> ${newUrl}\n`)

        // Update settings
        settings.about.avatar = newUrl;
        
        await pool.query(
            "update site_settings set data = $1 where id = 'global'",
            [settings]
        );
        process.stdout.write('Database updated successfully.\n')
    } else {
        process.stdout.write('Current URL does not match internal S3 pattern, skipping update.\n')
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
    process.stdout.write('Done.\n')
  }
}

run();
