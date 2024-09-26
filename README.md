# Aptos Funds Transfer Script

This script allows you to transfer funds between wallets on the Aptos blockchain using the Aptos SDK.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Wallets

Create a file named `wallets.csv` in the root directory. This file should contain the wallets from which you want to transfer funds. The format for the first wallet (with funds) should be:

```
Aptos Address,Private key
<your-wallet-address>,<your-private-key>
```

For example:

```
Aptos Address,Private key
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,<your-private-key>
```

Ensure that the first wallet (row) contains the funds you want to transfer.

### 3. Change Transfer Amount

Edit the line in the script where the `transferFunds` function is called to set the amount you want to transfer:

```javascript
transferFunds(0.5); // Change 0.5 to your desired amount
```

### 4. Run the Script

Run the script using the following command:

```bash
npm run transfer
```
