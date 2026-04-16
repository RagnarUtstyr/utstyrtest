import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/*
  Set this to the public base path of your site.

  Use "/" if pages are served like:
  https://ragnarutstyr.github.io/index.html

  Use "/utstyrtest/" if pages are served like:
  https://ragnarutstyr.github.io/utstyrtest/index.html
*/
const SITE_BASE_PATH = "/";

function withBase(path) {
  const cleanBase = SITE_BASE_PATH.endsWith("/") ? SITE_BASE_PATH : `${SITE_BASE_PATH}/`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${cleanBase}${cleanPath}`;
}

async function loadNavbar() {
  const navContainer = document.getElementById("main-navbar");
  if (!navContainer) return;

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
      <li class="dropdown">
        <a href="${withBase("Contact.html")}" class="dropbtn">Contact</a>
        <ul class="dropdown-content">
          <li><a href="${withBase("Contact.html")}">Contact</a></li>
        </ul>
      </li>
    </ul>
  `;

  navContainer.innerHTML = navHTML;
}

document.addEventListener("DOMContentLoaded", loadNavbar);