#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

async function buildIndex() {
  const libraryDir = './models/';
  const indexFile = 'index.json';
  
  console.log('Building library index...');
  
  // Initialize structure
  const index = {
    library: [],
    updated_on: new Date().toISOString()
  };
  
  // Read library folders
  const folders = await readdir(libraryDir, { withFileTypes: true });
  //console.log(folders)
  for (const folder of folders) {
    if (folder.isDirectory()) {
      //console.log(folder)
      const infoPath = path.join(libraryDir,folder.name, 'meta.json');

      if (fs.existsSync(infoPath)) {
        try {
          //console.log(infoPath)
          const info = JSON.parse(await readFile(infoPath, 'utf8'));
          //console.log(info)
          index.library.push({
            name: folder.name,
            path: folder.name,
            info
          });
        } catch (error) {
          console.warn(`Skipping ${folder.name}: invalid info.json`);
        }
      }
    }
  }
  
  await writeFile(indexFile, JSON.stringify(index, null, 2), 'utf8');
  console.log(`Generated ${indexFile} with ${index.library.length} entries at ${index.updated_on}`);
}

buildIndex().catch(console.error);
