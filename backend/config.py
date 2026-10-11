import threading
import base64
import json
import os
import sys
import re
import uuid
import random
import urllib.request
import urllib.parse
import urllib.error
import smtplib
import hmac
import hashlib
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
PORT = int(os.environ.get("PORT", 8000))
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAVES_DIR = os.path.join(DIRECTORY, 'saves')
BACKUPS_DIR = os.path.join(DIRECTORY, 'backups')
USERS_FILE = os.path.join(DIRECTORY, 'users.json')
COMMENTS_FILE = os.path.join(DIRECTORY, 'comments.json')
NOTIFICATIONS_FILE = os.path.join(DIRECTORY, 'notifications.json')
NOTIFICATIONS_LOG = os.path.join(DIRECTORY, 'notifications.log')
SESSIONS_FILE = os.path.join(DIRECTORY, 'sessions.json')
EMAIL_CONFIG_PATH = os.path.join(DIRECTORY, 'email_config.json')

os.makedirs(SAVES_DIR, exist_ok=True)
os.makedirs(BACKUPS_DIR, exist_ok=True)

ADMIN_EMAIL = "dpoludonnyi@n-ix.com"
ADMIN_EMAILS = {"dpoludonnyi@n-ix.com", "daniel.poludyonny@gmail.com"}
ALLOWED_EMAILS = {"daniel.poludyonny@gmail.com"}
ALLOWED_DOMAIN = "@n-ix.com"
REGISTRATION_ENABLED = False  # Public registration disabled by administrator
GOOGLE_CLIENT_ID = "436412031999-5hjf625k2417tn0ua2lb395731111dvb.apps.googleusercontent.com"
TOKEN_SECRET = os.environ.get("TOKEN_SECRET", "rc-narrative-stateless-token-secret-2026")