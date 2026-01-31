const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

try {
    if (!fs.existsSync(envPath)) {
        console.log('❌ .env file NOT found!');
        process.exit(1);
    }

    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');

    let hasUrl = false;
    let hasKey = false;
    let urlVal = '';
    let keyVal = '';

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
            hasUrl = true;
            urlVal = trimmed.split('=')[1] || '';
        }
        if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
            hasKey = true;
            keyVal = trimmed.split('=')[1] || '';
        }
    });

    console.log('🔍 Checking .env file...');

    if (!hasUrl) {
        console.log('❌ VITE_SUPABASE_URL is MISSING');
    } else if (!urlVal || urlVal.length < 10) {
        console.log('❌ VITE_SUPABASE_URL appears empty or invalid');
    } else {
        console.log('✅ VITE_SUPABASE_URL is present');
    }

    if (!hasKey) {
        console.log('❌ VITE_SUPABASE_ANON_KEY is MISSING');
    } else if (!keyVal || keyVal.length < 20) {
        console.log('❌ VITE_SUPABASE_ANON_KEY appears empty or too short');
    } else {
        console.log('✅ VITE_SUPABASE_ANON_KEY is present');
    }

    if (keyVal.includes('your_supabase_anon_key_here')) {
        console.log('❌ You are still using the placeholder key from the example!');
    }

} catch (e) {
    console.error('Error reading .env:', e);
}
