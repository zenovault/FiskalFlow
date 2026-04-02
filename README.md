# Birokrat-Slayer

Automating the accountant's nightmare — Balkan invoices, receipts, and travel orders parsed in seconds.

Upload a photo of a crumpled invoice → OCR reads the text → local AI extracts structured data → review and export to CSV. Zero cloud costs. Everything runs on your machine.

---

## 1. What is Birokrat-Slayer

A single-user, fully local invoice processing tool for Serbian/Balkan accountants and small business owners. Supports invoices (fakture), cash receipts (gotovinski računi), and travel orders (putni nalozi) in Serbian, Bosnian, and Croatian — both Cyrillic and Latin script.

- **OCR**: pytesseract (local Tesseract installation)
- **AI extraction**: Ollama running llama3.1:8b on your machine
- **No API keys. No cloud. No subscriptions.**

---

## 2. Prerequisites

You must complete these steps before running the application.

### macOS
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Tesseract with Serbian language packs
brew install tesseract tesseract-lang

# Install Ollama
brew install ollama

# Pull the required model
ollama pull llama3.1:8b

# Python 3.11+
brew install python@3.11
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-srp tesseract-ocr-hrv python3.11 python3.11-venv

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull the required model
ollama pull llama3.1:8b
```

### Windows
1. Download and install [Tesseract 5.x](https://github.com/UB-Mannheim/tesseract/wiki) — during install, select additional language packs including Serbian
2. Download and install [Ollama for Windows](https://ollama.com/download)
3. In a terminal: `ollama pull llama3.1:8b`
4. Python 3.11+ from [python.org](https://www.python.org/downloads/)

### Verify prerequisites
```bash
python --version        # Must be 3.11+
tesseract --version     # Must be 5.x
ollama list             # Must show llama3.1:8b
```

---

## 3. Setup

```bash
# Clone the repository
git clone <repo-url>
cd birokrat-slayer

# Backend setup
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — generate a SECRET_KEY:
python -c "import secrets; print(secrets.token_hex(32))"
# Paste the output as the value of SECRET_KEY in .env

# Frontend setup
cd ../frontend
npm install
cp .env.example .env
```

---

## 4. Running

Open two terminal windows:

**Terminal 1 — Backend:**
```bash
cd birokrat-slayer/backend
source .venv/bin/activate    # Windows: .venv\Scripts\activate
uvicorn main:app --reload
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

**Terminal 2 — Frontend:**
```bash
cd birokrat-slayer/frontend
npm run dev
# App running at http://localhost:5173
```

**Also required — Ollama must be running:**
```bash
ollama serve    # (usually starts automatically on install)
```

---

## 5. First Use

1. Open `http://localhost:5173` in your browser
2. Click **Registrujte se** and create your account
3. Go to **Upload** in the sidebar
4. Drag a photo of an invoice onto the upload zone
5. Click **Procesiraj fakturu** — wait 10-30 seconds for OCR + AI processing
6. Review the extracted data in the right panel — correct any errors
7. Click **Ručno provereno** when the data looks correct
8. Export all invoices to CSV from the **Računi** page

---

## 6. Architecture

FastAPI backend (Python 3.11) serves a REST API on port 8000, storing data in a local SQLite database. Uploaded invoice images are processed through a two-stage pipeline: pytesseract performs OCR to extract raw text, which is then sent to a locally-running Ollama instance (llama3.1:8b) with a structured extraction prompt tuned for Balkan accounting documents. The React/Vite frontend communicates with the backend via JWT-authenticated Axios requests, presenting an editable form of the extracted data for human review before export.

---

## 7. Security Notes

- All data is stored locally — no data leaves your machine
- JWT tokens expire after 8 hours
- Auth endpoints are rate-limited (5 requests per 15 minutes) to prevent brute force
- File uploads are validated by extension, size (max 10MB), and magic bytes
- Uploaded images are stored with UUID-based filenames — the original filename is never used on disk
- The `.env` file contains your `SECRET_KEY` — never commit it
- The frontend contains zero secret values — only the API URL
