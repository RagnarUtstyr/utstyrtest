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
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const saveStatus = document.getElementById("save-status");
const equipmentForm = document.getElementById("equipment-form");
const equipmentList = document.getElementById("admin-equipment-list");
const categorySelect = document.getElementById("categorySelect");
const newCategoryNameField = document.getElementById("newCategoryNameField");
const newCategorySlugField = document.getElementById("newCategorySlugField");
const newCategoryNameInput = document.getElementById("newCategoryName");
const newCategorySlugInput = document.getElementById("newCategorySlug");

let currentEquipmentEditId = null;
let categoriesCache = [];

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

function toggleNewCategoryFields() {
  const isNew = categorySelect.value === "__new__";
  newCategoryNameField.classList.toggle("hidden", !isNew);
  newCategorySlugField.classList.toggle("hidden", !isNew);

  newCategoryNameInput.required = isNew;
  newCategorySlugInput.required = isNew;
}

async function loadCategoriesIntoSelect(selectedSlug = "") {
  if (!categorySelect) return;

  try {
    const categoriesQuery = query(collection(db, "categories"), orderBy("sortOrder"));
    const snapshot = await getDocs(categoriesQuery);

    categoriesCache = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    categorySelect.innerHTML = `
      <option value="">Select category</option>
      ${categoriesCache
        .filter((category) => category.active !== false)
        .map(
          (category) =>
            `<option value="${category.slug}">${category.name}</option>`
        )
        .join("")}
      <option value="__new__">Create new category</option>
    `;

    if (selectedSlug) {
      const exists = categoriesCache.some((category) => category.slug === selectedSlug);
      if (exists) {
        categorySelect.value = selectedSlug;
      }
    }

    toggleNewCategoryFields();
  } catch (error) {
    console.error("Failed loading categories:", error);
  }
}

async function ensureCategoryExists() {
  const selectedValue = categorySelect.value;

  if (!selectedValue) {
    throw new Error("Please select a category.");
  }

  if (selectedValue !== "__new__") {
    return selectedValue;
  }

  const newCategoryName = newCategoryNameInput.value.trim();
  const newCategorySlug = slugify(newCategorySlugInput.value.trim());

  if (!newCategoryName || !newCategorySlug) {
    throw new Error("New category name and slug are required.");
  }

  const existingQuery = query(
    collection(db, "categories"),
    where("slug", "==", newCategorySlug)
  );
  const existingSnapshot = await getDocs(existingQuery);

  if (!existingSnapshot.empty) {
    return newCategorySlug;
  }

  const nextSortOrder =
    categoriesCache.length > 0
      ? Math.max(...categoriesCache.map((category) => Number(category.sortOrder || 0))) + 1
      : 0;

  await addDoc(collection(db, "categories"), {
    name: newCategoryName,
    slug: newCategorySlug,
    sortOrder: nextSortOrder,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await loadCategoriesIntoSelect(newCategorySlug);
  return newCategorySlug;
}

function resetEquipmentForm() {
  currentEquipmentEditId = null;
  equipmentForm.reset();
  document.getElementById("form-title").textContent = "Add equipment";
  document.getElementById("inventory").value = 1;
  document.getElementById("maxQuantity").value = 1;
  document.getElementById("active").checked = true;
  categorySelect.value = "";
  newCategoryNameInput.value = "";
  newCategorySlugInput.value = "";
  toggleNewCategoryFields();
}

async function saveEquipment(event) {
  event.preventDefault();

  try {
    saveStatus.textContent = "Saving equipment…";

    const categorySlug = await ensureCategoryExists();

    const name = document.getElementById("name").value.trim();
    const shortTitle = document.getElementById("shortTitle").value.trim();
    const detailTitle = document.getElementById("detailTitle").value.trim();
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
    saveStatus.textContent = error.message || "Equipment save failed.";
  }
}

function fillEquipmentForm(id, item) {
  currentEquipmentEditId = id;
  document.getElementById("form-title").textContent = "Edit equipment";

  document.getElementById("name").value = item.name || "";
  document.getElementById("shortTitle").value = item.shortTitle || "";
  document.getElementById("detailTitle").value = item.detailTitle || "";
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

  if (item.categorySlug) {
    categorySelect.value = item.categorySlug;
  } else {
    categorySelect.value = "";
  }

  newCategoryNameInput.value = "";
  newCategorySlugInput.value = "";
  toggleNewCategoryFields();

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

async function loadEquipmentList() {
  if (!equipmentList) return;

  equipmentList.innerHTML = "<p class='admin-muted'>Loading equipment…</p>";

  try {
    const equipmentQuery = query(collection(db, "equipment"), orderBy("name"));
    const snapshot = await getDocs(equipmentQuery);

    if (snapshot.empty) {
      equipmentList.innerHTML = "<p class='admin-muted'>No equipment yet.</p>";
      return;
    }

    equipmentList.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const item = docSnap.data();
      const row = document.createElement("div");
      row.className = "admin-list-item";

      row.innerHTML = `
        <img src="${item.imageUrl || "../images/placeholder.png"}" alt="${item.alt || item.name || ""}" />
        <div class="admin-list-meta">
          <h3>${item.shortTitle || item.name || "Untitled item"}</h3>
          <p>Category: ${item.categorySlug || ""}</p>
          <p>Inventory: ${Number(item.inventory || 0)} · Max qty: ${Number(item.maxQuantity || 1)}</p>
          <p>${formatPrice(item)} · ${item.active ? "Active" : "Inactive"}</p>
        </div>
        <div class="admin-list-actions">
          <button class="admin-button-secondary edit-equipment-button" type="button">Edit</button>
          <button class="admin-button-danger delete-equipment-button" type="button">Delete</button>
        </div>
      `;

      row.querySelector(".edit-equipment-button").addEventListener("click", async () => {
        await loadCategoriesIntoSelect(item.categorySlug || "");
        fillEquipmentForm(docSnap.id, item);
      });

      row.querySelector(".delete-equipment-button").addEventListener("click", () => {
        removeEquipment(docSnap.id);
      });

      equipmentList.appendChild(row);
    });
  } catch (error) {
    console.error("Load equipment failed:", error);
    equipmentList.innerHTML = "<p class='admin-muted'>Could not load equipment list.</p>";
  }
}

/* ---------------------------
   INIT
---------------------------- */
onAuthStateChanged(auth, async (user) => {
  if (!window.location.pathname.includes("/admin/dashboard.html")) return;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  await loadCategoriesIntoSelect();
  await loadEquipmentList();
});

if (categorySelect) {
  categorySelect.addEventListener("change", toggleNewCategoryFields);
}

if (equipmentForm) {
  equipmentForm.addEventListener("submit", saveEquipment);
}

const cancelEquipmentEditButton = document.getElementById("cancel-edit-button");
if (cancelEquipmentEditButton) {
  cancelEquipmentEditButton.addEventListener("click", resetEquipmentForm);
}