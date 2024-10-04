import fetch from "node-fetch";
import invariant from "tiny-invariant";

export const callTx = async (options, aptos) => {
    const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: JSON.stringify(options.data),
        agent: options.httpProxyAgent,
      }).then((res) => res.json());
      if(!response.hash) {
        throw new Error("Transaction failed: ", response);
      }
      // Wait for transaction confirmation
      const committedTxResponse = await aptos.transaction.waitForTransaction({
        transactionHash: response.hash,
      });
      invariant(committedTxResponse.success, "transaction failed");

      // Log the swap in the explorer
      console.log(`Transaction completed: ✅✅✅ https://explorer.movementnetwork.xyz/txn/${response.hash}?network=testnet`);
      return response.hash;
}