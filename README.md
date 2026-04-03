# FiskalFlow

Automating the accountant's nightmare — Balkan invoices, receipts, and travel orders parsed in seconds. Includes **ValidDoc**, a blockchain-backed diploma and document verification system on Polygon Amoy testnet.

Upload a photo of a crumpled invoice → OCR reads the text → local AI extracts structured data → review and export to CSV. Issue document certificates → registered on-chain → share a QR code for instant employer verification. Zero cloud costs. Everything runs on your machine.

---

## 1. What is FiskalFlow

A single-user, fully local invoice processing tool for Serbian/Balkan accountants and small business owners. Supports invoices (fakture), cash receipts (gotovinski računi), and travel orders (putni nalozi) in Serbian, Bosnian, and Croatian — both Cyrillic and Latin script.

- **OCR**: pytesseract (local Tesseract installation)
- **AI extraction**: Ollama running llama3.1:8b on your machine
- **No API keys. No cloud. No subscriptions.**

### ValidDoc — Document Verification

The **ValidDoc** module lets institutions issue tamper-proof certificates (diplomas, qualifications, any official document) anchored on the Polygon Amoy blockchain.

- Issue a certificate → SHA-256 hash stored on-chain via `ValidDocRegistry` smart contract
- Each certificate gets a QR code linking to PolygonScan for instant public verification
- Employers scan the QR — no login required — and see the on-chain record
- Falls back to local-only storage (`status=pending_chain`) if the RPC is unreachable — nothing is lost

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
cd fiskalflow

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

### ValidDoc blockchain setup (optional)

Skip this if you only need invoice processing. ValidDoc will save certificates locally with `status=pending_chain` if blockchain is not configured.

1. Get a free Polygon Amoy RPC URL from [Alchemy](https://www.alchemy.com/) or use the public endpoint `https://rpc-amoy.polygon.technology`
2. Get a wallet private key (MetaMask → Account Details → Export Private Key) and fund it with free testnet MATIC from the [Polygon faucet](https://faucet.polygon.technology/)
3. Deploy the contract:
   ```bash
   cd blockchain
   pip install py-solc-x web3 python-dotenv
   python deploy.py
   # Prints: CONTRACT_ADDRESS=0x...
   ```
4. Copy the printed `CONTRACT_ADDRESS` into `backend/.env`
5. Also set in `backend/.env`:
   ```
   POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
   POLYGON_PRIVATE_KEY=<your_wallet_private_key>
   CONTRACT_ADDRESS=<address from step 4>
   ```

---

## 4. Running

Open two terminal windows:

**Terminal 1 — Backend:**
```bash
cd fiskalflow/backend
source .venv/bin/activate    # Windows: .venv\Scripts\activate
uvicorn main:app --reload
# API running at http://localhost:8000
# Docs at http://localhost:8000/docs
```

**Terminal 2 — Frontend:**
```bash
cd fiskalflow/frontend
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

**ValidDoc** adds a `blockchain/` directory containing the `ValidDocRegistry` Solidity contract (deployed to Polygon Amoy testnet) and a `deploy.py` script. The backend `BlockchainService` singleton loads the contract ABI at startup, hashes document data with SHA-256, and registers the hash on-chain via `web3.py`. If the RPC is unreachable, documents are saved locally and marked `pending_chain` — no data is lost. The public `/api/validoc/verify/{hash}` endpoint requires no authentication, enabling employers to verify a certificate by scanning its QR code.

---

## 7. Security Notes

- All data is stored locally — no data leaves your machine
- JWT tokens expire after 8 hours
- Auth endpoints are rate-limited (5 requests per 15 minutes) to prevent brute force
- File uploads are validated by extension, size (max 10MB), and magic bytes
- Uploaded images are stored with UUID-based filenames — the original filename is never used on disk
- The `.env` file contains your `SECRET_KEY` — never commit it
- The frontend contains zero secret values — only the API URL
- `POLYGON_PRIVATE_KEY` in `.env` is a wallet private key — never commit it, treat it like a password
- The ValidDoc verify endpoint (`/api/validoc/verify/{hash}`) is intentionally public — it contains no personal data beyond what is already on the public blockchain
