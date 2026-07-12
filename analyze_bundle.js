const fs = require('fs');
const b = fs.readFileSync('mrxtopup_bundle.js', 'utf8');
console.log('Bundle length:', b.length);

// Look for API endpoint strings
const searches = ['get-topup', 'topup-data', 'validate', 'check-uid', 'signature', 'hmac', 'sha256', 'x-client', 'client-id'];
searches.forEach(s => {
  const idx = b.indexOf(s);
  console.log(`'${s}': ${idx >= 0 ? 'FOUND at ' + idx : 'NOT FOUND'}`);
  if (idx >= 0) {
    console.log('  Context:', b.substring(Math.max(0, idx-50), idx+100).replace(/\n/g, ' '));
  }
});
