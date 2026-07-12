const fs = require('fs');
const path = require('path');

// Only run on Render or in production environment
if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
  const src = path.join(__dirname, '..', 'prisma', 'schema.prod.prisma');
  const dest = path.join(__dirname, '..', 'prisma', 'schema.prisma');

  try {
    console.log('[Build] Preparing production Prisma schema...');
    fs.copyFileSync(src, dest);
    console.log('[Build] Production schema ready.');
  } catch (err) {
    console.error('[Build] Failed to prepare production schema:', err.message);
    process.exit(1);
  }
} else {
  console.log('[Build] Skipping production schema preparation (local dev).');
}
