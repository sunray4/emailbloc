import { db } from "./firebase.js";
import { doc, setDoc, getDoc } from "firebase/firestore";

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.active &&
    tab.url &&
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://")
  ) {
    const key = "securityResultsArray";
    const fetchingKey = key + "_fetching";
    chrome.storage.local.set({ [fetchingKey]: true });

    try {
      const res = await fetch(
        "http://localhost:8100/check?fetch_url=" + encodeURIComponent(tab.url)
      );
      const data = await res.json();

      chrome.storage.local.get([key], async (storageData) => {
        let resultsArray = Array.isArray(storageData[key])
          ? storageData[key]
          : [];
        resultsArray.push({
          url: tab.url,
          fetchedAt: new Date().toISOString(),
          result: data,
        });

        chrome.storage.local.set({ [key]: resultsArray, [fetchingKey]: false });

        chrome.storage.local.get(
          ["multiDeviceSync", "username"],
          async (syncData) => {
            if (syncData.multiDeviceSync && syncData.username) {
              const userRef = doc(db, "users", syncData.username);
              const userSnap = await getDoc(userRef);
              let firestoreArray = [];
              if (
                userSnap.exists() &&
                Array.isArray(userSnap.data().securityResultsArray)
              ) {
                firestoreArray = userSnap.data().securityResultsArray;
              }
              firestoreArray.push({
                url: tab.url,
                fetchedAt: new Date().toISOString(),
                result: data,
              });
              await setDoc(
                userRef,
                { securityResultsArray: firestoreArray },
                { merge: true }
              );
            }
          }
        );
      });
    } catch (e) {
      chrome.storage.local.set({ [key]: [], [fetchingKey]: false });
    }
  }
});