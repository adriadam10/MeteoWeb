const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const {existsSync, mkdirSync} = require("node:fs");

const app = express();
const PORT = 3000;
const streamDir = path.join(__dirname, '../public/stream');
const streamPath = path.join(streamDir, 'output.m3u8');
const isDebugMode = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

// Ensure stream directory exists
function ensureDirectoryExists(directory) {
    if (!existsSync(directory)) {
        console.log(`Creating directory: ${directory}`);
        mkdirSync(directory, { recursive: true });
    }
}


// Make this a module-level variable for proper tracking
let ffmpegProcess = null;

function startFFmpeg() {
    ensureDirectoryExists(streamDir);

    if (ffmpegProcess) {
        console.log('FFmpeg already running, not starting another instance');
        return;
    }

    try {
        console.log('Starting FFmpeg...');
        ffmpegProcess = spawn('ffmpeg', [
            '-i', process.env.STREAM_URL,
            '-c:v', 'copy',
            '-an',
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_list_size', '1',
            '-hls_flags', 'delete_segments',
            streamPath
        ]);

        if (isDebugMode) {
            ffmpegProcess.stderr.on('data', (data) => console.error(`FFmpeg: ${data}`));
        }

        ffmpegProcess.on('error', (err) => {
            console.error('Failed to start FFmpeg process:', err);
            ffmpegProcess = null;
        });

        ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg closed with code: ${code}`);
            ffmpegProcess = null;

            // Add delay before restart to prevent rapid restart loops
            setTimeout(() => {
                console.log('Attempting to restart FFmpeg...');
                startFFmpeg();
            }, 3000);
        });
    } catch (error) {
        console.error('Error starting FFmpeg:', error);
        ffmpegProcess = null;
    }
}

// Endpoint para obtener la URL de datos meteorológicos
app.get('/api/weather-url', (req, res) => {
    res.json({ url: process.env.WEATHER_URL });
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Server running in: http://localhost:${PORT}`);
    startFFmpeg();
});
