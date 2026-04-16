import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const form = document.getElementById("equipment-form");
const equipmentList = document.getElementById("admin-equipment-list");
const saveStatus = document.getElementById("save-status");

let currentEditId = null;

function slugify(value) {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9æøå\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSpecifications(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(":");
      return {
        label: (label || "").trim(),
        value: rest.join(":").trim()
      };
    });
}

function resetForm() {
  currentEditId = null;
  form.reset();
  document.getElementById("form-title").textContent = "Add equipment";
}

async function saveEquipment(event) {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const shortTitle = document.getElementById("shortTitle").value.trim();
  const detailTitle = document.getElementById("detailTitle").value.trim();
  const category = document.getElementById("category").value.trim();
  const inventory = Number(document.getElementById("inventory").value || 0);
  const maxQuantity = Number(document.getElementById("maxQuantity").value || 1);
  const rentalPriceValue = document.getElementById("rentalPrice").value;
  const rentalPrice = rentalPriceValue === "" ? null : Number(rentalPriceValue);
  const priceUnit = document.getElementById("priceUnit").value.trim();
  const alt = document.getElementById("alt").value.trim();
  const imageUrl = document.getElementById("imageUrl").value.trim();
  const active = document.getElementById("active").checked;
  const keywords = parseLines(document.getElementById("keywords").value);
  const description = parseLines(document.getElementById("description").value);
  const specifications = parseSpecifications(document.getElementById("specifications").value);

  const slug = slugify(shortTitle || name);

  try {
    saveStatus.textContent = "Saving…";

    const payload = {
      name,
      shortTitle,
      detailTitle,
      slug,
      category,
      inventory,
      maxQuantity,
      rentalPrice,
      priceUnit,
      alt,
      imageUrl,
      active,
      keywords,
      description,
      specifications,
      updatedAt: serverTimestamp()
    };

    if (currentEditId) {
      await updateDoc(doc(db, "equipment", currentEditId), payload);
    } else {
      await addDoc(collection(db, "equipment"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    saveStatus.textContent = "Saved.";
    resetForm();
    await loadEquipmentList();
  } catch (error) {
    console.error("Save failed:", error);
    saveStatus.textContent = "Save failed.";
  }
}

function fillForm(id, item) {
  currentEditId = id;
  document.getElementById("form-title").textContent = "Edit equipment";

  document.getElementById("name").value = item.name || "";
  document.getElementById("shortTitle").value = item.shortTitle || "";
  document.getElementById("detailTitle").value = item.detailTitle || "";
  document.getElementById("category").value = item.category || "";
  document.getElementById("inventory").value = item.inventory ?? 0;
  document.getElementById("maxQuantity").value = item.maxQuantity ?? 1;
  document.getElementById("rentalPrice").value = item.rentalPrice ?? "";
  document.getElementById("priceUnit").value = item.priceUnit || "";
  document.getElementById("alt").value = item.alt || "";
  document.getElementById("imageUrl").value = item.imageUrl || "";
  document.getElementById("active").checked = !!item.active;
  document.getElementById("keywords").value = (item.keywords || []).join("\n");
  document.getElementById("description").value = (item.description || []).join("\n");
  document.getElementById("specifications").value = (item.specifications || [])
    .map((spec) => `${spec.label}: ${spec.value}`)
    .join("\n");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function removeEquipment(id) {
  const ok = window.confirm("Delete this equipment item?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "equipment", id));
    await loadEquipmentList();
  } catch (error) {
    console.error("Delete failed:", error);
  }
}

function formatPrice(item) {
  if (
    item.rentalPrice === undefined ||
    item.rentalPrice === null ||
    item.rentalPrice === ""
  ) {
    return "No price";
  }

  return `${item.rentalPrice} NOK${item.priceUnit ? ` / ${item.priceUnit}` : ""}`;
}

async function loadEquipmentList() {
  if (!equipmentList) return;

  equipmentList.innerHTML = "<p>Loading equipment…</p>";

  try {
    const equipmentQuery = query(collection(db, "equipment"), orderBy("name"));
    const snapshot = await getDocs(equipmentQuery);

    if (snapshot.empty) {
      equipmentList.innerHTML = "<p>No equipment yet.</p>";
      return;
    }

    equipmentList.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const item = docSnap.data();
      const row = document.createElement("div");
      row.className = "nav-card";
      row.style.marginBottom = "20px";

      row.innerHTML = `
        <img src="${item.imageUrl || "../images/placeholder.png"}" alt="${item.alt || item.name || ""}" />
        <h2>${item.shortTitle || item.name || "Untitled item"}</h2>
        <p>${item.category || ""}</p>
        <p>Inventory: ${Number(item.inventory || 0)}</p>
        <p>${formatPrice(item)}</p>
        <p>${item.active ? "Active" : "Inactive"}</p>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <button class="rtn-add-to-basket edit-button">Edit</button>
          <button class="rtn-empty-button delete-button">Delete</button>
        </div>
      `;

      row.querySelector(".edit-button").addEventListener("click", () => {
        fillForm(docSnap.id, item);
      });

      row.querySelector(".delete-button").addEventListener("click", () => {
        removeEquipment(docSnap.id);
      });

      equipmentList.appendChild(row);
    });
  } catch (error) {
    console.error("Failed loading admin list:", error);
    equipmentList.innerHTML = "<p>Could not load equipment list.</p>";
  }
}

onAuthStateChanged(auth, (user) => {
  if (!window.location.pathname.includes("/admin/dashboard.html")) return;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  loadEquipmentList();
});

if (form) {
  form.addEventListener("submit", saveEquipment);
}

const cancelEditButton = document.getElementById("cancel-edit-button");
if (cancelEditButton) {
  cancelEditButton.addEventListener("click", resetForm);
}