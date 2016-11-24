'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _minimist = require('minimist');

var _minimist2 = _interopRequireDefault(_minimist);

var _fsExtraPromise = require('fs-extra-promise');

var _fsExtraPromise2 = _interopRequireDefault(_fsExtraPromise);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _drive = require('./drive');

var _mimeTypes = require('mime-types');

var _mimeTypes2 = _interopRequireDefault(_mimeTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var google = require('googleapis');
var opn = require('opn');

// maximum number of concurrent operations on local file system
var FS_CONCURRENCY = 10;
// same as above for the Drive API (usefull for throttle)
var HTTP_CONCURRENCY = 10;

// see : https://github.com/substack/minimist
var argv = (0, _minimist2.default)(process.argv.slice(2));
var rootPath = _path2.default.resolve(process.cwd(), argv._[0]);
var rootPathArray = rootPath.split('\\');
var rootFolder = {
  name: rootPathArray[rootPathArray.length - 1],
  directoriesPaths: [],
  parentId: 'root'
};

if (!argv.credentials) {
  console.error('Error : missing mandatory --credentials option');
  process.exit(0);
}

var credentialsPath = _path2.default.resolve(process.cwd(), argv.credentials);

/**
 * test an array of filepaths for being directories
 * @param  {string[]} filepaths array of filespath to test
 * @return {Promise}            a promise resolved with a true/false array
 */
function testIsDirectory(filepaths) {
  var options = { concurrency: FS_CONCURRENCY };

  return _bluebird2.default.map(filepaths, function (filepath) {
    return _fsExtraPromise2.default.lstatAsync(filepath);
  }, options).then(function (statsResults) {
    return statsResults.map(function (stats) {
      return stats.isDirectory();
    });
  });
}

/**
 * recursively scan a directory to list all files and folders inside
 * @param  {string} rootPath          absolute path of the directory to scan
 * @param  {boolean} [recursive=true] pass true if you do not want this function
 *                                    to scan sub-directories
 * @return {Promise}                  a promise resolved with the list
 */
function scan(rootPath) {
  var recursive = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

  var files = [];
  var directories = [];

  return _fsExtraPromise2.default.readdirAsync(rootPath).then(function (filenames) {
    return filenames.map(function (filename) {
      return _path2.default.resolve(rootPath, filename);
    });
  }).then(function (filepaths) {
    return _bluebird2.default.all([filepaths, testIsDirectory(filepaths)]);
  }).then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        filepaths = _ref2[0],
        fileIsDirectory = _ref2[1];

    var realfilepaths = filepaths.filter(function (f, i) {
      return !fileIsDirectory[i];
    });
    var realdirpaths = filepaths.filter(function (f, i) {
      return !!fileIsDirectory[i];
    });

    files = realfilepaths.map(function (filepath) {
      return {
        path: filepath,
        mimeType: _mimeTypes2.default.lookup(filepath) || 'application/octet-stream'
      };
    });
    directories = realdirpaths;

    if (recursive) {
      return _bluebird2.default.map(realdirpaths, function (dirpath) {
        return scan(dirpath);
      }, { concurrency: 1 });
    } else {
      return [];
    }
  }).then(function (results) {
    results.forEach(function (result) {
      files = files.concat(result.files);
      directories = directories.concat(result.directories);
    });
    return { files: files, directories: directories, root: rootPath };
  });
}

function createDriveFolder(dirOptions, allDirsOptions) {
  return new Promise(function (resolve, reject) {
    var service = google.drive('v3');
    var parentId = dirOptions.parentId || allDirsOptions.find(function (options) {
      return options.relativePath === dirOptions.parentRelativePath;
    }).id;
    var fileMetadata = {
      'name': dirOptions.name,
      'mimeType': 'application/vnd.google-apps.folder',
      parents: parentId === 'root' ? undefined : [parentId]
    };

    service.files.create({
      resource: fileMetadata,
      fields: 'id'
    }, function (err, file) {
      if (err) {
        // Handle error
        console.log(err);
      } else {
        dirOptions.id = file.id;
        console.info('  folder "' + dirOptions.directoriesPaths.join('/') + '" created.');
        resolve();
      }
    });
  });
}

function createDriveFile(options) {
  return new Promise(function (resolve, reject) {
    var service = google.drive('v3');
    var fileMetadata = {
      'name': options.name,
      'mimeType': options.mimeType,
      parents: [options.parentId]
    };
    var media = {
      mimeType: options.mimeType,
      body: _fsExtraPromise2.default.createReadStream(options.path)
    };
    service.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    }, function (err, file) {
      if (err) {
        // Handle error
        console.log(err);
      } else {
        options.id = file.id;
        console.info('  file "' + options.relativePath + '" uploaded.');
        resolve();
      }
    });
  });
}

// function

var DRIVE_ROOT = 'root';

console.info('Scanning root directory ' + rootPath + '...');

(0, _drive.authenticateToGoogle)(credentialsPath).then(function () {
  return scan(rootPath);
}).then(function (results) {
  console.info('Creating root folder ...');
  return _bluebird2.default.all([results, createDriveFolder(rootFolder, [])]);
}).then(function (_ref3) {
  var _ref4 = _slicedToArray(_ref3, 1),
      results = _ref4[0];

  console.info('Scan complete, files: ' + results.files.length + ' folders: ' + results.directories.length + '.');
  // console.log(results);
  var foldersToCreate = results.directories.map(function (directory) {
    var relativePath = directory.replace(results.root + '\\', '');
    var directoriesPaths = relativePath.split('\\');
    var parentRelativePath = directoriesPaths.concat([]).splice(0, directoriesPaths.length - 1).join('\\');

    return {
      relativePath: relativePath,
      parentRelativePath: parentRelativePath,
      directoriesPaths: directoriesPaths,
      id: null,
      name: directoriesPaths[directoriesPaths.length - 1],
      parentId: directoriesPaths.length > 1 ? null : rootFolder.id
    };
  })
  // sort top-level directories first
  .sort(function (a, b) {
    return a.directoriesPaths.length - b.directoriesPaths.length;
  });

  console.log('Recreating folder structure :');
  return _bluebird2.default.all([results, foldersToCreate, _bluebird2.default.mapSeries(foldersToCreate, function (options) {
    return createDriveFolder(options, foldersToCreate);
  }, { concurrency: 1 })]);
}).then(function (_ref5) {
  var _ref6 = _slicedToArray(_ref5, 2),
      results = _ref6[0],
      folders = _ref6[1];

  console.info('Directory structure created.');
  console.info('Starting to upload files :');

  var filesToCreate = results.files.map(function (file) {
    var relativePath = file.path.replace(results.root + '\\', '');
    var directoriesPaths = relativePath.split('\\');
    var parentRelativePath = directoriesPaths.concat([]).splice(0, directoriesPaths.length - 1).join('\\');
    var parent = folders.find(function (folder) {
      return folder.relativePath === parentRelativePath;
    });

    return _extends({}, file, {
      name: directoriesPaths[directoriesPaths.length - 1],
      relativePath: relativePath,
      parentId: parent ? parent.id : rootFolder.id
    });
  });

  return _bluebird2.default.map(filesToCreate, function (options) {
    return createDriveFile(options);
  }, { concurrency: HTTP_CONCURRENCY });
}).then(function () {
  console.info('Import completed. Opening root folder in browser ... ');
  opn('https://drive.google.com/drive/folders/' + rootFolder.id);
}).catch(function (err) {
  return console.error(err.message, err.stack);
});

/* scan(rootPath).then(results =>
  console.info(`Scan complete, files: ${results.files.length} folders: ${results.files.length}`));*/
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC5qcyJdLCJuYW1lcyI6WyJnb29nbGUiLCJyZXF1aXJlIiwib3BuIiwiRlNfQ09OQ1VSUkVOQ1kiLCJIVFRQX0NPTkNVUlJFTkNZIiwiYXJndiIsInByb2Nlc3MiLCJzbGljZSIsInJvb3RQYXRoIiwicmVzb2x2ZSIsImN3ZCIsIl8iLCJyb290UGF0aEFycmF5Iiwic3BsaXQiLCJyb290Rm9sZGVyIiwibmFtZSIsImxlbmd0aCIsImRpcmVjdG9yaWVzUGF0aHMiLCJwYXJlbnRJZCIsImNyZWRlbnRpYWxzIiwiY29uc29sZSIsImVycm9yIiwiZXhpdCIsImNyZWRlbnRpYWxzUGF0aCIsInRlc3RJc0RpcmVjdG9yeSIsImZpbGVwYXRocyIsIm9wdGlvbnMiLCJjb25jdXJyZW5jeSIsIm1hcCIsImxzdGF0QXN5bmMiLCJmaWxlcGF0aCIsInRoZW4iLCJzdGF0c1Jlc3VsdHMiLCJzdGF0cyIsImlzRGlyZWN0b3J5Iiwic2NhbiIsInJlY3Vyc2l2ZSIsImZpbGVzIiwiZGlyZWN0b3JpZXMiLCJyZWFkZGlyQXN5bmMiLCJmaWxlbmFtZXMiLCJmaWxlbmFtZSIsImFsbCIsImZpbGVJc0RpcmVjdG9yeSIsInJlYWxmaWxlcGF0aHMiLCJmaWx0ZXIiLCJmIiwiaSIsInJlYWxkaXJwYXRocyIsInBhdGgiLCJtaW1lVHlwZSIsImxvb2t1cCIsImRpcnBhdGgiLCJyZXN1bHRzIiwiZm9yRWFjaCIsImNvbmNhdCIsInJlc3VsdCIsInJvb3QiLCJjcmVhdGVEcml2ZUZvbGRlciIsImRpck9wdGlvbnMiLCJhbGxEaXJzT3B0aW9ucyIsIlByb21pc2UiLCJyZWplY3QiLCJzZXJ2aWNlIiwiZHJpdmUiLCJmaW5kIiwicmVsYXRpdmVQYXRoIiwicGFyZW50UmVsYXRpdmVQYXRoIiwiaWQiLCJmaWxlTWV0YWRhdGEiLCJwYXJlbnRzIiwidW5kZWZpbmVkIiwiY3JlYXRlIiwicmVzb3VyY2UiLCJmaWVsZHMiLCJlcnIiLCJmaWxlIiwibG9nIiwiaW5mbyIsImpvaW4iLCJjcmVhdGVEcml2ZUZpbGUiLCJtZWRpYSIsImJvZHkiLCJjcmVhdGVSZWFkU3RyZWFtIiwiRFJJVkVfUk9PVCIsImZvbGRlcnNUb0NyZWF0ZSIsImRpcmVjdG9yeSIsInJlcGxhY2UiLCJzcGxpY2UiLCJzb3J0IiwiYSIsImIiLCJtYXBTZXJpZXMiLCJmb2xkZXJzIiwiZmlsZXNUb0NyZWF0ZSIsInBhcmVudCIsImZvbGRlciIsImNhdGNoIiwibWVzc2FnZSIsInN0YWNrIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7QUFDQSxJQUFJQSxTQUFTQyxRQUFRLFlBQVIsQ0FBYjtBQUNBLElBQUlDLE1BQU1ELFFBQVEsS0FBUixDQUFWOztBQUVBO0FBQ0EsSUFBTUUsaUJBQWlCLEVBQXZCO0FBQ0E7QUFDQSxJQUFNQyxtQkFBbUIsRUFBekI7O0FBRUE7QUFDQSxJQUFNQyxPQUFPLHdCQUFVQyxRQUFRRCxJQUFSLENBQWFFLEtBQWIsQ0FBbUIsQ0FBbkIsQ0FBVixDQUFiO0FBQ0EsSUFBTUMsV0FBVyxlQUFLQyxPQUFMLENBQWFILFFBQVFJLEdBQVIsRUFBYixFQUE0QkwsS0FBS00sQ0FBTCxDQUFPLENBQVAsQ0FBNUIsQ0FBakI7QUFDQSxJQUFNQyxnQkFBZ0JKLFNBQVNLLEtBQVQsQ0FBZSxJQUFmLENBQXRCO0FBQ0EsSUFBTUMsYUFBYTtBQUNqQkMsUUFBTUgsY0FBY0EsY0FBY0ksTUFBZCxHQUF1QixDQUFyQyxDQURXO0FBRWpCQyxvQkFBa0IsRUFGRDtBQUdqQkMsWUFBVTtBQUhPLENBQW5COztBQU1BLElBQUksQ0FBQ2IsS0FBS2MsV0FBVixFQUF1QjtBQUNyQkMsVUFBUUMsS0FBUixDQUFjLGdEQUFkO0FBQ0FmLFVBQVFnQixJQUFSLENBQWEsQ0FBYjtBQUNEOztBQUVELElBQU1DLGtCQUFrQixlQUFLZCxPQUFMLENBQWFILFFBQVFJLEdBQVIsRUFBYixFQUE0QkwsS0FBS2MsV0FBakMsQ0FBeEI7O0FBRUE7Ozs7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XG5pbXBvcnQgcGFyc2VBcmdzIGZyb20gJ21pbmltaXN0JztcbmltcG9ydCBmcyBmcm9tICdmcy1leHRyYS1wcm9taXNlJztcbmltcG9ydCBibHVlYmlyZCBmcm9tICdibHVlYmlyZCc7XG5pbXBvcnQgeyBhdXRoZW50aWNhdGVUb0dvb2dsZSB9IGZyb20gJy4vZHJpdmUnO1xuaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG52YXIgZ29vZ2xlID0gcmVxdWlyZSgnZ29vZ2xlYXBpcycpO1xudmFyIG9wbiA9IHJlcXVpcmUoJ29wbicpO1xuXG4vLyBtYXhpbXVtIG51bWJlciBvZiBjb25jdXJyZW50IG9wZXJhdGlvbnMgb24gbG9jYWwgZmlsZSBzeXN0ZW1cbmNvbnN0IEZTX0NPTkNVUlJFTkNZID0gMTA7XG4vLyBzYW1lIGFzIGFib3ZlIGZvciB0aGUgRHJpdmUgQVBJICh1c2VmdWxsIGZvciB0aHJvdHRsZSlcbmNvbnN0IEhUVFBfQ09OQ1VSUkVOQ1kgPSAxMDtcblxuLy8gc2VlIDogaHR0cHM6Ly9naXRodWIuY29tL3N1YnN0YWNrL21pbmltaXN0XG5jb25zdCBhcmd2ID0gcGFyc2VBcmdzKHByb2Nlc3MuYXJndi5zbGljZSgyKSk7XG5jb25zdCByb290UGF0aCA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBhcmd2Ll9bMF0pO1xuY29uc3Qgcm9vdFBhdGhBcnJheSA9IHJvb3RQYXRoLnNwbGl0KCdcXFxcJyk7XG5jb25zdCByb290Rm9sZGVyID0ge1xuICBuYW1lOiByb290UGF0aEFycmF5W3Jvb3RQYXRoQXJyYXkubGVuZ3RoIC0gMV0sXG4gIGRpcmVjdG9yaWVzUGF0aHM6IFtdLFxuICBwYXJlbnRJZDogJ3Jvb3QnXG59O1xuXG5pZiAoIWFyZ3YuY3JlZGVudGlhbHMpIHtcbiAgY29uc29sZS5lcnJvcignRXJyb3IgOiBtaXNzaW5nIG1hbmRhdG9yeSAtLWNyZWRlbnRpYWxzIG9wdGlvbicpO1xuICBwcm9jZXNzLmV4aXQoMCk7XG59XG5cbmNvbnN0IGNyZWRlbnRpYWxzUGF0aCA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBhcmd2LmNyZWRlbnRpYWxzKTtcblxuLyoqXG4gKiB0ZXN0IGFuIGFycmF5IG9mIGZpbGVwYXRocyBmb3IgYmVpbmcgZGlyZWN0b3JpZXNcbiAqIEBwYXJhbSAge3N0cmluZ1tdfSBmaWxlcGF0aHMgYXJyYXkgb2YgZmlsZXNwYXRoIHRvIHRlc3RcbiAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgICAgYSBwcm9taXNlIHJlc29sdmVkIHdpdGggYSB0cnVlL2ZhbHNlIGFycmF5XG4gKi9cbmZ1bmN0aW9uIHRlc3RJc0RpcmVjdG9yeShmaWxlcGF0aHMpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IHsgY29uY3VycmVuY3k6IEZTX0NPTkNVUlJFTkNZIH07XG5cbiAgcmV0dXJuIGJsdWViaXJkLm1hcChmaWxlcGF0aHMsIGZpbGVwYXRoID0+IGZzLmxzdGF0QXN5bmMoZmlsZXBhdGgpLCBvcHRpb25zKVxuICAgIC50aGVuKHN0YXRzUmVzdWx0cyA9PiBzdGF0c1Jlc3VsdHMubWFwKHN0YXRzID0+IHN0YXRzLmlzRGlyZWN0b3J5KCkpKTtcbn1cblxuLyoqXG4gKiByZWN1cnNpdmVseSBzY2FuIGEgZGlyZWN0b3J5IHRvIGxpc3QgYWxsIGZpbGVzIGFuZCBmb2xkZXJzIGluc2lkZVxuICogQHBhcmFtICB7c3RyaW5nfSByb290UGF0aCAgICAgICAgICBhYnNvbHV0ZSBwYXRoIG9mIHRoZSBkaXJlY3RvcnkgdG8gc2NhblxuICogQHBhcmFtICB7Ym9vbGVhbn0gW3JlY3Vyc2l2ZT10cnVlXSBwYXNzIHRydWUgaWYgeW91IGRvIG5vdCB3YW50IHRoaXMgZnVuY3Rpb25cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG8gc2NhbiBzdWItZGlyZWN0b3JpZXNcbiAqIEByZXR1cm4ge1Byb21pc2V9ICAgICAgICAgICAgICAgICAgYSBwcm9taXNlIHJlc29sdmVkIHdpdGggdGhlIGxpc3RcbiAqL1xuZnVuY3Rpb24gc2Nhbihyb290UGF0aCwgcmVjdXJzaXZlID0gdHJ1ZSkge1xuICBsZXQgZmlsZXMgPSBbXTtcbiAgbGV0IGRpcmVjdG9yaWVzID0gW107XG5cbiAgcmV0dXJuIGZzLnJlYWRkaXJBc3luYyhyb290UGF0aClcbiAgICAudGhlbihmaWxlbmFtZXMgPT4gZmlsZW5hbWVzLm1hcChmaWxlbmFtZSA9PiBwYXRoLnJlc29sdmUocm9vdFBhdGgsIGZpbGVuYW1lKSkpXG4gICAgLnRoZW4oZmlsZXBhdGhzID0+IGJsdWViaXJkLmFsbChbXG4gICAgICBmaWxlcGF0aHMsXG4gICAgICB0ZXN0SXNEaXJlY3RvcnkoZmlsZXBhdGhzKVxuICAgIF0pKVxuICAgIC50aGVuKChbZmlsZXBhdGhzLCBmaWxlSXNEaXJlY3RvcnldKSA9PiB7XG4gICAgICBjb25zdCByZWFsZmlsZXBhdGhzID0gZmlsZXBhdGhzLmZpbHRlcigoZiwgaSkgPT4gIWZpbGVJc0RpcmVjdG9yeVtpXSk7XG4gICAgICBjb25zdCByZWFsZGlycGF0aHMgPSBmaWxlcGF0aHMuZmlsdGVyKChmLCBpKSA9PiAhIWZpbGVJc0RpcmVjdG9yeVtpXSk7XG5cbiAgICAgIGZpbGVzID0gcmVhbGZpbGVwYXRocy5tYXAoZmlsZXBhdGggPT4gKHtcbiAgICAgICAgcGF0aDogZmlsZXBhdGgsXG4gICAgICAgIG1pbWVUeXBlOiBtaW1lLmxvb2t1cChmaWxlcGF0aCkgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSdcbiAgICAgIH0pKTtcbiAgICAgIGRpcmVjdG9yaWVzID0gcmVhbGRpcnBhdGhzO1xuXG4gICAgICBpZiAocmVjdXJzaXZlKSB7XG4gICAgICAgIHJldHVybiBibHVlYmlyZC5tYXAocmVhbGRpcnBhdGhzLCBkaXJwYXRoID0+IHNjYW4oZGlycGF0aCksIHsgY29uY3VycmVuY3k6IDEgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG4gICAgfSkudGhlbihyZXN1bHRzID0+IHtcbiAgICAgIHJlc3VsdHMuZm9yRWFjaChyZXN1bHQgPT4ge1xuICAgICAgICBmaWxlcyA9IGZpbGVzLmNvbmNhdChyZXN1bHQuZmlsZXMpO1xuICAgICAgICBkaXJlY3RvcmllcyA9IGRpcmVjdG9yaWVzLmNvbmNhdChyZXN1bHQuZGlyZWN0b3JpZXMpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4geyBmaWxlcywgZGlyZWN0b3JpZXMsIHJvb3Q6IHJvb3RQYXRoIH07XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZURyaXZlRm9sZGVyKGRpck9wdGlvbnMsIGFsbERpcnNPcHRpb25zKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3Qgc2VydmljZSA9IGdvb2dsZS5kcml2ZSgndjMnKTtcbiAgICBjb25zdCBwYXJlbnRJZCA9IGRpck9wdGlvbnMucGFyZW50SWQgfHwgYWxsRGlyc09wdGlvbnMuZmluZChvcHRpb25zID0+XG4gICAgICBvcHRpb25zLnJlbGF0aXZlUGF0aCA9PT0gZGlyT3B0aW9ucy5wYXJlbnRSZWxhdGl2ZVBhdGgpLmlkO1xuICAgIHZhciBmaWxlTWV0YWRhdGEgPSB7XG4gICAgICAnbmFtZScgOiBkaXJPcHRpb25zLm5hbWUsXG4gICAgICAnbWltZVR5cGUnIDogJ2FwcGxpY2F0aW9uL3ZuZC5nb29nbGUtYXBwcy5mb2xkZXInLFxuICAgICAgcGFyZW50czogcGFyZW50SWQgPT09ICdyb290JyA/IHVuZGVmaW5lZCA6IFsgcGFyZW50SWQgXVxuICAgIH07XG5cbiAgICBzZXJ2aWNlLmZpbGVzLmNyZWF0ZSh7XG4gICAgICAgcmVzb3VyY2U6IGZpbGVNZXRhZGF0YSxcbiAgICAgICBmaWVsZHM6ICdpZCdcbiAgICB9LCBmdW5jdGlvbihlcnIsIGZpbGUpIHtcbiAgICAgIGlmKGVycikge1xuICAgICAgICAvLyBIYW5kbGUgZXJyb3JcbiAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRpck9wdGlvbnMuaWQgPSBmaWxlLmlkO1xuICAgICAgICBjb25zb2xlLmluZm8oYCAgZm9sZGVyIFwiJHtkaXJPcHRpb25zLmRpcmVjdG9yaWVzUGF0aHMuam9pbignLycpfVwiIGNyZWF0ZWQuYCk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSlcbn1cblxuZnVuY3Rpb24gY3JlYXRlRHJpdmVGaWxlKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCBzZXJ2aWNlID0gZ29vZ2xlLmRyaXZlKCd2MycpO1xuICAgIHZhciBmaWxlTWV0YWRhdGEgPSB7XG4gICAgICAnbmFtZScgOiBvcHRpb25zLm5hbWUsXG4gICAgICAnbWltZVR5cGUnIDogb3B0aW9ucy5taW1lVHlwZSxcbiAgICAgIHBhcmVudHM6IFsgb3B0aW9ucy5wYXJlbnRJZCBdXG4gICAgfTtcbiAgICB2YXIgbWVkaWEgPSB7XG4gICAgICBtaW1lVHlwZTogb3B0aW9ucy5taW1lVHlwZSxcbiAgICAgIGJvZHk6IGZzLmNyZWF0ZVJlYWRTdHJlYW0ob3B0aW9ucy5wYXRoKVxuICAgIH07XG4gICAgc2VydmljZS5maWxlcy5jcmVhdGUoe1xuICAgICAgIHJlc291cmNlOiBmaWxlTWV0YWRhdGEsXG4gICAgICAgbWVkaWEsXG4gICAgICAgZmllbGRzOiAnaWQnXG4gICAgfSwgZnVuY3Rpb24oZXJyLCBmaWxlKSB7XG4gICAgICBpZihlcnIpIHtcbiAgICAgICAgLy8gSGFuZGxlIGVycm9yXG4gICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLmlkID0gZmlsZS5pZDtcbiAgICAgICAgY29uc29sZS5pbmZvKGAgIGZpbGUgXCIke29wdGlvbnMucmVsYXRpdmVQYXRofVwiIHVwbG9hZGVkLmApO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pXG59XG5cbi8vIGZ1bmN0aW9uXG5cbmNvbnN0IERSSVZFX1JPT1QgPSAncm9vdCc7XG5cbmNvbnNvbGUuaW5mbyhgU2Nhbm5pbmcgcm9vdCBkaXJlY3RvcnkgJHtyb290UGF0aH0uLi5gKTtcblxuYXV0aGVudGljYXRlVG9Hb29nbGUoY3JlZGVudGlhbHNQYXRoKVxuICAudGhlbigoKSA9PiBzY2FuKHJvb3RQYXRoKSlcbiAgLnRoZW4ocmVzdWx0cyA9PiB7XG4gICAgY29uc29sZS5pbmZvKCdDcmVhdGluZyByb290IGZvbGRlciAuLi4nKTtcbiAgICByZXR1cm4gYmx1ZWJpcmQuYWxsKFtyZXN1bHRzLCBjcmVhdGVEcml2ZUZvbGRlcihyb290Rm9sZGVyLCBbXSldKTtcbiAgfSlcbiAgLnRoZW4oKFtyZXN1bHRzXSkgPT4ge1xuICAgIGNvbnNvbGUuaW5mbyhgU2NhbiBjb21wbGV0ZSwgZmlsZXM6ICR7cmVzdWx0cy5maWxlcy5sZW5ndGh9IGZvbGRlcnM6ICR7cmVzdWx0cy5kaXJlY3Rvcmllcy5sZW5ndGh9LmApO1xuICAgIC8vIGNvbnNvbGUubG9nKHJlc3VsdHMpO1xuICAgIGNvbnN0IGZvbGRlcnNUb0NyZWF0ZSA9IHJlc3VsdHMuZGlyZWN0b3JpZXMubWFwKGRpcmVjdG9yeSA9PiB7XG4gICAgICBjb25zdCByZWxhdGl2ZVBhdGggPSBkaXJlY3RvcnkucmVwbGFjZShyZXN1bHRzLnJvb3QgKyAnXFxcXCcsICcnKTtcbiAgICAgIGNvbnN0IGRpcmVjdG9yaWVzUGF0aHMgPSByZWxhdGl2ZVBhdGguc3BsaXQoJ1xcXFwnKTtcbiAgICAgIGNvbnN0IHBhcmVudFJlbGF0aXZlUGF0aCA9IGRpcmVjdG9yaWVzUGF0aHMuY29uY2F0KFtdKS5zcGxpY2UoMCwgZGlyZWN0b3JpZXNQYXRocy5sZW5ndGggLSAxKS5qb2luKCdcXFxcJyk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHJlbGF0aXZlUGF0aCxcbiAgICAgICAgcGFyZW50UmVsYXRpdmVQYXRoLFxuICAgICAgICBkaXJlY3Rvcmllc1BhdGhzLFxuICAgICAgICBpZDogbnVsbCxcbiAgICAgICAgbmFtZTogZGlyZWN0b3JpZXNQYXRoc1tkaXJlY3Rvcmllc1BhdGhzLmxlbmd0aCAtIDFdLFxuICAgICAgICBwYXJlbnRJZDogZGlyZWN0b3JpZXNQYXRocy5sZW5ndGggPiAxID8gbnVsbCA6IHJvb3RGb2xkZXIuaWRcbiAgICAgIH07XG4gICAgfSlcbiAgICAvLyBzb3J0IHRvcC1sZXZlbCBkaXJlY3RvcmllcyBmaXJzdFxuICAgIC5zb3J0KChhLCBiKSA9PiBhLmRpcmVjdG9yaWVzUGF0aHMubGVuZ3RoIC0gYi5kaXJlY3Rvcmllc1BhdGhzLmxlbmd0aCk7XG5cbiAgICBjb25zb2xlLmxvZygnUmVjcmVhdGluZyBmb2xkZXIgc3RydWN0dXJlIDonKTtcbiAgICByZXR1cm4gYmx1ZWJpcmQuYWxsKFtcbiAgICAgIHJlc3VsdHMsXG4gICAgICBmb2xkZXJzVG9DcmVhdGUsXG4gICAgICBibHVlYmlyZC5tYXBTZXJpZXMoZm9sZGVyc1RvQ3JlYXRlLCBvcHRpb25zID0+IGNyZWF0ZURyaXZlRm9sZGVyKG9wdGlvbnMsIGZvbGRlcnNUb0NyZWF0ZSksXG4gICAgICAgIHsgY29uY3VycmVuY3k6IDEgfSlcbiAgICBdKTtcbiAgfSkudGhlbigoW3Jlc3VsdHMsIGZvbGRlcnNdKSA9PiB7XG4gICAgY29uc29sZS5pbmZvKCdEaXJlY3Rvcnkgc3RydWN0dXJlIGNyZWF0ZWQuJyk7XG4gICAgY29uc29sZS5pbmZvKCdTdGFydGluZyB0byB1cGxvYWQgZmlsZXMgOicpO1xuXG4gICAgY29uc3QgZmlsZXNUb0NyZWF0ZSA9IHJlc3VsdHMuZmlsZXMubWFwKGZpbGUgPT4ge1xuICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gZmlsZS5wYXRoLnJlcGxhY2UocmVzdWx0cy5yb290ICsgJ1xcXFwnLCAnJyk7XG4gICAgICBjb25zdCBkaXJlY3Rvcmllc1BhdGhzID0gcmVsYXRpdmVQYXRoLnNwbGl0KCdcXFxcJyk7XG4gICAgICBjb25zdCBwYXJlbnRSZWxhdGl2ZVBhdGggPSBkaXJlY3Rvcmllc1BhdGhzLmNvbmNhdChbXSkuc3BsaWNlKDAsIGRpcmVjdG9yaWVzUGF0aHMubGVuZ3RoIC0gMSkuam9pbignXFxcXCcpO1xuICAgICAgY29uc3QgcGFyZW50ID0gZm9sZGVycy5maW5kKGZvbGRlciA9PiBmb2xkZXIucmVsYXRpdmVQYXRoID09PSBwYXJlbnRSZWxhdGl2ZVBhdGgpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5maWxlLFxuICAgICAgICBuYW1lOiBkaXJlY3Rvcmllc1BhdGhzW2RpcmVjdG9yaWVzUGF0aHMubGVuZ3RoIC0gMV0sXG4gICAgICAgIHJlbGF0aXZlUGF0aCxcbiAgICAgICAgcGFyZW50SWQ6IHBhcmVudCA/IHBhcmVudC5pZCA6IHJvb3RGb2xkZXIuaWRcbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYmx1ZWJpcmQubWFwKGZpbGVzVG9DcmVhdGUsIG9wdGlvbnMgPT4gY3JlYXRlRHJpdmVGaWxlKG9wdGlvbnMpLFxuICAgICAgICB7IGNvbmN1cnJlbmN5OiBIVFRQX0NPTkNVUlJFTkNZIH0pO1xuICB9KVxuICAudGhlbigoKSA9PiB7XG4gICAgY29uc29sZS5pbmZvKCdJbXBvcnQgY29tcGxldGVkLiBPcGVuaW5nIHJvb3QgZm9sZGVyIGluIGJyb3dzZXIgLi4uICcpO1xuICAgIG9wbihgaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL2RyaXZlL2ZvbGRlcnMvJHtyb290Rm9sZGVyLmlkfWApO1xuICB9KVxuICAuY2F0Y2goZXJyID0+IGNvbnNvbGUuZXJyb3IoZXJyLm1lc3NhZ2UsIGVyci5zdGFjaykpO1xuXG4vKiBzY2FuKHJvb3RQYXRoKS50aGVuKHJlc3VsdHMgPT5cbiAgY29uc29sZS5pbmZvKGBTY2FuIGNvbXBsZXRlLCBmaWxlczogJHtyZXN1bHRzLmZpbGVzLmxlbmd0aH0gZm9sZGVyczogJHtyZXN1bHRzLmZpbGVzLmxlbmd0aH1gKSk7Ki9cbiJdfQ==