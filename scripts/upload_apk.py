#!/usr/bin/env python3
"""Upload APK to Google Drive with resumable upload support."""

import os
import sys
import json
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials
from google.oauth2.credentials import Credentials as UserCredentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.exceptions import DefaultCredentialsError
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

SCOPES = ['https://www.googleapis.com/auth/drive']
PROJECT_ROOT = Path(__file__).parent.parent
CREDENTIALS_FILE = PROJECT_ROOT / '.claude' / 'google_drive_credentials.json'
TOKEN_FILE = PROJECT_ROOT / '.claude' / 'google_drive_token.json'


def get_credentials():
    """Get valid user credentials for Google Drive API."""
    creds = None

    if TOKEN_FILE.exists():
        creds = UserCredentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=8080, open_browser=True)

        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())

    return creds


def find_or_create_folder(service, parent_id, folder_name):
    """Find folder by name or create it if it doesn't exist."""
    try:
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"

        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)',
            pageSize=1
        ).execute()

        files = results.get('files', [])
        if files:
            return files[0]['id']

        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        if parent_id:
            file_metadata['parents'] = [parent_id]

        folder = service.files().create(
            body=file_metadata,
            fields='id'
        ).execute()
        return folder['id']
    except HttpError as error:
        print(f"An error occurred: {error}")
        return None


def find_existing_file(service, parent_id, filename):
    """Find existing file by name in parent folder."""
    try:
        query = f"name='{filename}' and trashed=false and '{parent_id}' in parents"
        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id)',
            pageSize=1
        ).execute()
        files = results.get('files', [])
        return files[0]['id'] if files else None
    except HttpError:
        return None


def upload_apk(apk_path, folder_name='app/grocery-list'):
    """Upload APK to Google Drive."""
    apk_path = Path(apk_path)

    if not apk_path.exists():
        print(f"Error: APK file not found at {apk_path}")
        return False

    print(f"Authenticating with Google Drive...")
    try:
        creds = get_credentials()
    except FileNotFoundError:
        print(f"Error: Google Drive credentials not found at {CREDENTIALS_FILE}")
        print("Please set up OAuth credentials:")
        print("1. Go to https://console.cloud.google.com/apis/credentials")
        print("2. Create an 'OAuth 2.0 Client ID' (Desktop application)")
        print(f"3. Download as JSON and save to {CREDENTIALS_FILE}")
        return False

    service = build('drive', 'v3', credentials=creds)

    print(f"Finding or creating folder: {folder_name}")
    folders = folder_name.split('/')
    parent_id = None
    for folder in folders:
        parent_id = find_or_create_folder(service, parent_id, folder)
        if not parent_id:
            print(f"Error: Could not create folder {folder}")
            return False

    print(f"Checking for existing APK...")
    existing_id = find_existing_file(service, parent_id, apk_path.name)

    file_metadata = {'name': apk_path.name}
    if existing_id is None:
        file_metadata['parents'] = [parent_id]

    media = MediaFileUpload(apk_path, mimetype='application/vnd.android.package-archive', resumable=True)

    print(f"Uploading {apk_path.name} ({apk_path.stat().st_size / 1024 / 1024:.1f} MB)...")
    try:
        if existing_id:
            request = service.files().update(
                fileId=existing_id,
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink'
            )
        else:
            request = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink'
            )

        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                print(f"Upload progress: {int(status.progress() * 100)}%")

        file_id = response['id']
        print(f"Upload complete!")
        print(f"File ID: {file_id}")
        print(f"View: {response['webViewLink']}")
        return True

    except HttpError as error:
        print(f"Error uploading file: {error}")
        return False


if __name__ == '__main__':
    apk_path = sys.argv[1] if len(sys.argv) > 1 else \
        PROJECT_ROOT / 'app' / 'android' / 'app' / 'build' / 'outputs' / 'apk' / 'release' / 'app-release.apk'

    success = upload_apk(apk_path)
    sys.exit(0 if success else 1)
