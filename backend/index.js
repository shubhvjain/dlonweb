const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const os = require('os');

const ut = require('./actions/util');

const app = express();
const port = 3000;


// Enable CORS for all origins 
app.use(cors());
// Middleware to parse JSON request bodies
app.use(express.json());

// Multer for file upload (used in convert action)
const upload = multer({ dest: os.tmpdir() }); 

// GET /
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: "hello."
  });
});

// POST /actions/:action_type
app.post('/action/:action_type', (req, res) => {
  const action = req.params.action_type;

  // Route to the appropriate handler
  if (action === 'convert') {
    // Add file upload middleware before handler
    return upload.single('model')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      ut.convertHandler(req, res);
    });
  }

  // Handle unknown actions
  return res.status(400).json({ success: false, message: 'Unknown action type' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
