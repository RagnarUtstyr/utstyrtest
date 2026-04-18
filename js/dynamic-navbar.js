import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const SITE_BASE_PATH = "/utstyrtest/";

function withBase(path) {
  const cleanBase = SITE_BASE_PATH.endsWith("/") ? SITE_BASE_PATH : `${SITE_BASE_PATH}/`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${cleanBase}${cleanPath}`;
}

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const aOrder = Number(a.sortOrder ?? 999999);
    const bOrder = Number(b.sortOrder ?? 999999);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || "").localeCompare(b.name || "");
  });
}

async function loadNavbar() {
  const navContainer = document.getElementById("main-navbar");
  if (!navContainer) return;

  let categoryLinks = "";

  try {
    const snapshot = await getDocs(query(collection(db, "categories")));
    const categories = sortCategories(
      snapshot.docs
        .map((docSnap) => docSnap.data())
        .filter((category) => category.active !== false)
    );

    categories.forEach((category) => {
      if (!category.slug || !category.name) return;

      categoryLinks += `
        <li>
          <a href="${withBase(`category.html?slug=${encodeURIComponent(category.slug)}`)}">
            ${category.name}
          </a>
        </li>
      `;
    });
  } catch (error) {
    console.error("Navbar category load failed:", error);
  }

  const navHTML = `
    <ul class="navbar">
      <li><a href="${withBase("index.html")}">Home</a></li>

      <li class="dropdown">
        <a href="${withBase("alleq.html")}" class="dropbtn">Equipment</a>
        <ul class="dropdown-content">
          ${categoryLinks}
          <li><a href="${withBase("alleq.html")}">All Equipment</a></li>
        </ul>
      </li>

      <li><a href="${withBase("about.html")}">About</a></li>

      <li class="dropdown">
        <a href="${withBase("contact.html")}" class="dropbtn">Contact</a>
        <ul class="dropdown-content">
          <li><a href="${withBase("contact.html")}">Contact</a></li>
        </ul>
      </li>
    </ul>
  `;

  navContainer.innerHTML = navHTML;
}

document.addEventListener("DOMContentLoaded", loadNavbar);