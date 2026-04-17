import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const PLACEHOLDER_IMAGE = "/images/placeholder.png";

let allEquipment = [];
let allCategories = [];

function normalizeText(value) {
  return (value || "").toString().toLowerCase().trim();
}

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const aOrder = Number(a.sortOrder ?? 999999);
    const bOrder = Number(b.sortOrder ?? 999999);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || "").localeCompare(b.name || "");
  });
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
  const priceText = formatPrice(item);
  const maxQuantity = Math.max(Number(item.inventory || 1), 1);

  card.innerHTML = `
    <a href="equipment-item.html?id=${encodeURIComponent(docId)}">
      <img src="${imageUrl}" alt="${title}" loading="lazy" />
      <h2>${title}</h2>
    </a>
    ${priceText ? `<p><strong>${priceText}</strong></p>` : ""}
    <button class="rtn-add-to-basket">Add to Basket</button>
  `;

  const addButton = card.querySelector(".rtn-add-to-basket");
  addButton.addEventListener("click", () => {
    if (typeof addToBasket === "function") {
      addToBasket(title, maxQuantity);
    }
  });

  return card;
}

function renderEquipment(items) {
  const grid = document.getElementById("equipment-grid");
  if (!grid) return;

  grid.innerHTML = "";

  if (!items.length) {
    grid.innerHTML = "<p>No equipment found.</p>";
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

async function loadEquipment() {
  const grid = document.getElementById("equipment-grid");
  if (!grid) return;

  grid.innerHTML = "<p>Loading equipment…</p>";

  try {
    const [equipmentSnapshot, categorySnapshot] = await Promise.all([
      getDocs(query(collection(db, "equipment"))),
      getDocs(query(collection(db, "categories")))
    ]);

    allCategories = sortCategories(
      categorySnapshot.docs
        .map((docSnap) => docSnap.data())
        .filter((category) => category.active !== false)
    );

    const categoryOrderMap = new Map(
      allCategories.map((category, index) => [category.slug, index])
    );

    allEquipment = equipmentSnapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data()
      }))
      .filter(({ data }) => data.active !== false)
      .sort((a, b) => {
        const aIndex = categoryOrderMap.has(a.data.categorySlug)
          ? categoryOrderMap.get(a.data.categorySlug)
          : 999999;
        const bIndex = categoryOrderMap.has(b.data.categorySlug)
          ? categoryOrderMap.get(b.data.categorySlug)
          : 999999;

        if (aIndex !== bIndex) return aIndex - bIndex;
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
    console.error("Error loading equipment:", error);
    grid.innerHTML = "<p>Could not load equipment.</p>";
  }
}

document.addEventListener("DOMContentLoaded", loadEquipment);