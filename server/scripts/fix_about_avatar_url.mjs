import pg from 'pg';
import { loadEnvIfNeeded } from '../lib/load_env.mjs';

console.log('Starting script...');
loadEnvIfNeeded();
console.log('Env loaded. DB URL:', process.env.DATABASE_URL ? 'Set' : 'Not Set');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log('Connecting to DB...');
    // 1. Get current settings
    const res = await pool.query("select data from site_settings where id = 'global'");
    console.log('Query result rows:', res.rows.length);
    
    if (res.rows.length === 0) {
      console.log('No global settings found.');
      return;
    }

    const settings = res.rows[0].data;
    const currentAvatar = settings.about?.avatar;
    console.log('Current Avatar URL:', currentAvatar);

    if (!currentAvatar) {
        console.log('No avatar set.');
        return;
    }

    // Check if it's an internal S3 URL
    const s3Match = currentAvatar.match(/^http:\/\/[\d\.]+:\d+\/[^/]+\/(.+)$/);
    console.log('Match result:', s3Match);
    
    if (s3Match) {
        const key = s3Match[1]; // e.g. uploads/xxx.jpg
        const newUrl = `/media/s3/${key}`;
        console.log(`Converting ${currentAvatar} -> ${newUrl}`);

        // Update settings
        settings.about.avatar = newUrl;
        
        await pool.query(
            "update site_settings set data = $1 where id = 'global'",
            [settings]
        );
        console.log('Database updated successfully.');
    } else {
        console.log('Current URL does not match internal S3 pattern, skipping update.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
    console.log('Done.');
  }
}

run();
