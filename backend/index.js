const express = require('express');
const app = express();
const cors = require('cors');
const port = 3000;


// Enable CORS for all origins 
app.use(cors());

// Middleware to parse JSON request bodies
app.use(express.json());

// GET /
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: "hello."
  });
});

// POST /actions/:action_type
app.post('/action/:action_type', (req, res) => {
  const { action_type } = req.params;
  const data = req.body;

  // TODO: Define behavior based on action_type
  res.json({
    success: true,
    action: action_type,
    received_data: data,
    message: `Action '${action_type}' received.`
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
