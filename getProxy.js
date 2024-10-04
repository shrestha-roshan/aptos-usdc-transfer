import { HttpsProxyAgent } from "https-proxy-agent";
import dotenv from "dotenv";
import fetch from "node-fetch";
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
