import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

  const unit = item.priceUnit ? ` / ${item.priceUnit}` : "";
  return `${item.rentalPrice} NOK${unit}`;
}

function buildCard(docId, item) {
  const card = document.createElement("div");
  card.className = "nav-card";
  card.dataset.keywords = (item.keywords || []).join(" ").toLowerCase();

  const imageUrl = item.imageUrl || "images/placeholder.png";
  const title = item.shortTitle || item.name || "Untitled item";
  const basketName = item.name || title;
  const maxQuantity = Number(item.maxQuantity || item.inventory || 1);
  const priceText = formatPrice(item);

  card.innerHTML = `
    <a href="equipment-item.html?id=${encodeURIComponent(docId)}">
      <img src="${imageUrl}" alt="${item.alt || title}" loading="lazy" />
      <h2>${title}</h2>
    </a>
    ${priceText ? `<p><strong>${priceText}</strong></p>` : ""}
    <button class="rtn-add-to-basket">Add to Basket</button>
  `;

  const button = card.querySelector(".rtn-add-to-basket");
  button.addEventListener("click", () => {
    if (typeof addToBasket === "function") {
      addToBasket(basketName, maxQuantity);
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
      data.shortTitle,
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
      where("active", "==", true),
      where("categorySlug", "==", currentCategorySlug),
      orderBy("name")
    );

    const snapshot = await getDocs(equipmentQuery);

    allEquipment = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data()
    }));

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