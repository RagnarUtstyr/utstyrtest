import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function getPrefix() {
  const currentPath = window.location.pathname;
  const depth = currentPath.split("/").length - 2;
  return depth === 0 ? "" : "../".repeat(depth);
}

async function loadNavbar() {
  const navContainer = document.getElementById("main-navbar");
  if (!navContainer) return;

  const prefix = getPrefix();
  let categoryLinks = "";

  try {
    const categoriesQuery = query(
      collection(db, "categories"),
      orderBy("sortOrder")
    );

    const snapshot = await getDocs(categoriesQuery);

    snapshot.forEach((docSnap) => {
      const category = docSnap.data();

      if (category.active === false) return;
      if (!category.slug || !category.name) return;

      categoryLinks += `
        <li>
          <a href="${prefix}category.html?slug=${encodeURIComponent(category.slug)}">
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
      <li><a href="${prefix}index.html">Home</a></li>
      <li class="dropdown">
        <a href="${prefix}alleq.html" class="dropbtn">Equipment</a>
        <ul class="dropdown-content">
          ${categoryLinks}
          <li><a href="${prefix}alleq.html">All Equipment</a></li>
        </ul>
      </li>
      <li class="dropdown">
        <a href="${prefix}Contact.html" class="dropbtn">Contact</a>
        <ul class="dropdown-content">
          <li><a href="${prefix}About.html">About</a></li>
          <li><a href="${prefix}Contact.html">Contact</a></li>
        </ul>
      </li>
    </ul>
  `;

  navContainer.innerHTML = navHTML;
}

document.addEventListener("DOMContentLoaded", loadNavbar);