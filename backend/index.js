const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const os = require('os');

const ut = require('./actions/util');

const app = express();
const port = 3000;

const data_settings = require("./data.node")

const { Data } = require('dlonwebjs'); // Uses index.cjs

app.use(cors());
app.use(express.json());

// Use memory storage if you want direct buffer access (for base64 conversion)
const upload = multer({ storage: multer.memoryStorage() });

// GET /
app.get('/', (req, res) => {
  res.json({ success: true, message: "hello." });
});

// POST /action/:action_type
app.post('/action/:action_type', (req, res, next) => {
  const action = req.params.action_type;

  if (action === 'convert') {
    return upload.single('model')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      ut.convertHandler(req, res);
    });
  }

  if (action === 'inference') {
    return upload.single('file')(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });

      if (!req.file) {
        return res.status(400).json({ error: "Missing file for inference" });
      }

      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

      try {
        //console.log(typeof req.file)
        //console.log(req.file)
        const data = new Data(req.file, data_settings);
        await data.load();
        console.log("ddd")

        console.log(Data)
        const blob = await data.toBlob();

        return res.json({
          model: metadata.model_name || 'unknown',
          base64: blob.toString('base64'),
          shape: data.getTensor().shape,
          meta: metadata
        });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: e.message });
      }      



      // const base64 = req.file.buffer.toString('base64');

      // return res.json({
      //   model: metadata.model_name || 'unknown',
      //   fileBase64: base64,
      //   receivedMeta: metadata
      // });
    });
  }

  return res.status(400).json({ success: false, message: 'Unknown action type' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
