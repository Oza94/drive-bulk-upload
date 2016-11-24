'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.authenticateToGoogle = authenticateToGoogle;
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var opn = require('opn');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/drive.file'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'token.json';

// Load client secrets from a local file.
/* fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Drive API.
  authorize(JSON.parse(content), listFiles);
}); */

function authenticateToGoogle(credentialsPath) {
  return new Promise(function (resolve, reject) {
    fs.readFile(credentialsPath, function processClientSecrets(err, content) {
      if (err) {
        console.log('Error loading client secret file: ' + err);
        return;
      }
      // Authorize a client with the loaded credentials, then call the
      // Drive API.
      authorize(JSON.parse(content), function (auth) {
        google.options({ auth: auth });
        resolve();
      });
    });
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function (err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  opn(authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function (code) {
    rl.close();
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
  var service = google.drive('v3');
  var fileMetadata = {
    name: 'test',
    mimeType: 'text/plain'
  };
  var media = {
    mimeType: 'text/plan',
    body: fs.createReadStream('index.js')
  };
  service.files.create({
    auth: auth,
    resource: fileMetadata,
    media: media,
    fields: 'id'
  }, function (err, file) {
    if (err) {
      // Handle error
      console.log(err);
    } else {
      console.log('File Id:', file.id);
    }
  });
  /*service.files.list({
    auth: auth,
    pageSize: 10,
    fields: "nextPageToken, files(id, name)"
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var files = response.files;
    if (files.length == 0) {
      console.log('No files found.');
    } else {
      console.log('Files:');
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        console.log('%s (%s)', file.name, file.id);
      }
    }
  });*/
}

exports.default = { authenticateToGoogle: authenticateToGoogle };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9kcml2ZS5qcyJdLCJuYW1lcyI6WyJhdXRoZW50aWNhdGVUb0dvb2dsZSIsImZzIiwicmVxdWlyZSIsInJlYWRsaW5lIiwiZ29vZ2xlIiwiZ29vZ2xlQXV0aCIsIm9wbiIsIlNDT1BFUyIsIlRPS0VOX0RJUiIsInByb2Nlc3MiLCJlbnYiLCJIT01FIiwiSE9NRVBBVEgiLCJVU0VSUFJPRklMRSIsIlRPS0VOX1BBVEgiLCJjcmVkZW50aWFsc1BhdGgiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRGaWxlIiwicHJvY2Vzc0NsaWVudFNlY3JldHMiLCJlcnIiLCJjb250ZW50IiwiY29uc29sZSIsImxvZyIsImF1dGhvcml6ZSIsIkpTT04iLCJwYXJzZSIsImF1dGgiLCJvcHRpb25zIiwiY3JlZGVudGlhbHMiLCJjYWxsYmFjayIsImNsaWVudFNlY3JldCIsImluc3RhbGxlZCIsImNsaWVudF9zZWNyZXQiLCJjbGllbnRJZCIsImNsaWVudF9pZCIsInJlZGlyZWN0VXJsIiwicmVkaXJlY3RfdXJpcyIsIm9hdXRoMkNsaWVudCIsIk9BdXRoMiIsInRva2VuIiwiZ2V0TmV3VG9rZW4iLCJhdXRoVXJsIiwiZ2VuZXJhdGVBdXRoVXJsIiwiYWNjZXNzX3R5cGUiLCJzY29wZSIsInJsIiwiY3JlYXRlSW50ZXJmYWNlIiwiaW5wdXQiLCJzdGRpbiIsIm91dHB1dCIsInN0ZG91dCIsInF1ZXN0aW9uIiwiY29kZSIsImNsb3NlIiwiZ2V0VG9rZW4iLCJzdG9yZVRva2VuIiwibWtkaXJTeW5jIiwid3JpdGVGaWxlIiwic3RyaW5naWZ5IiwibGlzdEZpbGVzIiwic2VydmljZSIsImRyaXZlIiwiZmlsZU1ldGFkYXRhIiwibmFtZSIsIm1pbWVUeXBlIiwibWVkaWEiLCJib2R5IiwiY3JlYXRlUmVhZFN0cmVhbSIsImZpbGVzIiwiY3JlYXRlIiwicmVzb3VyY2UiLCJmaWVsZHMiLCJmaWxlIiwiaWQiXSwibWFwcGluZ3MiOiI7Ozs7O1FBd0JnQkEsb0IsR0FBQUEsb0I7QUF4QmhCLElBQUlDLEtBQUtDLFFBQVEsSUFBUixDQUFUO0FBQ0EsSUFBSUMsV0FBV0QsUUFBUSxVQUFSLENBQWY7QUFDQSxJQUFJRSxTQUFTRixRQUFRLFlBQVIsQ0FBYjtBQUNBLElBQUlHLGFBQWFILFFBQVEscUJBQVIsQ0FBakI7QUFDQSxJQUFJSSxNQUFNSixRQUFRLEtBQVIsQ0FBVjs7QUFFQTtBQUNBO0FBQ0EsSUFBSUssU0FBUyxDQUFDLDRDQUFELENBQWI7QUFDQSxJQUFJQyxZQUFZLENBQUNDLFFBQVFDLEdBQVIsQ0FBWUMsSUFBWixJQUFvQkYsUUFBUUMsR0FBUixDQUFZRSxRQUFoQyxJQUNiSCxRQUFRQyxHQUFSLENBQVlHLFdBREEsSUFDZSxnQkFEL0I7QUFFQSxJQUFJQyxhQUFhTixZQUFZLFlBQTdCOztBQUVBO0FBQ0E7Ozs7Ozs7Ozs7QUFVTyxTQUFTUixvQkFBVCxDQUE4QmUsZUFBOUIsRUFBK0M7QUFDcEQsU0FBTyxJQUFJQyxPQUFKLENBQVksVUFBQ0MsT0FBRCxFQUFVQyxNQUFWLEVBQXFCO0FBQ3RDakIsT0FBR2tCLFFBQUgsQ0FBWUosZUFBWixFQUE2QixTQUFTSyxvQkFBVCxDQUE4QkMsR0FBOUIsRUFBbUNDLE9BQW5DLEVBQTRDO0FBQ3ZFLFVBQUlELEdBQUosRUFBUztBQUNQRSxnQkFBUUMsR0FBUixDQUFZLHVDQUF1Q0gsR0FBbkQ7QUFDQTtBQUNEO0FBQ0Q7QUFDQTtBQUNBSSxnQkFBVUMsS0FBS0MsS0FBTCxDQUFXTCxPQUFYLENBQVYsRUFBK0IsVUFBQ00sSUFBRCxFQUFVO0FBQ3ZDeEIsZUFBT3lCLE9BQVAsQ0FBZSxFQUFFRCxVQUFGLEVBQWY7QUFDQVg7QUFDRCxPQUhEO0FBSUQsS0FYRDtBQVlELEdBYk0sQ0FBUDtBQWNEOztBQUVEOzs7Ozs7O0FBT0EsU0FBU1EsU0FBVCxDQUFtQkssV0FBbkIsRUFBZ0NDLFFBQWhDLEVBQTBDO0FBQ3hDLE1BQUlDLGVBQWVGLFlBQVlHLFNBQVosQ0FBc0JDLGFBQXpDO0FBQ0EsTUFBSUMsV0FBV0wsWUFBWUcsU0FBWixDQUFzQkcsU0FBckM7QUFDQSxNQUFJQyxjQUFjUCxZQUFZRyxTQUFaLENBQXNCSyxhQUF0QixDQUFvQyxDQUFwQyxDQUFsQjtBQUNBLE1BQUlWLE9BQU8sSUFBSXZCLFVBQUosRUFBWDtBQUNBLE1BQUlrQyxlQUFlLElBQUlYLEtBQUtZLE1BQVQsQ0FBZ0JMLFFBQWhCLEVBQTBCSCxZQUExQixFQUF3Q0ssV0FBeEMsQ0FBbkI7O0FBRUE7QUFDQXBDLEtBQUdrQixRQUFILENBQVlMLFVBQVosRUFBd0IsVUFBU08sR0FBVCxFQUFjb0IsS0FBZCxFQUFxQjtBQUMzQyxRQUFJcEIsR0FBSixFQUFTO0FBQ1BxQixrQkFBWUgsWUFBWixFQUEwQlIsUUFBMUI7QUFDRCxLQUZELE1BRU87QUFDTFEsbUJBQWFULFdBQWIsR0FBMkJKLEtBQUtDLEtBQUwsQ0FBV2MsS0FBWCxDQUEzQjtBQUNBVixlQUFTUSxZQUFUO0FBQ0Q7QUFDRixHQVBEO0FBUUQ7O0FBRUQ7Ozs7Ozs7O0FBUUEsU0FBU0csV0FBVCxDQUFxQkgsWUFBckIsRUFBbUNSLFFBQW5DLEVBQTZDO0FBQzNDLE1BQUlZLFVBQVVKLGFBQWFLLGVBQWIsQ0FBNkI7QUFDekNDLGlCQUFhLFNBRDRCO0FBRXpDQyxXQUFPdkM7QUFGa0MsR0FBN0IsQ0FBZDtBQUlBZ0IsVUFBUUMsR0FBUixDQUFZLDJDQUFaLEVBQXlEbUIsT0FBekQ7QUFDQXJDLE1BQUlxQyxPQUFKO0FBQ0EsTUFBSUksS0FBSzVDLFNBQVM2QyxlQUFULENBQXlCO0FBQ2hDQyxXQUFPeEMsUUFBUXlDLEtBRGlCO0FBRWhDQyxZQUFRMUMsUUFBUTJDO0FBRmdCLEdBQXpCLENBQVQ7QUFJQUwsS0FBR00sUUFBSCxDQUFZLHNDQUFaLEVBQW9ELFVBQVNDLElBQVQsRUFBZTtBQUNqRVAsT0FBR1EsS0FBSDtBQUNBaEIsaUJBQWFpQixRQUFiLENBQXNCRixJQUF0QixFQUE0QixVQUFTakMsR0FBVCxFQUFjb0IsS0FBZCxFQUFxQjtBQUMvQyxVQUFJcEIsR0FBSixFQUFTO0FBQ1BFLGdCQUFRQyxHQUFSLENBQVksNkNBQVosRUFBMkRILEdBQTNEO0FBQ0E7QUFDRDtBQUNEa0IsbUJBQWFULFdBQWIsR0FBMkJXLEtBQTNCO0FBQ0FnQixpQkFBV2hCLEtBQVg7QUFDQVYsZUFBU1EsWUFBVDtBQUNELEtBUkQ7QUFTRCxHQVhEO0FBWUQ7O0FBRUQ7Ozs7O0FBS0EsU0FBU2tCLFVBQVQsQ0FBb0JoQixLQUFwQixFQUEyQjtBQUN6QixNQUFJO0FBQ0Z4QyxPQUFHeUQsU0FBSCxDQUFhbEQsU0FBYjtBQUNELEdBRkQsQ0FFRSxPQUFPYSxHQUFQLEVBQVk7QUFDWixRQUFJQSxJQUFJaUMsSUFBSixJQUFZLFFBQWhCLEVBQTBCO0FBQ3hCLFlBQU1qQyxHQUFOO0FBQ0Q7QUFDRjtBQUNEcEIsS0FBRzBELFNBQUgsQ0FBYTdDLFVBQWIsRUFBeUJZLEtBQUtrQyxTQUFMLENBQWVuQixLQUFmLENBQXpCO0FBQ0FsQixVQUFRQyxHQUFSLENBQVkscUJBQXFCVixVQUFqQztBQUNEOztBQUVEOzs7OztBQUtBLFNBQVMrQyxTQUFULENBQW1CakMsSUFBbkIsRUFBeUI7QUFDdkIsTUFBSWtDLFVBQVUxRCxPQUFPMkQsS0FBUCxDQUFhLElBQWIsQ0FBZDtBQUNBLE1BQUlDLGVBQWU7QUFDakJDLFVBQU0sTUFEVztBQUVqQkMsY0FBVTtBQUZPLEdBQW5CO0FBSUEsTUFBSUMsUUFBUTtBQUNWRCxjQUFVLFdBREE7QUFFVkUsVUFBTW5FLEdBQUdvRSxnQkFBSCxDQUFvQixVQUFwQjtBQUZJLEdBQVo7QUFJQVAsVUFBUVEsS0FBUixDQUFjQyxNQUFkLENBQXFCO0FBQ25CM0MsVUFBTUEsSUFEYTtBQUVuQjRDLGNBQVVSLFlBRlM7QUFHbkJHLFdBQU9BLEtBSFk7QUFJbkJNLFlBQVE7QUFKVyxHQUFyQixFQUtHLFVBQVNwRCxHQUFULEVBQWNxRCxJQUFkLEVBQW9CO0FBQ3JCLFFBQUdyRCxHQUFILEVBQVE7QUFDTjtBQUNBRSxjQUFRQyxHQUFSLENBQVlILEdBQVo7QUFDRCxLQUhELE1BR087QUFDTEUsY0FBUUMsR0FBUixDQUFZLFVBQVosRUFBeUJrRCxLQUFLQyxFQUE5QjtBQUNEO0FBQ0YsR0FaRDtBQWFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW9CRDs7a0JBRWMsRUFBRTNFLDBDQUFGLEUiLCJmaWxlIjoiZHJpdmUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgZnMgPSByZXF1aXJlKCdmcycpO1xudmFyIHJlYWRsaW5lID0gcmVxdWlyZSgncmVhZGxpbmUnKTtcbnZhciBnb29nbGUgPSByZXF1aXJlKCdnb29nbGVhcGlzJyk7XG52YXIgZ29vZ2xlQXV0aCA9IHJlcXVpcmUoJ2dvb2dsZS1hdXRoLWxpYnJhcnknKTtcbnZhciBvcG4gPSByZXF1aXJlKCdvcG4nKTtcblxuLy8gSWYgbW9kaWZ5aW5nIHRoZXNlIHNjb3BlcywgZGVsZXRlIHlvdXIgcHJldmlvdXNseSBzYXZlZCBjcmVkZW50aWFsc1xuLy8gYXQgfi8uY3JlZGVudGlhbHMvZHJpdmUtbm9kZWpzLXF1aWNrc3RhcnQuanNvblxudmFyIFNDT1BFUyA9IFsnaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC9kcml2ZS5maWxlJ107XG52YXIgVE9LRU5fRElSID0gKHByb2Nlc3MuZW52LkhPTUUgfHwgcHJvY2Vzcy5lbnYuSE9NRVBBVEggfHxcbiAgICBwcm9jZXNzLmVudi5VU0VSUFJPRklMRSkgKyAnLy5jcmVkZW50aWFscy8nO1xudmFyIFRPS0VOX1BBVEggPSBUT0tFTl9ESVIgKyAndG9rZW4uanNvbic7XG5cbi8vIExvYWQgY2xpZW50IHNlY3JldHMgZnJvbSBhIGxvY2FsIGZpbGUuXG4vKiBmcy5yZWFkRmlsZSgnY2xpZW50X3NlY3JldC5qc29uJywgZnVuY3Rpb24gcHJvY2Vzc0NsaWVudFNlY3JldHMoZXJyLCBjb250ZW50KSB7XG4gIGlmIChlcnIpIHtcbiAgICBjb25zb2xlLmxvZygnRXJyb3IgbG9hZGluZyBjbGllbnQgc2VjcmV0IGZpbGU6ICcgKyBlcnIpO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBBdXRob3JpemUgYSBjbGllbnQgd2l0aCB0aGUgbG9hZGVkIGNyZWRlbnRpYWxzLCB0aGVuIGNhbGwgdGhlXG4gIC8vIERyaXZlIEFQSS5cbiAgYXV0aG9yaXplKEpTT04ucGFyc2UoY29udGVudCksIGxpc3RGaWxlcyk7XG59KTsgKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGF1dGhlbnRpY2F0ZVRvR29vZ2xlKGNyZWRlbnRpYWxzUGF0aCkge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGZzLnJlYWRGaWxlKGNyZWRlbnRpYWxzUGF0aCwgZnVuY3Rpb24gcHJvY2Vzc0NsaWVudFNlY3JldHMoZXJyLCBjb250ZW50KSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciBsb2FkaW5nIGNsaWVudCBzZWNyZXQgZmlsZTogJyArIGVycik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIEF1dGhvcml6ZSBhIGNsaWVudCB3aXRoIHRoZSBsb2FkZWQgY3JlZGVudGlhbHMsIHRoZW4gY2FsbCB0aGVcbiAgICAgIC8vIERyaXZlIEFQSS5cbiAgICAgIGF1dGhvcml6ZShKU09OLnBhcnNlKGNvbnRlbnQpLCAoYXV0aCkgPT4ge1xuICAgICAgICBnb29nbGUub3B0aW9ucyh7IGF1dGggfSk7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gT0F1dGgyIGNsaWVudCB3aXRoIHRoZSBnaXZlbiBjcmVkZW50aWFscywgYW5kIHRoZW4gZXhlY3V0ZSB0aGVcbiAqIGdpdmVuIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjcmVkZW50aWFscyBUaGUgYXV0aG9yaXphdGlvbiBjbGllbnQgY3JlZGVudGlhbHMuXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gY2FsbCB3aXRoIHRoZSBhdXRob3JpemVkIGNsaWVudC5cbiAqL1xuZnVuY3Rpb24gYXV0aG9yaXplKGNyZWRlbnRpYWxzLCBjYWxsYmFjaykge1xuICB2YXIgY2xpZW50U2VjcmV0ID0gY3JlZGVudGlhbHMuaW5zdGFsbGVkLmNsaWVudF9zZWNyZXQ7XG4gIHZhciBjbGllbnRJZCA9IGNyZWRlbnRpYWxzLmluc3RhbGxlZC5jbGllbnRfaWQ7XG4gIHZhciByZWRpcmVjdFVybCA9IGNyZWRlbnRpYWxzLmluc3RhbGxlZC5yZWRpcmVjdF91cmlzWzBdO1xuICB2YXIgYXV0aCA9IG5ldyBnb29nbGVBdXRoKCk7XG4gIHZhciBvYXV0aDJDbGllbnQgPSBuZXcgYXV0aC5PQXV0aDIoY2xpZW50SWQsIGNsaWVudFNlY3JldCwgcmVkaXJlY3RVcmwpO1xuXG4gIC8vIENoZWNrIGlmIHdlIGhhdmUgcHJldmlvdXNseSBzdG9yZWQgYSB0b2tlbi5cbiAgZnMucmVhZEZpbGUoVE9LRU5fUEFUSCwgZnVuY3Rpb24oZXJyLCB0b2tlbikge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIGdldE5ld1Rva2VuKG9hdXRoMkNsaWVudCwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYXV0aDJDbGllbnQuY3JlZGVudGlhbHMgPSBKU09OLnBhcnNlKHRva2VuKTtcbiAgICAgIGNhbGxiYWNrKG9hdXRoMkNsaWVudCk7XG4gICAgfVxuICB9KTtcbn1cblxuLyoqXG4gKiBHZXQgYW5kIHN0b3JlIG5ldyB0b2tlbiBhZnRlciBwcm9tcHRpbmcgZm9yIHVzZXIgYXV0aG9yaXphdGlvbiwgYW5kIHRoZW5cbiAqIGV4ZWN1dGUgdGhlIGdpdmVuIGNhbGxiYWNrIHdpdGggdGhlIGF1dGhvcml6ZWQgT0F1dGgyIGNsaWVudC5cbiAqXG4gKiBAcGFyYW0ge2dvb2dsZS5hdXRoLk9BdXRoMn0gb2F1dGgyQ2xpZW50IFRoZSBPQXV0aDIgY2xpZW50IHRvIGdldCB0b2tlbiBmb3IuXG4gKiBAcGFyYW0ge2dldEV2ZW50c0NhbGxiYWNrfSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgdG8gY2FsbCB3aXRoIHRoZSBhdXRob3JpemVkXG4gKiAgICAgY2xpZW50LlxuICovXG5mdW5jdGlvbiBnZXROZXdUb2tlbihvYXV0aDJDbGllbnQsIGNhbGxiYWNrKSB7XG4gIHZhciBhdXRoVXJsID0gb2F1dGgyQ2xpZW50LmdlbmVyYXRlQXV0aFVybCh7XG4gICAgYWNjZXNzX3R5cGU6ICdvZmZsaW5lJyxcbiAgICBzY29wZTogU0NPUEVTXG4gIH0pO1xuICBjb25zb2xlLmxvZygnQXV0aG9yaXplIHRoaXMgYXBwIGJ5IHZpc2l0aW5nIHRoaXMgdXJsOiAnLCBhdXRoVXJsKTtcbiAgb3BuKGF1dGhVcmwpO1xuICB2YXIgcmwgPSByZWFkbGluZS5jcmVhdGVJbnRlcmZhY2Uoe1xuICAgIGlucHV0OiBwcm9jZXNzLnN0ZGluLFxuICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcbiAgfSk7XG4gIHJsLnF1ZXN0aW9uKCdFbnRlciB0aGUgY29kZSBmcm9tIHRoYXQgcGFnZSBoZXJlOiAnLCBmdW5jdGlvbihjb2RlKSB7XG4gICAgcmwuY2xvc2UoKTtcbiAgICBvYXV0aDJDbGllbnQuZ2V0VG9rZW4oY29kZSwgZnVuY3Rpb24oZXJyLCB0b2tlbikge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBjb25zb2xlLmxvZygnRXJyb3Igd2hpbGUgdHJ5aW5nIHRvIHJldHJpZXZlIGFjY2VzcyB0b2tlbicsIGVycik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIG9hdXRoMkNsaWVudC5jcmVkZW50aWFscyA9IHRva2VuO1xuICAgICAgc3RvcmVUb2tlbih0b2tlbik7XG4gICAgICBjYWxsYmFjayhvYXV0aDJDbGllbnQpO1xuICAgIH0pO1xuICB9KTtcbn1cblxuLyoqXG4gKiBTdG9yZSB0b2tlbiB0byBkaXNrIGJlIHVzZWQgaW4gbGF0ZXIgcHJvZ3JhbSBleGVjdXRpb25zLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0b2tlbiBUaGUgdG9rZW4gdG8gc3RvcmUgdG8gZGlzay5cbiAqL1xuZnVuY3Rpb24gc3RvcmVUb2tlbih0b2tlbikge1xuICB0cnkge1xuICAgIGZzLm1rZGlyU3luYyhUT0tFTl9ESVIpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyLmNvZGUgIT0gJ0VFWElTVCcpIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cbiAgZnMud3JpdGVGaWxlKFRPS0VOX1BBVEgsIEpTT04uc3RyaW5naWZ5KHRva2VuKSk7XG4gIGNvbnNvbGUubG9nKCdUb2tlbiBzdG9yZWQgdG8gJyArIFRPS0VOX1BBVEgpO1xufVxuXG4vKipcbiAqIExpc3RzIHRoZSBuYW1lcyBhbmQgSURzIG9mIHVwIHRvIDEwIGZpbGVzLlxuICpcbiAqIEBwYXJhbSB7Z29vZ2xlLmF1dGguT0F1dGgyfSBhdXRoIEFuIGF1dGhvcml6ZWQgT0F1dGgyIGNsaWVudC5cbiAqL1xuZnVuY3Rpb24gbGlzdEZpbGVzKGF1dGgpIHtcbiAgdmFyIHNlcnZpY2UgPSBnb29nbGUuZHJpdmUoJ3YzJyk7XG4gIHZhciBmaWxlTWV0YWRhdGEgPSB7XG4gICAgbmFtZTogJ3Rlc3QnLFxuICAgIG1pbWVUeXBlOiAndGV4dC9wbGFpbidcbiAgfTtcbiAgdmFyIG1lZGlhID0ge1xuICAgIG1pbWVUeXBlOiAndGV4dC9wbGFuJyxcbiAgICBib2R5OiBmcy5jcmVhdGVSZWFkU3RyZWFtKCdpbmRleC5qcycpXG4gIH07XG4gIHNlcnZpY2UuZmlsZXMuY3JlYXRlKHtcbiAgICBhdXRoOiBhdXRoLFxuICAgIHJlc291cmNlOiBmaWxlTWV0YWRhdGEsXG4gICAgbWVkaWE6IG1lZGlhLFxuICAgIGZpZWxkczogJ2lkJ1xuICB9LCBmdW5jdGlvbihlcnIsIGZpbGUpIHtcbiAgICBpZihlcnIpIHtcbiAgICAgIC8vIEhhbmRsZSBlcnJvclxuICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coJ0ZpbGUgSWQ6JyAsIGZpbGUuaWQpO1xuICAgIH1cbiAgfSk7XG4gIC8qc2VydmljZS5maWxlcy5saXN0KHtcbiAgICBhdXRoOiBhdXRoLFxuICAgIHBhZ2VTaXplOiAxMCxcbiAgICBmaWVsZHM6IFwibmV4dFBhZ2VUb2tlbiwgZmlsZXMoaWQsIG5hbWUpXCJcbiAgfSwgZnVuY3Rpb24oZXJyLCByZXNwb25zZSkge1xuICAgIGlmIChlcnIpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdUaGUgQVBJIHJldHVybmVkIGFuIGVycm9yOiAnICsgZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGZpbGVzID0gcmVzcG9uc2UuZmlsZXM7XG4gICAgaWYgKGZpbGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICBjb25zb2xlLmxvZygnTm8gZmlsZXMgZm91bmQuJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdGaWxlczonKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZmlsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGZpbGUgPSBmaWxlc1tpXTtcbiAgICAgICAgY29uc29sZS5sb2coJyVzICglcyknLCBmaWxlLm5hbWUsIGZpbGUuaWQpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7Ki9cbn1cblxuZXhwb3J0IGRlZmF1bHQgeyBhdXRoZW50aWNhdGVUb0dvb2dsZSB9XG4iXX0=