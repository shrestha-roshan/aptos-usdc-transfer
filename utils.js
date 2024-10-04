import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import invariant from "tiny-invariant";
import * as dotenv from "dotenv";
dotenv.config();
const ABC_PROXY = process.env.ABC_PROXY;

function splitProxy(proxy) {
  return proxy.split(":");
}

function getRandomSession() {
  const chars = "1234567890abcdefgopqxyz";
  let session = "";
  for (let i = 0; i < 8; i++) {
    session += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return session;
}

function getRequestsProxies(proxy) {
  const [a, b, c, d] = splitProxy(proxy);
  const sessid = getRandomSession();

  const proxyUrl = `http://${c}-zone-bwc-session-${sessid}-sessTime-120:${d}@${a}:${b}`;

  return proxyUrl;
}

export const getHTTPProxyAgent = async () => {
  const proxyUrl = getRequestsProxies(ABC_PROXY);
  const agent = new HttpsProxyAgent(proxyUrl);
  const ipData = await fetch(
    "https://api.ipify.org?format=json",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      agent,
    }
  ).then((res) => {
    if (res.ok) {
      return res.json();
    }
  });
  console.log("IP:: ", ipData?.ip, "PROXY:: ", proxyUrl);
  return agent;
};


export const callTx = async (options, aptos) => {
    const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: JSON.stringify(options.data),
        agent: options.httpProxyAgent,
      }).then((res) => res.json());
      console.log(response)
      if(!response.hash) {
        throw new Error(`Transaction failed: ${response}`);
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
