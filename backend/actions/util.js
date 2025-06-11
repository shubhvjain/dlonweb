const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');

function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function convertHandler(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No model file uploaded.' });
  }

  const timestamp = Date.now().toString();
  const tempBase = path.join(os.tmpdir(), `tfjs-${timestamp}`);
  const inputPath = path.join(tempBase, 'model.h5');
  const outputDir = path.join(tempBase, 'converted');
  const zipPath = path.join(tempBase, 'model.zip');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.renameSync(req.file.path, inputPath);

  const command = `poetry run tensorflowjs_converter --input_format keras "${inputPath}" "${outputDir}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(stderr);
      removeDir(tempBase);
      return res.status(500).json({ success: false, message: 'Conversion failed.', error: stderr });
    }

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipPath, 'model.zip', (err) => {
        removeDir(tempBase);
        if (err) console.error('Error sending zip:', err);
      });
    });

    archive.on('error', err => {
      removeDir(tempBase);
      res.status(500).json({ success: false, message: 'Zipping failed.', error: err.message });
    });

    archive.pipe(output);
    archive.directory(outputDir, false);
    archive.finalize();
  });
};

module.exports = {convertHandler}
