import path from 'path';
import parseArgs from 'minimist';
import fs from 'fs-extra-promise';
import bluebird from 'bluebird';
import { authenticateToGoogle } from './drive';
import mime from 'mime-types';
var google = require('googleapis');
var opn = require('opn');

// maximum number of concurrent operations on local file system
const FS_CONCURRENCY = 10;
// same as above for the Drive API (usefull for throttle)
const HTTP_CONCURRENCY = 10;

// see : https://github.com/substack/minimist
const argv = parseArgs(process.argv.slice(2));
const rootPath = path.resolve(process.cwd(), argv._[0]);
const rootPathArray = rootPath.split('\\');
const rootFolder = {
  name: rootPathArray[rootPathArray.length - 1],
  directoriesPaths: [],
  parentId: 'root'
};

if (!argv.credentials) {
  console.error('Error : missing mandatory --credentials option');
  process.exit(0);
}

const credentialsPath = path.resolve(process.cwd(), argv.credentials);

/**
 * test an array of filepaths for being directories
 * @param  {string[]} filepaths array of filespath to test
 * @return {Promise}            a promise resolved with a true/false array
 */
function testIsDirectory(filepaths) {
  const options = { concurrency: FS_CONCURRENCY };

  return bluebird.map(filepaths, filepath => fs.lstatAsync(filepath), options)
    .then(statsResults => statsResults.map(stats => stats.isDirectory()));
}

/**
 * recursively scan a directory to list all files and folders inside
 * @param  {string} rootPath          absolute path of the directory to scan
 * @param  {boolean} [recursive=true] pass true if you do not want this function
 *                                    to scan sub-directories
 * @return {Promise}                  a promise resolved with the list
 */
function scan(rootPath, recursive = true) {
  let files = [];
  let directories = [];

  return fs.readdirAsync(rootPath)
    .then(filenames => filenames.map(filename => path.resolve(rootPath, filename)))
    .then(filepaths => bluebird.all([
      filepaths,
      testIsDirectory(filepaths)
    ]))
    .then(([filepaths, fileIsDirectory]) => {
      const realfilepaths = filepaths.filter((f, i) => !fileIsDirectory[i]);
      const realdirpaths = filepaths.filter((f, i) => !!fileIsDirectory[i]);

      files = realfilepaths.map(filepath => ({
        path: filepath,
        mimeType: mime.lookup(filepath) || 'application/octet-stream'
      }));
      directories = realdirpaths;

      if (recursive) {
        return bluebird.map(realdirpaths, dirpath => scan(dirpath), { concurrency: 1 });
      } else {
        return [];
      }
    }).then(results => {
      results.forEach(result => {
        files = files.concat(result.files);
        directories = directories.concat(result.directories);
      });
      return { files, directories, root: rootPath };
    });
}

function createDriveFolder(dirOptions, allDirsOptions) {
  return new Promise((resolve, reject) => {
    const service = google.drive('v3');
    const parentId = dirOptions.parentId || allDirsOptions.find(options =>
      options.relativePath === dirOptions.parentRelativePath).id;
    var fileMetadata = {
      'name' : dirOptions.name,
      'mimeType' : 'application/vnd.google-apps.folder',
      parents: parentId === 'root' ? undefined : [ parentId ]
    };

    service.files.create({
       resource: fileMetadata,
       fields: 'id'
    }, function(err, file) {
      if(err) {
        // Handle error
        console.log(err);
      } else {
        dirOptions.id = file.id;
        console.info(`  folder "${dirOptions.directoriesPaths.join('/')}" created.`);
        resolve();
      }
    });
  })
}

function createDriveFile(options) {
  return new Promise((resolve, reject) => {
    const service = google.drive('v3');
    var fileMetadata = {
      'name' : options.name,
      'mimeType' : options.mimeType,
      parents: [ options.parentId ]
    };
    var media = {
      mimeType: options.mimeType,
      body: fs.createReadStream(options.path)
    };
    service.files.create({
       resource: fileMetadata,
       media,
       fields: 'id'
    }, function(err, file) {
      if(err) {
        // Handle error
        console.log(err);
      } else {
        options.id = file.id;
        console.info(`  file "${options.relativePath}" uploaded.`);
        resolve();
      }
    });
  })
}

// function

const DRIVE_ROOT = 'root';

console.info(`Scanning root directory ${rootPath}...`);

authenticateToGoogle(credentialsPath)
  .then(() => scan(rootPath))
  .then(results => {
    console.info('Creating root folder ...');
    return bluebird.all([results, createDriveFolder(rootFolder, [])]);
  })
  .then(([results]) => {
    console.info(`Scan complete, files: ${results.files.length} folders: ${results.directories.length}.`);
    // console.log(results);
    const foldersToCreate = results.directories.map(directory => {
      const relativePath = directory.replace(results.root + '\\', '');
      const directoriesPaths = relativePath.split('\\');
      const parentRelativePath = directoriesPaths.concat([]).splice(0, directoriesPaths.length - 1).join('\\');

      return {
        relativePath,
        parentRelativePath,
        directoriesPaths,
        id: null,
        name: directoriesPaths[directoriesPaths.length - 1],
        parentId: directoriesPaths.length > 1 ? null : rootFolder.id
      };
    })
    // sort top-level directories first
    .sort((a, b) => a.directoriesPaths.length - b.directoriesPaths.length);

    console.log('Recreating folder structure :');
    return bluebird.all([
      results,
      foldersToCreate,
      bluebird.mapSeries(foldersToCreate, options => createDriveFolder(options, foldersToCreate),
        { concurrency: 1 })
    ]);
  }).then(([results, folders]) => {
    console.info('Directory structure created.');
    console.info('Starting to upload files :');

    const filesToCreate = results.files.map(file => {
      const relativePath = file.path.replace(results.root + '\\', '');
      const directoriesPaths = relativePath.split('\\');
      const parentRelativePath = directoriesPaths.concat([]).splice(0, directoriesPaths.length - 1).join('\\');
      const parent = folders.find(folder => folder.relativePath === parentRelativePath);

      return {
        ...file,
        name: directoriesPaths[directoriesPaths.length - 1],
        relativePath,
        parentId: parent ? parent.id : rootFolder.id
      };
    });

    return bluebird.map(filesToCreate, options => createDriveFile(options),
        { concurrency: HTTP_CONCURRENCY });
  })
  .then(() => {
    console.info('Import completed. Opening root folder in browser ... ');
    opn(`https://drive.google.com/drive/folders/${rootFolder.id}`);
  })
  .catch(err => console.error(err.message, err.stack));

/* scan(rootPath).then(results =>
  console.info(`Scan complete, files: ${results.files.length} folders: ${results.files.length}`));*/
