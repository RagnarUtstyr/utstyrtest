import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
    const categoriesRef = collection(db, "categories");
    const categoriesQuery = query(
      categoriesRef,
      where("active", "==", true),
      orderBy("sortOrder")
    );

    const snapshot = await getDocs(categoriesQuery);

    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML = "<p>No categories found.</p>";
      return;
    }

    snapshot.forEach((docSnap) => {
      const category = docSnap.data();
      if (!category.slug || !category.name) return;
      grid.appendChild(buildCategoryCard(category));
    });
  } catch (error) {
    console.error("Error loading categories:", error);
    grid.innerHTML = "<p>Could not load categories.</p>";
  }
}

document.addEventListener("DOMContentLoaded", loadCategories);