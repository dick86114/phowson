import { createApp } from './app.mjs';
import { loadEnvIfNeeded } from './lib/load_env.mjs';

loadEnvIfNeeded();

const port = Number(process.env.PORT || 2615);
const host = process.env.HOST || '0.0.0.0';

const app = createApp();

await app.listen({ port, host });
