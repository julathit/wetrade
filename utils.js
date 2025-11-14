import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const FILE_PATH = path.resolve("exchangerate.json");
const API_URL = "https://open.er-api.com/v6/latest/USD"; // free public endpoint
const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchExchangeRate() {
  try {
    console.log("Fetching new exchange rates...");
    const response = await fetch(API_URL);
    const data = await response.json();

    if (data.result !== "success") throw new Error("Failed to fetch exchange rate");

    const usdToThb = data.rates.THB;
    const thbToUsd = 1 / usdToThb;

    const exchangeData = {
      base: "USD",
      usd_to_thb: usdToThb,
      thb_to_usd: thbToUsd,
      last_updated: new Date().toISOString()
    };

    fs.writeFileSync(FILE_PATH, JSON.stringify(exchangeData, null, 2));
    console.log("Exchange rates updated:", exchangeData);
  } catch (error) {
    console.error("Error fetching exchange rate:", error.message);
  }
}

function isUpdateNeeded() {
  if (!fs.existsSync(FILE_PATH)) return true;

  try {
    const data = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    const lastUpdate = new Date(data.last_updated).getTime();
    const now = Date.now();
    return now - lastUpdate > DAY_MS; // older than 24 hours
  } catch {
    return true; // corrupted or missing file
  }
}

export async function loadFetchModule() {
  if (isUpdateNeeded()) {
    await fetchExchangeRate();
  } else {
    console.log("Exchange rate data is fresh — no need to update.");
  }

  // Check again every hour
  setInterval(async () => {
    if (isUpdateNeeded()) {
      await fetchExchangeRate();
    } else {
      console.log("Still fresh, skipping update.");
    }
  }, 60 * 60 * 1000);
}

export function getExchangeRate() {
  const data = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
  return {
    usd_to_thb: data.usd_to_thb,
    thb_to_usd: data.thb_to_usd
  };
}