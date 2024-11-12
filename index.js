const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Initialize Express
const app = express();
const PORT = 3000;

// Set up multer for file uploads with file extension check
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    // Accept only .mp3 and .wav files
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/wav' || file.mimetype === 'audio/x-wav') {
      cb(null, true);
    } else {
      cb(new Error('Only .mp3 and .wav files are allowed!'));
    }
  }
});

// Serve static HTML page
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to handle file upload and transposition
app.post('/transpose', upload.single('audioFile'), (req, res) => {
  const semitones = parseFloat(req.body.semitones);
  const inputFilePath = req.file.path;
  const inputExtension = path.extname(req.file.originalname).toLowerCase();
  const outputFilePath = `uploads/transposed_${Math.abs(semitones)}_semitones_${semitones < 0 ? 'down' : 'up'}${inputExtension}`;

  // Calculate pitch factor for rubberband filter
  const pitchFactor = Math.pow(2, semitones / 12);

  ffmpeg(inputFilePath)
    .audioFilters([
      `rubberband=pitch=${pitchFactor}`
    ])
    .output(outputFilePath)
    .on('end', () => {
      // Send the transposed file back to the client for download
      res.download(outputFilePath, (err) => {
        // Clean up files after sending
        fs.unlinkSync(inputFilePath);
        fs.unlinkSync(outputFilePath);
      });
    })
    .on('error', (err) => {
      res.status(500).send(`Error processing audio: ${err.message}`);
    })
    .run();
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});