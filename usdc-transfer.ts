import {
    Ed25519PrivateKey,  
    Aptos,
    Account,
    AptosConfig,
    Network,
} from "@aptos-labs/ts-sdk";
import * as fs from "fs";

const aptosConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: "https://aptos.testnet.suzuka.movementlabs.xyz/v1",
});
  
export const aptos = new Aptos(aptosConfig);
const COIN_STORE = "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>";
const USDC = "0x275f508689de8756169d1ee02d889c777de1cebda3a7bbcce63ba8a27c563c6f::tokens::USDC"

async function getTokenBalance(accountAddress: string, tokenType: string) {
  try {
      const resources = await aptos.account.getAccountResources({ accountAddress: accountAddress });

      const tokenResource = resources.find(resource => resource.type === `0x1::coin::CoinStore<${tokenType}>`);
      if (tokenResource) {
          return (tokenResource.data as any).coin.value;
      } else {
          return '0'; // If no balance found
      }
  } catch (error) {
      console.error(`Error fetching ${tokenType} balance:`, error);
  }
}

  
  function writeFile(path: string, data: string, options: any) {
    try {
      return new Promise<void>((resolve, reject) => {
        fs.writeFile(path, data, options, (err) => {
          if (err) reject(err);
          resolve();
        });
      });
    } catch (error) {
      console.error("Failed to write file:", error);
    }
  }
  
  async function getLastIndex() {
    try {
      const index = fs.readFileSync("index.txt", "utf8");
      return parseInt(index);
    } catch (error) {
      return 0;
    }
  }
  
  async function saveWalletIndex(index: number) {
    await writeFile("index.txt", index.toString(), { flag: "w" });
  }
  
  async function saveTransactionToCsv(walletAddress: string, version: string) {
    await writeFile(
      "transactions.csv",
      `${walletAddress},${version}\n`,
      { flag: "a" }
    );
  }
  
  async function transferFunds(amount: number) {
    const wallets = fs
      .readFileSync("wallets.csv", "utf8")
      .split("\n")
      .map((line) => {
        // except first line
        if (
          line.includes("Aptos Address") ||
          line === "" ||
          line === "\n" ||
          line.includes("Private key") ||
          line.includes("wallet")
        ) {
          return null;
        }
        const [address, privateKey] = line.split(",");
        return {
          "Aptos Address": address,
          "Private key": privateKey,
        };
      })
      .filter((wallet) => wallet !== null);
    const walletCount = wallets.length;
    const lastIndex = await getLastIndex();
  
    // Initialize CSV file with headers if it doesn't exist
    const walletAddressAtFirstIndex = wallets[0]["Aptos Address"];
    console.log(
      `Starting transfer from wallet at index ${lastIndex} to (${walletAddressAtFirstIndex})`
    );
    for (let walletIndex = lastIndex; walletIndex < walletCount; walletIndex++) {
      const wallet = wallets[walletIndex];
      const walletAddress = wallets[0]["Aptos Address"];
      const receiverAddress = wallet["Aptos Address"];
      const privateKeyHex = wallets[0]["Private key"];
      console.log({
        walletAddress,
        privateKeyHex,
      });
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
  
        const availableBalance = await getTokenBalance(
          walletAddress,
          USDC
        );
        console.log(`Available balance: ${availableBalance}`);
  
        if (availableBalance < 100) {
          console.error(
            `Insufficient balance for wallet at index ${walletIndex}. Skipping`
          );
          continue;
        }
  
        const transaction = await aptos.transaction.build.simple({
          sender: usableWallet.accountAddress,
          data: {
            function: "0x1::aptos_account::transfer_coins",
            functionArguments: [receiverAddress, amount * 10 ** 6],
            typeArguments: [USDC],
          },
        });
  
        // Simulate transaction
        const simulateResponse = await aptos.transaction.simulate.simple({
          signerPublicKey: usableWallet.publicKey,
          transaction,
        });
  
        if (!simulateResponse[0].success) {
          console.error(simulateResponse);
          console.error(`Simulation failed for wallet at index ${walletIndex}`);
          continue;
        }
  
        // Sign and submit transaction
        const pendingTxResponse =
          await aptos.transaction.signAndSubmitTransaction({
            signer: usableWallet,
            transaction,
          });
  
        // Wait for transaction confirmation
        const committedTxResponse = await aptos.transaction.waitForTransaction({
          transactionHash: pendingTxResponse.hash,
        });
  
        if (!committedTxResponse.success) {
          console.error(`Transaction failed for wallet at index ${walletIndex}`);
          continue;
        }
  
        // Log the successful transaction
        console.log(`✅✅✅: Success for ${walletAddress}: https://explorer.movementnetwork.xyz/txn/${committedTxResponse.version}?network=testnet`);
  
        // Save walletIndex to index.txt
        await saveWalletIndex(walletIndex);
  
        // Save walletAddress and transaction version to CSV
        await saveTransactionToCsv(walletAddress, committedTxResponse.version);
      } catch (error) {
        console.error(
          `Failed to transfer to wallet at index ${walletIndex}:`,
          error
        );
        break; // Break the loop if an error occurs, preserving the current index
      }
    }
  }
  
transferFunds(0.5)
  .then(() => console.log("Transfer complete"))
    .catch((error) => console.error("Failed to transfer funds:", error));