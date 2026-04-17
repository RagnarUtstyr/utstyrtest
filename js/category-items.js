import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const PLACEHOLDER_IMAGE = "/utstyrtest/images/placeholder.png";

let allEquipment = [];
let currentCategorySlug = "";

function getCategorySlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug") || "";
}

function normalizeText(value) {
  return (value || "").toString().toLowerCase().trim();
}

function formatPrice(item) {
  if (
    item.rentalPrice === undefined ||
    item.rentalPrice === null ||
    item.rentalPrice === ""
  ) {
    return "";
  }

  return `${item.rentalPrice} NOK`;
}

function formatInventory(item) {
  const inventory = Number(item.inventory || 0);

  if (inventory >= 1) {
    return `${inventory} available`;
  }

  return "";
}

function buildOverlayHtml(item) {
  const inventoryText = formatInventory(item);

  if (!inventoryText) {
    return "";
  }

  return `
    <div class="nav-card-overlay nav-card-overlay-right">
      <span class="nav-card-badge nav-card-stock">${inventoryText}</span>
    </div>
  `;
}

function buildPriceHtml(item) {
  const priceText = formatPrice(item);

  if (!priceText) {
    return "";
  }

  return `<p class="nav-card-bottom-price">${priceText}</p>`;
}

function buildCard(docId, item) {
  const card = document.createElement("div");
  card.className = "nav-card";
  card.dataset.keywords = [
    item.name,
    item.categorySlug,
    ...(item.keywords || [])
  ].join(" ").toLowerCase();

  const imageUrl = item.imageUrl || PLACEHOLDER_IMAGE;
  const title = item.name || "Untitled item";
  const maxQuantity = Math.max(Number(item.inventory || 1), 1);

  card.innerHTML = `
    <a href="equipment-item.html?id=${encodeURIComponent(docId)}">
      <div class="nav-card-image-wrap">
        <img src="${imageUrl}" alt="${title}" loading="lazy" />
        ${buildOverlayHtml(item)}
      </div>
      <h2>${title}</h2>
    </a>
    <button class="rtn-add-to-basket">Add to Basket</button>
    ${buildPriceHtml(item)}
  `;

  const addButton = card.querySelector(".rtn-add-to-basket");
  addButton.addEventListener("click", () => {
    if (typeof addToBasket === "function") {
      addToBasket(title, maxQuantity, item.rentalPrice);
    }
  });

  return card;
}

function renderEquipment(items) {
  const grid = document.getElementById("equipment-grid");
  if (!grid) return;

  grid.innerHTML = "";

  if (!items.length) {
    grid.innerHTML = "<p>No equipment found in this category.</p>";
    return;
  }

  items.forEach(({ id, data }) => {
    grid.appendChild(buildCard(id, data));
  });
}

function filterEquipment(searchTerm) {
  const term = normalizeText(searchTerm);

  if (!term) {
    renderEquipment(allEquipment);
    return;
  }

  const filtered = allEquipment.filter(({ data }) => {
    const haystack = [
      data.name,
      data.categorySlug,
      ...(data.keywords || [])
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });

  renderEquipment(filtered);
}

function setCategoryTitle() {
  const title = document.getElementById("category-title");
  if (!title) return;

  if (!currentCategorySlug) {
    title.textContent = "Category";
    return;
  }

  const pretty = currentCategorySlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  title.textContent = pretty;
}

async function loadCategoryItems() {
  const grid = document.getElementById("equipment-grid");
  if (!grid) return;

  currentCategorySlug = getCategorySlug();
  setCategoryTitle();

  if (!currentCategorySlug) {
    grid.innerHTML = "<p>No category selected.</p>";
    return;
  }

  grid.innerHTML = "<p>Loading equipment…</p>";

  try {
    const equipmentRef = collection(db, "equipment");
    const equipmentQuery = query(
      equipmentRef,
      where("categorySlug", "==", currentCategorySlug)
    );

    const snapshot = await getDocs(equipmentQuery);

    allEquipment = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data()
      }))
      .filter(({ data }) => data.active !== false)
        .sort((a, b) => {
        const aSort = Number(a.data.sortOrder ?? 999999);
        const bSort = Number(b.data.sortOrder ?? 999999);
        if (aSort !== bSort) return aSort - bSort;
        return (a.data.name || "").localeCompare(b.data.name || "");
      });

    renderEquipment(allEquipment);

    const searchField = document.getElementById("search-field");
    if (searchField) {
      searchField.addEventListener("input", (event) => {
        filterEquipment(event.target.value);
      });
    }
  } catch (error) {
    console.error("Error loading category equipment:", error);
    grid.innerHTML = "<p>Could not load equipment.</p>";
  }
}

document.addEventListener("DOMContentLoaded", loadCategoryItems);