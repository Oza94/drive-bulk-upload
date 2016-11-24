Drive Bulk Uploader
===================

Massive upload tool from local fs to Google Drive. Recreate local file structure on Google Drive.

# Prerequisites

## Node.js

[Node.js](https://nodejs.org/en/download/) must be installed on your machine.

## Generate Google Drive Crendentials

You'll need some Drive API credentials in order to use this tool :

 * Use this [wizard](https://console.developers.google.com/flows/enableapi?apiid=drive) to create or select a project in the Google Developers Console and automatically turn on the API. Click Continue, then Go to credentials.
 * At the top of the page, select the OAuth consent screen tab. Select an Email address, enter a Product name if not already set, and click the Save button.
 * Select the Credentials tab, click the Create credentials button and select OAuth client ID.
 * Select the application type Other, enter the name "Drive Bulk Uploader", and click the Create button.
 * Click OK to dismiss the resulting dialog.
 * Click the file_download (Download JSON) button to the right of the client ID.

Move this file anywhere but keep the path : we'll use it to run the upload.

# Installation

Simply run ```npm install --global drive-bulk-uploader```


# Usage

Example : 
```
C:\Users\John>drive-bulk-uploader path/to/folder --credentials path/to/secret.json
```

The first time you use the tool, it will open an authentication tab for Google Authorization process.

# Troubleshooting

If you encouter issue with authentication (or want to use another account), simply remove the cached refresh token in `~/.credentials/token.json`.
