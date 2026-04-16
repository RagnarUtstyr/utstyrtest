import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let allEquipment = [];

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

function buildCard(docId, item) {
  const card = document.createElement("div");
  card.className = "nav-card";
  card.dataset.keywords = (item.keywords || []).join(" ").toLowerCase();

  const imageUrl = item.imageUrl || "/images/placeholder.png";
  const title = item.name || "Untitled item";
  const priceText = formatPrice(item);

  card.innerHTML = `
    <a href="equipment-item.html?id=${encodeURIComponent(docId)}">
      <img src="${imageUrl}" alt="${title}" loading="lazy" />
      <h2>${title}</h2>
    </a>
    ${priceText ? `<p><strong>${priceText}</strong></p>` : ""}
  `;

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
    const equipmentRef = collection(db, "equipment");
    const equipmentQuery = query(
      equipmentRef,
      where("active", "==", true),
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
    console.error("Error loading equipment:", error);
    grid.innerHTML = "<p>Could not load equipment.</p>";
  }
}

document.addEventListener("DOMContentLoaded", loadEquipment);