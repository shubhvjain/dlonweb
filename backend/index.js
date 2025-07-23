const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const os = require("os");

const ut = require("./actions/util");

const app = express();
const port = 3000;

const data_settings = require("./data.node");

const { Data, InferenceTask } = require("dlonwebjs"); // Uses index.cjs

app.use(cors());
app.use(express.json());

// Use memory storage if you want direct buffer access (for base64 conversion)
const upload = multer({ storage: multer.memoryStorage() });

// GET /
app.get("/", (req, res) => {
  res.json({ success: true, message: "hello." });
});

// POST /action/:action_type
app.post("/action/:action_type", (req, res, next) => {
  const action = req.params.action_type;

  if (action === "convert") {
    return upload.single("model")(req, res, (err) => {
      if (err)
        return res.status(400).json({ success: false, error: err.message });
      ut.convertHandler(req, res);
    });
  }

  if (action === "inference") {
    return upload.single("file")(req, res, async (err) => {
      if (err)
        return res.status(400).json({ success: false, error: err.message });

      if (!req.file) {
        return res.status(400).json({ error: "Missing file for inference" });
      }

      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
      const modelName = metadata.modelName;

      if (!modelName) {
        return res
          .status(400)
          .json({ error: "Missing model_name in metadata" });
      }

      try {
        // Step 1: Load input data
        let set_obj = {...data_settings,meta:metadata}
        //console.log(set_obj)
        const data = new Data(req.file, set_obj);
        await data.load();
        //console.log(data)
        // Step 2: Setup and load model
        const task = new InferenceTask({
          ...data_settings,
          modelName,
        });
        await task.loadModel();
        console.log("loaded");
        //console.log(task)
        // Step 3: Run inference
        const result = await task.runInference(data);
        console.log("ran");
        //console.log(result);
        // Step 4: Return inference result
        const blob = await result.toBlob();

        const meta = {
          kind: result.kind,
          structure: result.structure,
          meta: result.meta,
          fileName: result.input.name || "input",
          mimeType: result.input.type || "application/octet-stream",
        };

        // Send as multipart or JSON+binary
        res.set("Content-Type", "application/json");
        res.json({
          meta,
          buffer: blob.toString("base64"), // Or use separate route for blob
        });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, error: e.message });
      }
      // const base64 = req.file.buffer.toString('base64');
      // return res.json({
      //   model: metadata.model_name || 'unknown',
      //   fileBase64: base64,
      //   receivedMeta: metadata
      // });
    });
  }

  return res
    .status(400)
    .json({ success: false, message: "Unknown action type" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
