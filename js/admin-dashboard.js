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

const saveStatus = document.getElementById("save-status");

/* ---------------------------
   CATEGORY FORM
---------------------------- */
const categoryForm = document.getElementById("category-form");
const categoryList = document.getElementById("admin-category-list");
let currentCategoryEditId = null;

function slugify(value) {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9æøå\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function resetCategoryForm() {
  currentCategoryEditId = null;
  categoryForm.reset();
  document.getElementById("category-form-title").textContent = "Add category";
  document.getElementById("categorySortOrder").value = 0;
  document.getElementById("categoryActive").checked = true;
}

async function saveCategory(event) {
  event.preventDefault();

  const name = document.getElementById("categoryName").value.trim();
  const slugInput = document.getElementById("categorySlug").value.trim();
  const slug = slugify(slugInput || name);
  const sortOrder = Number(document.getElementById("categorySortOrder").value || 0);
  const active = document.getElementById("categoryActive").checked;

  try {
    saveStatus.textContent = "Saving category…";

    const payload = {
      name,
      slug,
      sortOrder,
      active,
      updatedAt: serverTimestamp()
    };

    if (currentCategoryEditId) {
      await updateDoc(doc(db, "categories", currentCategoryEditId), payload);
    } else {
      await addDoc(collection(db, "categories"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    saveStatus.textContent = "Category saved.";
    resetCategoryForm();
    await loadCategories();
  } catch (error) {
    console.error("Save category failed:", error);
    saveStatus.textContent = "Category save failed.";
  }
}

function fillCategoryForm(id, category) {
  currentCategoryEditId = id;
  document.getElementById("category-form-title").textContent = "Edit category";

  document.getElementById("categoryName").value = category.name || "";
  document.getElementById("categorySlug").value = category.slug || "";
  document.getElementById("categorySortOrder").value = category.sortOrder ?? 0;
  document.getElementById("categoryActive").checked = !!category.active;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function removeCategory(id) {
  const ok = window.confirm("Delete this category?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "categories", id));
    await loadCategories();
  } catch (error) {
    console.error("Delete category failed:", error);
  }
}

async function loadCategories() {
  if (!categoryList) return;

  categoryList.innerHTML = "<p>Loading categories…</p>";

  try {
    const categoriesQuery = query(collection(db, "categories"), orderBy("sortOrder"));
    const snapshot = await getDocs(categoriesQuery);

    if (snapshot.empty) {
      categoryList.innerHTML = "<p>No categories yet.</p>";
      return;
    }

    categoryList.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const category = docSnap.data();
      const row = document.createElement("div");
      row.className = "nav-card";

      row.innerHTML = `
        <h2>${category.name || "Untitled category"}</h2>
        <p>Slug: ${category.slug || ""}</p>
        <p>Sort order: ${category.sortOrder ?? 0}</p>
        <p>${category.active ? "Active" : "Inactive"}</p>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <button class="rtn-add-to-basket edit-category-button">Edit</button>
          <button class="rtn-empty-button delete-category-button">Delete</button>
        </div>
      `;

      row.querySelector(".edit-category-button").addEventListener("click", () => {
        fillCategoryForm(docSnap.id, category);
      });

      row.querySelector(".delete-category-button").addEventListener("click", () => {
        removeCategory(docSnap.id);
      });

      categoryList.appendChild(row);
    });
  } catch (error) {
    console.error("Load categories failed:", error);
    categoryList.innerHTML = "<p>Could not load categories.</p>";
  }
}

/* ---------------------------
   EQUIPMENT FORM
---------------------------- */
const equipmentForm = document.getElementById("equipment-form");
const equipmentList = document.getElementById("admin-equipment-list");
let currentEquipmentEditId = null;

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

function resetEquipmentForm() {
  currentEquipmentEditId = null;
  equipmentForm.reset();
  document.getElementById("form-title").textContent = "Add equipment";
  document.getElementById("inventory").value = 1;
  document.getElementById("maxQuantity").value = 1;
  document.getElementById("active").checked = true;
}

async function saveEquipment(event) {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const shortTitle = document.getElementById("shortTitle").value.trim();
  const detailTitle = document.getElementById("detailTitle").value.trim();
  const categorySlug = slugify(document.getElementById("categorySlug").value.trim());
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
    saveStatus.textContent = "Saving equipment…";

    const payload = {
      name,
      shortTitle,
      detailTitle,
      slug,
      categorySlug,
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

    if (currentEquipmentEditId) {
      await updateDoc(doc(db, "equipment", currentEquipmentEditId), payload);
    } else {
      await addDoc(collection(db, "equipment"), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    saveStatus.textContent = "Equipment saved.";
    resetEquipmentForm();
    await loadEquipmentList();
  } catch (error) {
    console.error("Save equipment failed:", error);
    saveStatus.textContent = "Equipment save failed.";
  }
}

function fillEquipmentForm(id, item) {
  currentEquipmentEditId = id;
  document.getElementById("form-title").textContent = "Edit equipment";

  document.getElementById("name").value = item.name || "";
  document.getElementById("shortTitle").value = item.shortTitle || "";
  document.getElementById("detailTitle").value = item.detailTitle || "";
  document.getElementById("categorySlug").value = item.categorySlug || "";
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
    console.error("Delete equipment failed:", error);
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
        <p>Category: ${item.categorySlug || ""}</p>
        <p>Inventory: ${Number(item.inventory || 0)}</p>
        <p>${formatPrice(item)}</p>
        <p>${item.active ? "Active" : "Inactive"}</p>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <button class="rtn-add-to-basket edit-equipment-button">Edit</button>
          <button class="rtn-empty-button delete-equipment-button">Delete</button>
        </div>
      `;

      row.querySelector(".edit-equipment-button").addEventListener("click", () => {
        fillEquipmentForm(docSnap.id, item);
      });

      row.querySelector(".delete-equipment-button").addEventListener("click", () => {
        removeEquipment(docSnap.id);
      });

      equipmentList.appendChild(row);
    });
  } catch (error) {
    console.error("Load equipment failed:", error);
    equipmentList.innerHTML = "<p>Could not load equipment list.</p>";
  }
}

/* ---------------------------
   INIT
---------------------------- */
onAuthStateChanged(auth, (user) => {
  if (!window.location.pathname.includes("/admin/dashboard.html")) return;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  loadCategories();
  loadEquipmentList();
});

if (categoryForm) {
  categoryForm.addEventListener("submit", saveCategory);
}

const cancelCategoryEditButton = document.getElementById("cancel-category-edit-button");
if (cancelCategoryEditButton) {
  cancelCategoryEditButton.addEventListener("click", resetCategoryForm);
}

if (equipmentForm) {
  equipmentForm.addEventListener("submit", saveEquipment);
}

const cancelEquipmentEditButton = document.getElementById("cancel-edit-button");
if (cancelEquipmentEditButton) {
  cancelEquipmentEditButton.addEventListener("click", resetEquipmentForm);
}