import { db } from "./firebase-config.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const PLACEHOLDER_IMAGE = "/utstyrtest/images/placeholder.png";

function getItemId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function formatPrice(item) {
  if (
    item.rentalPrice === undefined ||
    item.rentalPrice === null ||
    item.rentalPrice === ""
  ) {
    return "<p>Price on request</p>";
  }

  return `<p><strong>${item.rentalPrice} NOK</strong></p>`;
}

function renderSpecifications(specifications = []) {
  if (!specifications.length) {
    return "<p>No specifications listed.</p>";
  }

  return `
    <ul>
      ${specifications
        .map(
          (spec) =>
            `<li><strong>${spec.label || ""}:</strong> ${spec.value || ""}</li>`
        )
        .join("")}
    </ul>
  `;
}

function renderDescription(description = []) {
  if (!description.length) {
    return "<p>No description available.</p>";
  }

  return description.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

async function loadEquipmentItem() {
  const container = document.getElementById("equipment-page");
  if (!container) return;

  const itemId = getItemId();

  if (!itemId) {
    container.innerHTML = "<p>Equipment not found.</p>";
    return;
  }

  container.innerHTML = "<p>Loading item…</p>";

  try {
    const itemRef = doc(db, "equipment", itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      container.innerHTML = "<p>Equipment not found.</p>";
      return;
    }

    const item = itemSnap.data();
    const imageUrl = item.imageUrl || PLACEHOLDER_IMAGE;
    const title = item.name || "Untitled item";
    const maxQuantity = Math.max(Number(item.inventory || 1), 1);

    container.innerHTML = `
      <div>
        <button class="rtn-add-to-basket" id="detail-add-button">Add to Basket</button>
      </div>

      <main>
        <h1>${title}</h1>

        <div class="equipment-detail">
          <br><br>

          <img src="${imageUrl}" alt="${title}" />

          <h2>Inventory</h2>
          <p>${Number(item.inventory || 0)} Available</p>

          <br>

          <h2>Rental Price</h2>
          ${formatPrice(item)}

          <br><br>

          ${renderDescription(item.description)}

          <br><br>

          <h2>Specifications</h2>
          ${renderSpecifications(item.specifications)}
        </div>
      </main>
    `;

    const addButton = document.getElementById("detail-add-button");
    if (addButton) {
      addButton.addEventListener("click", () => {
        if (typeof addToBasket === "function") {
          addToBasket(title, maxQuantity);
        }
      });
    }
  } catch (error) {
    console.error("Error loading equipment item:", error);
    container.innerHTML = "<p>Could not load equipment item.</p>";
  }
}

document.addEventListener("DOMContentLoaded", loadEquipmentItem);