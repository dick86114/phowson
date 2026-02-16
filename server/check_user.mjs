
import { pool } from './db.mjs';

console.log('Script started');

async function checkUser() {
  console.log('Checking user...');
  try {
    const email = 'admin@example1.com';
    const res = await pool.query('select * from users where email = $1', [email]);
    if (res.rowCount > 0) {
      console.log('User found:', res.rows[0]);
    } else {
      console.log('User not found');
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    console.log('Closing pool...');
    await pool.end();
  }
}

checkUser().then(() => console.log('Done'));
