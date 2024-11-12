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
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/wav' || file.mimetype === 'audio/x-wav') {
      cb(null, true);
    } else {
      cb(new Error('Only .mp3 and .wav files are allowed!'));
    }
  }
});

// Key to semitone mapping with distances from C major (for major keys) and A minor (for minor keys)
const keyToSemitone = {
  'c major': 0,      'a minor': 0,
  'c# major': 1,     'a# minor': 1,
  'd major': 2,      'b minor': 2,
  'd# major': 3,     'c minor': 3,
  'e major': 4,      'c# minor': 4,
  'f major': 5,      'd minor': 5,
  'f# major': 6,     'd# minor': 6,
  'g major': 7,      'e minor': 7,
  'g# major': 8,     'f minor': 8,
  'a major': 9,      'f# minor': 9,
  'a# major': 10,    'g minor': 10,
  'b major': 11,     'g# minor': 11,
  'cb major': 11,    'ab minor': 8,
  'db major': 1,     'bb minor': 10,
  'eb major': 3,     'eb minor': 3,
  'gb major': 6,     'db minor': 1,
  'ab major': 8,     'gb minor': 6,
  'bb major': 10,    'bb minor': 10,
};

// Function to extract key and quality from filename
function extractKeyFromFilename(filename) {
  const cleanedName = filename.replace(/[\s_]+/g, '').toLowerCase();
  const match = cleanedName.match(/([a-g][#b]?)(maj|minor|major|min)/);
  if (!match) return null;

  const note = match[1];
  const quality = match[2].startsWith('maj') ? 'major' : 'minor';
  return `${note} ${quality}`;
}

// Function to calculate the least amount of semitones needed to transpose between keys
function calculateSemitoneShift(originalKey, targetKey) {
  const originalSemitone = keyToSemitone[originalKey];
  const targetSemitone = keyToSemitone[targetKey];

  // Calculate the difference and adjust to ±6 for minimal transposition
  let semitoneShift = targetSemitone - originalSemitone;
  if (semitoneShift > 6) {
    semitoneShift -= 12;
  } else if (semitoneShift < -6) {
    semitoneShift += 12;
  }

  return semitoneShift;
}

// Serve static HTML page
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to handle file upload and transposition
app.post('/transpose', upload.single('audioFile'), (req, res) => {
  const targetKey = req.body.targetKey.toLowerCase(); // User-specified target key
  const inputFilePath = req.file.path;
  const inputExtension = path.extname(req.file.originalname).toLowerCase();
  const outputFilePath = `uploads/transposed_to_${targetKey.replace(' ', '_')}${inputExtension}`;

  console.log("targetKey", targetKey);

  // Extract the key from the filename
  const originalKey = extractKeyFromFilename(req.file.originalname);
  console.log("originalKey", originalKey);

  if (!originalKey || !(targetKey in keyToSemitone)) {
    res.status(400).send("Error: Invalid key in filename or target key.");
    return;
  }

  // Calculate the number of semitones needed to transpose
  const semitones = calculateSemitoneShift(originalKey, targetKey);
  const pitchFactor = Math.pow(2, semitones / 12);

  // Apply pitch shift
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