// Download at build time; the installed app works offline. No user audio is uploaded.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const asset = path.resolve(__dirname, '../android/app/src/main/assets/yamnet.tflite');
const expected = '10c95ea3eb9a7bb4cb8bddf6feb023250381008177ac162ce169694d05c317de';
const url = 'https://storage.googleapis.com/download.tensorflow.org/models/tflite/task_library/audio_classification/android/lite-model_yamnet_classification_tflite_1.tflite';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (fs.existsSync(asset) && digest(fs.readFileSync(asset)) === expected) {
    console.log('Verified bundled YAMNet model');
} else {
    https.get(url, response => {
        if (response.statusCode !== 200) {
            response.resume(); console.error(`YAMNet download failed: HTTP ${response.statusCode}`);
            process.exitCode = 1; return;
        }
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('error', error => { console.error(error.message); process.exitCode = 1; });
        response.on('end', () => {
            const bytes = Buffer.concat(chunks);
            if (digest(bytes) !== expected) {
                console.error('YAMNet checksum mismatch; refusing to bundle it');
                process.exitCode = 1; return;
            }
            fs.mkdirSync(path.dirname(asset), {recursive: true});
            fs.writeFileSync(asset, bytes);
            console.log(`Verified and bundled YAMNet (${bytes.length} bytes)`);
        });
    }).on('error', error => { console.error(error.message); process.exitCode = 1; });
}
