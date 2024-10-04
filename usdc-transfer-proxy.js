import {
  Ed25519PrivateKey,
  Aptos,
  Account,
  AptosConfig,
  Network,
  generateTransactionPayload,
  generateRawTransaction,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";
import fs from "fs";
import { callTx } from "./callTx.js";
import { getHTTPProxyAgent } from "./getProxy.js";

const aptosConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: "https://aptos.testnet.suzuka.movementlabs.xyz/v1",
});

export const aptos = new Aptos(aptosConfig);
const COIN_STORE = "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>";
const USDC = "0x275f508689de8756169d1ee02d889c777de1cebda3a7bbcce63ba8a27c563c6f::tokens::USDC";

async function getTokenBalance(accountAddress, tokenType) {
  try {
    const resources = await aptos.account.getAccountResources({ accountAddress });

    const tokenResource = resources.find(resource => resource.type === `0x1::coin::CoinStore<${tokenType}>`);
    return tokenResource ? tokenResource.data.coin.value : '0'; // Return '0' if no balance found
  } catch (error) {
    console.error(`Error fetching ${tokenType} balance:`, error);
  }
}

function writeFile(path, data, options) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, options, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}

async function getLastIndex() {
  try {
    const index = fs.readFileSync("index-usdc-from-single.txt", "utf8");
    return parseInt(index);
  } catch (error) {
    return 0; // Return 0 if there's an error reading the file
  }
}

async function saveWalletIndex(index) {
  await writeFile("index-usdc-from-single.txt", index.toString(), { flag: "w" });
}

async function saveTransactionToCsv(walletAddress, version) {
  await writeFile("index-usdc-from-single.csv", `${walletAddress},${version}\n`, { flag: "a" });
}

async function transferFunds(amount) {
  const wallets = fs
    .readFileSync("wallets.csv", "utf8")
    .split("\n")
    .map((line) => {
      if (
        line.includes("Aptos Address") ||
        line === "" ||
        line === "\n" ||
        line.includes("Private key") ||
        line.includes("wallet")
      ) {
        return null;
      }
      const [privateKey, address] = line.split(",");
      return {
        "Aptos Address": address,
        "Private key": privateKey,
      };
    })
    .filter((wallet) => wallet !== null);

  const walletCount = wallets.length;
  const lastIndex = await getLastIndex();

  console.log(
    `Starting transfer from wallet at index ${lastIndex} to (${wallets[0]["Aptos Address"]})`
  );

  for (let walletIndex = lastIndex; walletIndex < walletCount; walletIndex++) {
    const wallet = wallets[walletIndex];
    const walletAddress = wallets[0]["Aptos Address"];
    const receiverAddress = wallet["Aptos Address"];
    const privateKeyHex = wallets[0]["Private key"];

    if (!walletAddress || !privateKeyHex) {
      console.error(`Invalid wallet data at index ${walletIndex}`);
      continue;
    }

    try {
      const usableWalletPrivateKey = new Ed25519PrivateKey(privateKeyHex);
      const usableWallet = Account.fromPrivateKey({
        privateKey: usableWalletPrivateKey,
        address: walletAddress,
      });

      const availableBalance = await getTokenBalance(walletAddress, USDC);
      console.log(`Available balance: ${availableBalance}`);

      if (availableBalance < 100) {
        console.error(`Insufficient balance for wallet at index ${walletIndex}. Skipping`);
        continue;
      }

      // Fetch necessary data
      const transferAmount = 10; // Replace with actual amount

      // Build the transaction data
      const transactionData = {
        function: "0x1::aptos_account::transfer_coins",
        functionArguments: [receiverAddress, (transferAmount * 10 ** 6).toString()],
        typeArguments: [USDC],
      };

      // Generate the transaction payload
      const transactionPayload = await generateTransactionPayload({
        function: transactionData.function,
        typeArguments: transactionData.typeArguments,
        functionArguments: transactionData.functionArguments,
        aptosConfig,
      });

      // Create the raw transaction
      const rawTransaction = await generateRawTransaction({
        aptosConfig,
        sender: usableWallet.accountAddress,
        payload: transactionPayload,
      });

      // Sign the transaction
      const txn = new SimpleTransaction(rawTransaction);
      const signature = usableWallet.signTransactionWithAuthenticator(txn);

      const signatureData = {
        type: "ed25519_signature",
        public_key: signature.public_key.toString(),
        signature: signature.signature.toString(),
      };

      // Prepare the call data
      const callData = {
        sender: usableWallet.accountAddress.toString(),
        sequence_number: rawTransaction.sequence_number.toString(),
        max_gas_amount: rawTransaction.max_gas_amount.toString(),
        gas_unit_price: rawTransaction.gas_unit_price.toString(),
        expiration_timestamp_secs: rawTransaction.expiration_timestamp_secs.toString(),
        payload: {
          type: "entry_function_payload",
          function: transactionData.function,
          type_arguments: transactionData.typeArguments,
          arguments: transactionData.functionArguments,
        },
        signature: signatureData,
      };

      // Submit the transaction
      const httpProxyAgent = await getHTTPProxyAgent();
      const options = {
        method: "POST",
        url: "https://aptos.testnet.suzuka.movementlabs.xyz/v1/transactions",
        headers: { "Content-Type": "application/json" },
        data: callData,
        httpProxyAgent,
      };

      // Submit and wait for transaction confirmation
      const response = await callTx(options, aptos);

      // Save walletIndex to index.txt
      await saveWalletIndex(walletIndex);

      // Save walletAddress and transaction version to CSV
      await saveTransactionToCsv(walletAddress, response);
    } catch (error) {
      console.error(`Failed to transfer to wallet at index ${walletIndex}:`, error);
      break; // Break the loop if an error occurs, preserving the current index
    }
  }
}

transferFunds(0.5)
  .then(() => console.log("Transfer complete"))
  .catch((error) => console.error("Failed to transfer funds:", error));
