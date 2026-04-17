import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let searchItems = [];
let allEquipmentCards = [];

function normalizeText(value) {
  return (value || "").toString().toLowerCase().trim();
}

async function loadSearchItems() {
  try {
    const snapshot = await getDocs(query(collection(db, "equipment")));

    searchItems = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      .filter((item) => item.active !== false)
      .map((item) => ({
        id: item.id,
        name: item.name || "Untitled item",
        keywords: [
          item.name,
          item.categorySlug,
          ...(item.keywords || [])
        ]
          .join(" ")
          .toLowerCase(),
        url: `equipment-item.html?id=${encodeURIComponent(item.id)}`
      }));
  } catch (error) {
    console.error("Search load failed:", error);
    searchItems = [];
  }
}

function showDropdownResults() {
  const globalSearchField = document.getElementById("global-search-field");
  const dropdown = document.getElementById("dropdown-results");
  if (!globalSearchField || !dropdown) return;

  const searchValue = normalizeText(globalSearchField.value);
  dropdown.innerHTML = "";

  if (!searchValue) {
    dropdown.style.display = "none";
    return;
  }

  const searchWords = searchValue.split(/\s+/).filter(Boolean);

  const matchedItems = searchItems.filter((item) => {
    const haystack = `${item.name} ${item.keywords}`.toLowerCase();
    return searchWords.every((word) => haystack.includes(word));
  });

  if (!matchedItems.length) {
    dropdown.style.display = "none";
    return;
  }

  matchedItems.slice(0, 12).forEach((item) => {
    const resultItem = document.createElement("div");
    resultItem.className = "dropdown-item";
    resultItem.textContent = item.name;
    resultItem.addEventListener("click", () => {
      window.location.href = item.url;
    });
    dropdown.appendChild(resultItem);
  });

  dropdown.style.display = "block";
}

function filterItems() {
  const searchField = document.getElementById("search-field");
  if (!searchField) return;

  const searchValue = normalizeText(searchField.value);
  const searchWords = searchValue.split(/\s+/).filter(Boolean);

  if (!allEquipmentCards.length) {
    allEquipmentCards = Array.from(document.querySelectorAll("#equipment-grid .nav-card"));
  }

  allEquipmentCards.forEach((card) => {
    const text = normalizeText(card.innerText);
    const keywords = normalizeText(card.dataset.keywords || "");
    const haystack = `${text} ${keywords}`;

    const matches =
      !searchValue || searchWords.every((word) => haystack.includes(word));

    card.style.display = matches ? "" : "none";
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  await loadSearchItems();

  const globalSearchField = document.getElementById("global-search-field");
  const searchField = document.getElementById("search-field");
  const dropdown = document.getElementById("dropdown-results");

  if (globalSearchField) {
    globalSearchField.addEventListener("keyup", showDropdownResults);
    globalSearchField.addEventListener("focus", showDropdownResults);
  }

  if (searchField) {
    searchField.addEventListener("keyup", filterItems);
  }

  document.addEventListener("click", function (event) {
    if (
      dropdown &&
      globalSearchField &&
      !dropdown.contains(event.target) &&
      !globalSearchField.contains(event.target)
    ) {
      dropdown.style.display = "none";
    }
  });

  if (typeof updateBasketIcon === "function") {
    updateBasketIcon();
  }
});