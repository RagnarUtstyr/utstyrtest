import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const aOrder = Number(a.sortOrder ?? 999999);
    const bOrder = Number(b.sortOrder ?? 999999);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function buildCategoryCard(category) {
  const card = document.createElement("div");
  card.className = "eq-nav-card";
  card.addEventListener("click", () => {
    window.location.href = `category.html?slug=${encodeURIComponent(category.slug)}`;
  });

  card.innerHTML = `<span>${category.name}</span>`;
  return card;
}

async function loadCategories() {
  const grid = document.getElementById("category-grid");
  if (!grid) return;

  grid.innerHTML = "<p>Loading categories…</p>";

  try {
    const snapshot = await getDocs(query(collection(db, "categories")));
    const categories = sortCategories(
      snapshot.docs
        .map((docSnap) => docSnap.data())
        .filter((category) => category.active !== false)
        .filter((category) => category.slug && category.name)
    );

    grid.innerHTML = "";

    if (!categories.length) {
      grid.innerHTML = "<p>No categories found.</p>";
      return;
    }

    categories.forEach((category) => {
      grid.appendChild(buildCategoryCard(category));
    });
  } catch (error) {
    console.error("Error loading categories:", error);
    grid.innerHTML = "<p>Could not load categories.</p>";
  }
}

document.addEventListener("DOMContentLoaded", loadCategories);