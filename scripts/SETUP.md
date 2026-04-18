# APK Upload Setup

## Prerequisites
1. **Python 3.7+** with pip
2. **Google Cloud Project** with Drive API enabled
3. **OAuth 2.0 credentials** (Desktop application)

## Setup Steps

### 1. Install Dependencies
```bash
pip install -r scripts/requirements.txt
```

### 2. Create Google Cloud Project & OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Search for "Google Drive API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to **Credentials** in the left sidebar
   - Click **Create Credentials** → **OAuth 2.0 Client ID**
   - Choose **Desktop application**
   - Click **Create**
   - Click the download icon to get the JSON
5. Save the JSON file as `.claude/google_drive_credentials.json`

### 3. First-Time Authorization

Run the upload script once:
```bash
python3 scripts/upload_apk.py
```

This will:
- Open a browser window asking for permissions
- Save the token to `.claude/google_drive_token.json`
- Proceed with the upload

**Note:** Token is saved locally and reused for future uploads.

## Usage

### Option 1: Build & Upload (Interactive)
```bash
bash scripts/build_and_upload.sh
```
Builds the APK and prompts whether to upload.

### Option 2: Upload Existing APK
```bash
python3 scripts/upload_apk.py [path/to/apk]
```
Defaults to `app/android/app/build/outputs/apk/release/app-release.apk`

### Option 3: Upload Custom Path
```bash
python3 scripts/upload_apk.py /custom/path/to/app.apk
```

## Troubleshooting

**"Credentials not found"**
- Ensure `.claude/google_drive_credentials.json` exists
- Run setup step 2 again

**"Token expired"**
- Delete `.claude/google_drive_token.json`
- Re-run the script to re-authorize

**Upload stalls**
- Check internet connection
- Try again — resumable upload will continue from where it stopped

## Files Created

- `.claude/google_drive_credentials.json` — OAuth credentials (do not commit)
- `.claude/google_drive_token.json` — Auth token (do not commit)
