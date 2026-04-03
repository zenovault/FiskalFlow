"""
Deploy ValidDocRegistry.sol to Polygon Amoy Testnet.

Prerequisites:
  pip install web3 py-solc-x python-dotenv

Usage:
  1. Add POLYGON_RPC_URL and POLYGON_PRIVATE_KEY to backend/.env
  2. Run: python blockchain/deploy.py
  3. Copy the printed CONTRACT_ADDRESS into backend/.env

Faucet for Amoy testnet MATIC: https://faucet.polygon.technology
"""

import os
import sys
from pathlib import Path

# Load .env from backend/
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / "backend" / ".env")
except ImportError:
    print("ERROR: python-dotenv not installed. Run: pip install python-dotenv")
    sys.exit(1)

try:
    from solcx import compile_standard, install_solc
except ImportError:
    print("ERROR: py-solc-x not installed. Run: pip install py-solc-x")
    sys.exit(1)

try:
    from web3 import Web3
    from eth_account import Account
except ImportError:
    print("ERROR: web3 not installed. Run: pip install web3")
    sys.exit(1)

RPC_URL = os.getenv("POLYGON_RPC_URL")
PRIVATE_KEY = os.getenv("POLYGON_PRIVATE_KEY")

if not RPC_URL or not PRIVATE_KEY:
    print("ERROR: POLYGON_RPC_URL and POLYGON_PRIVATE_KEY must be set in backend/.env")
    sys.exit(1)

if PRIVATE_KEY == "your_wallet_private_key_here":
    print("ERROR: Replace POLYGON_PRIVATE_KEY with your actual wallet private key in backend/.env")
    sys.exit(1)

# Read contract source
sol_path = Path(__file__).parent / "ValidDocRegistry.sol"
source = sol_path.read_text()

print("Installing Solidity compiler 0.8.19...")
install_solc("0.8.19")

print("Compiling ValidDocRegistry.sol...")
compiled = compile_standard(
    {
        "language": "Solidity",
        "sources": {"ValidDocRegistry.sol": {"content": source}},
        "settings": {
            "outputSelection": {
                "*": {"*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]}
            }
        },
    },
    solc_version="0.8.19",
)

contract_data = compiled["contracts"]["ValidDocRegistry.sol"]["ValidDocRegistry"]
abi = contract_data["abi"]
bytecode = contract_data["evm"]["bytecode"]["object"]

print(f"Connecting to {RPC_URL}...")
w3 = Web3(Web3.HTTPProvider(RPC_URL))

if not w3.is_connected():
    print(f"ERROR: Cannot connect to RPC at {RPC_URL}")
    sys.exit(1)

account = Account.from_key(PRIVATE_KEY)
print(f"Deploying from address: {account.address}")

balance = w3.eth.get_balance(account.address)
print(f"Wallet balance: {w3.from_wei(balance, 'ether')} MATIC")

if balance == 0:
    print("WARNING: Wallet has 0 MATIC. Get testnet funds from https://faucet.polygon.technology")
    sys.exit(1)

print("Deploying ValidDocRegistry...")
Contract = w3.eth.contract(abi=abi, bytecode=bytecode)

nonce = w3.eth.get_transaction_count(account.address)
tx = Contract.constructor().build_transaction({
    "from": account.address,
    "nonce": nonce,
    "gasPrice": w3.eth.gas_price,
})

signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
print(f"Transaction sent: {tx_hash.hex()}")
print("Waiting for confirmation (~15 seconds)...")

receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

print()
print("=" * 60)
print(f"CONTRACT_ADDRESS={receipt.contractAddress}")
print("=" * 60)
print()
print(f"PolygonScan: https://amoy.polygonscan.com/address/{receipt.contractAddress}")
print()
print("Next step: Add CONTRACT_ADDRESS to backend/.env, then tell Claude Code:")
print('  "CONTRACT_ADDRESS dodat, nastavi sa Step 2"')

# Save ABI to file for use by blockchain_service.py
import json
abi_path = Path(__file__).parent / "ValidDocRegistry_abi.json"
abi_path.write_text(json.dumps(abi, indent=2))
print(f"\nABI saved to: {abi_path}")
