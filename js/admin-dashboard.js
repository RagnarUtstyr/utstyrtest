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
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const IMAGE_BASE_PATH = "/utstyrtest/images/";

const saveStatus = document.getElementById("save-status");
const equipmentForm = document.getElementById("equipment-form");
const equipmentList = document.getElementById("admin-equipment-list");
const categoryList = document.getElementById("admin-category-list");
const categorySelect = document.getElementById("categorySelect");
const newCategoryNameField = document.getElementById("newCategoryNameField");
const newCategorySlugField = document.getElementById("newCategorySlugField");
const newCategoryNameInput = document.getElementById("newCategoryName");
const newCategorySlugInput = document.getElementById("newCategorySlug");
const clearAllEquipmentButton = document.getElementById("clear-all-equipment-button");

const editModal = document.getElementById("edit-equipment-modal");
const editEquipmentForm = document.getElementById("edit-equipment-form");
const editCategorySelect = document.getElementById("edit-categorySelect");
const editNewCategoryNameField = document.getElementById("edit-newCategoryNameField");
const editNewCategorySlugField = document.getElementById("edit-newCategorySlugField");
const editNewCategoryNameInput = document.getElementById("edit-newCategoryName");
const editNewCategorySlugInput = document.getElementById("edit-newCategorySlug");
const closeEditModalButton = document.getElementById("close-edit-modal-button");
const cancelEditModalButton = document.getElementById("cancel-edit-modal-button");

let currentEquipmentEditId = null;
let categoriesCache = [];
let equipmentExpandedState = {};

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
      const parts = line.split(":");
      const label = (parts.shift() || "").trim();
      const value = parts.join(":").trim();
      return { label, value };
    });
}

function buildImageUrl(imageName) {
  const cleanName = (imageName || "").trim().replace(/^\/+/, "");
  return cleanName ? `${IMAGE_BASE_PATH}${cleanName}` : "/utstyrtest/images/placeholder.png";
}

function formatPrice(item) {
  if (
    item.rentalPrice === undefined ||
    item.rentalPrice === null ||
    item.rentalPrice === ""
  ) {
    return "No price";
  }

  return `${item.rentalPrice} NOK`;
}

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const aOrder = Number(a.sortOrder ?? 999999);
    const bOrder = Number(b.sortOrder ?? 999999);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function toggleNewCategoryFields() {
  const isNew = categorySelect.value === "__new__";
  newCategoryNameField.classList.toggle("hidden", !isNew);
  newCategorySlugField.classList.toggle("hidden", !isNew);
  newCategoryNameInput.required = isNew;
  newCategorySlugInput.required = isNew;
}

function toggleEditNewCategoryFields() {
  const isNew = editCategorySelect.value === "__new__";
  editNewCategoryNameField.classList.toggle("hidden", !isNew);
  editNewCategorySlugField.classList.toggle("hidden", !isNew);
  editNewCategoryNameInput.required = isNew;
  editNewCategorySlugInput.required = isNew;
}

async function fetchAllCategories() {
  const snapshot = await getDocs(query(collection(db, "categories")));
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

async function loadCategoriesIntoSelect(selectedSlug = "") {
  if (!categorySelect) return;

  try {
    categoriesCache = sortCategories(await fetchAllCategories());

    categorySelect.innerHTML = `
      <option value="">Select category</option>
      ${categoriesCache
        .filter((category) => category.active !== false)
        .map((category) => `<option value="${category.slug}">${category.name}</option>`)
        .join("")}
      <option value="__new__">Create new category</option>
    `;

    if (selectedSlug) {
      const exists = categoriesCache.some((category) => category.slug === selectedSlug);
      if (exists) categorySelect.value = selectedSlug;
    }

    toggleNewCategoryFields();
  } catch (error) {
    console.error("Failed loading categories:", error);
  }
}

async function loadCategoriesIntoEditSelect(selectedSlug = "") {
  if (!editCategorySelect) return;

  try {
    categoriesCache = sortCategories(await fetchAllCategories());

    editCategorySelect.innerHTML = `
      <option value="">Select category</option>
      ${categoriesCache
        .filter((category) => category.active !== false)
        .map((category) => `<option value="${category.slug}">${category.name}</option>`)
        .join("")}
      <option value="__new__">Create new category</option>
    `;

    if (selectedSlug) {
      const exists = categoriesCache.some((category) => category.slug === selectedSlug);
      if (exists) editCategorySelect.value = selectedSlug;
    }

    toggleEditNewCategoryFields();
  } catch (error) {
    console.error("Failed loading edit categories:", error);
  }
}

async function ensureCategoryExists() {
  const selectedValue = categorySelect.value;

  if (!selectedValue) throw new Error("Please select a category.");
  if (selectedValue !== "__new__") return selectedValue;

  const newCategoryName = newCategoryNameInput.value.trim();
  const newCategorySlug = slugify(newCategorySlugInput.value.trim());

  if (!newCategoryName || !newCategorySlug) {
    throw new Error("New category name and slug are required.");
  }

  const existingQuery = query(collection(db, "categories"), where("slug", "==", newCategorySlug));
  const existingSnapshot = await getDocs(existingQuery);

  if (!existingSnapshot.empty) return newCategorySlug;

  const sorted = sortCategories(categoriesCache);
  const nextSortOrder =
    sorted.length > 0
      ? Math.max(...sorted.map((category) => Number(category.sortOrder || 0))) + 10
      : 10;

  await addDoc(collection(db, "categories"), {
    name: newCategoryName,
    slug: newCategorySlug,
    sortOrder: nextSortOrder,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await loadCategoriesIntoSelect(newCategorySlug);
  await loadCategoriesIntoEditSelect(newCategorySlug);
  await loadCategoryList();
  return newCategorySlug;
}

async function ensureEditCategoryExists() {
  const selectedValue = editCategorySelect.value;

  if (!selectedValue) throw new Error("Please select a category.");
  if (selectedValue !== "__new__") return selectedValue;

  const newCategoryName = editNewCategoryNameInput.value.trim();
  const newCategorySlug = slugify(editNewCategorySlugInput.value.trim());

  if (!newCategoryName || !newCategorySlug) {
    throw new Error("New category name and slug are required.");
  }

  const existingQuery = query(collection(db, "categories"), where("slug", "==", newCategorySlug));
  const existingSnapshot = await getDocs(existingQuery);

  if (!existingSnapshot.empty) return newCategorySlug;

  const sorted = sortCategories(categoriesCache);
  const nextSortOrder =
    sorted.length > 0
      ? Math.max(...sorted.map((category) => Number(category.sortOrder || 0))) + 10
      : 10;

  await addDoc(collection(db, "categories"), {
    name: newCategoryName,
    slug: newCategorySlug,
    sortOrder: nextSortOrder,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await loadCategoriesIntoSelect(newCategorySlug);
  await loadCategoriesIntoEditSelect(newCategorySlug);
  await loadCategoryList();
  return newCategorySlug;
}

function resetEquipmentForm() {
  equipmentForm.reset();
  document.getElementById("inventory").value = 1;
  document.getElementById("active").checked = true;
  categorySelect.value = "";
  newCategoryNameInput.value = "";
  newCategorySlugInput.value = "";
  toggleNewCategoryFields();
}

function resetEditModalForm() {
  currentEquipmentEditId = null;
  editEquipmentForm.reset();
  document.getElementById("edit-inventory").value = 1;
  document.getElementById("edit-active").checked = true;
  editCategorySelect.value = "";
  editNewCategoryNameInput.value = "";
  editNewCategorySlugInput.value = "";
  toggleEditNewCategoryFields();
}

function openEditModal() {
  editModal.classList.add("open");
  editModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeEditModal() {
  editModal.classList.remove("open");
  editModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  resetEditModalForm();
}

async function saveEquipment(event) {
  event.preventDefault();

  try {
    saveStatus.textContent = "Saving equipment…";

    const categorySlug = await ensureCategoryExists();
    const name = document.getElementById("name").value.trim();
    const imageName = document.getElementById("imageName").value.trim();
    const inventory = Number(document.getElementById("inventory").value || 0);
    const rentalPriceValue = document.getElementById("rentalPrice").value;
    const rentalPrice = rentalPriceValue === "" ? null : Number(rentalPriceValue);
    const active = document.getElementById("active").checked;
    const keywords = parseLines(document.getElementById("keywords").value);
    const description = parseLines(document.getElementById("description").value);
    const specifications = parseSpecifications(document.getElementById("specifications").value);
    const slug = slugify(name);

    const payload = {
      name,
      slug,
      categorySlug,
      imageName,
      imageUrl: buildImageUrl(imageName),
      inventory,
      rentalPrice,
      active,
      keywords,
      description,
      specifications,
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(db, "equipment"), {
      ...payload,
      createdAt: serverTimestamp()
    });

    saveStatus.textContent = "Equipment saved.";
    resetEquipmentForm();
    await loadEquipmentList();
  } catch (error) {
    console.error("Save equipment failed:", error);
    saveStatus.textContent = error.message || "Equipment save failed.";
  }
}

async function saveEditedEquipment(event) {
  event.preventDefault();

  if (!currentEquipmentEditId) return;

  try {
    saveStatus.textContent = "Saving changes…";

    const categorySlug = await ensureEditCategoryExists();
    const name = document.getElementById("edit-name").value.trim();
    const imageName = document.getElementById("edit-imageName").value.trim();
    const inventory = Number(document.getElementById("edit-inventory").value || 0);
    const rentalPriceValue = document.getElementById("edit-rentalPrice").value;
    const rentalPrice = rentalPriceValue === "" ? null : Number(rentalPriceValue);
    const active = document.getElementById("edit-active").checked;
    const keywords = parseLines(document.getElementById("edit-keywords").value);
    const description = parseLines(document.getElementById("edit-description").value);
    const specifications = parseSpecifications(document.getElementById("edit-specifications").value);
    const slug = slugify(name);

    const payload = {
      name,
      slug,
      categorySlug,
      imageName,
      imageUrl: buildImageUrl(imageName),
      inventory,
      rentalPrice,
      active,
      keywords,
      description,
      specifications,
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, "equipment", currentEquipmentEditId), payload);

    saveStatus.textContent = "Equipment updated.";
    closeEditModal();
    await loadEquipmentList();
  } catch (error) {
    console.error("Edit equipment failed:", error);
    saveStatus.textContent = error.message || "Equipment update failed.";
  }
}

async function fillEditModal(id, item) {
  currentEquipmentEditId = id;

  await loadCategoriesIntoEditSelect(item.categorySlug || "");

  document.getElementById("edit-name").value = item.name || "";
  document.getElementById("edit-imageName").value = item.imageName || "";
  document.getElementById("edit-inventory").value = item.inventory ?? 0;
  document.getElementById("edit-rentalPrice").value = item.rentalPrice ?? "";
  document.getElementById("edit-keywords").value = (item.keywords || []).join("\n");
  document.getElementById("edit-description").value = (item.description || []).join("\n");
  document.getElementById("edit-specifications").value = (item.specifications || [])
    .map((spec) => `${spec.label}: ${spec.value}`)
    .join("\n");
  document.getElementById("edit-active").checked = !!item.active;

  editNewCategoryNameInput.value = "";
  editNewCategorySlugInput.value = "";
  toggleEditNewCategoryFields();

  openEditModal();
}

async function removeEquipment(id) {
  const ok = window.confirm("Delete this equipment item?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "equipment", id));
    await loadEquipmentList();
    await loadCategoryList();
  } catch (error) {
    console.error("Delete equipment failed:", error);
  }
}

async function clearAllEquipment() {
  const firstConfirm = window.confirm("Delete ALL equipment items? This does not delete categories.");
  if (!firstConfirm) return;

  const secondConfirm = window.confirm("Are you absolutely sure? This removes every document in the equipment collection.");
  if (!secondConfirm) return;

  try {
    saveStatus.textContent = "Deleting all equipment…";

    const snapshot = await getDocs(collection(db, "equipment"));
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, "equipment", docSnap.id));
    }

    resetEquipmentForm();
    await loadEquipmentList();
    await loadCategoryList();
    saveStatus.textContent = "All equipment deleted.";
  } catch (error) {
    console.error("Clear all equipment failed:", error);
    saveStatus.textContent = "Clear all equipment failed.";
  }
}

async function deleteCategory(categoryId, categorySlug, categoryName) {
  const linkedQuery = query(collection(db, "equipment"), where("categorySlug", "==", categorySlug));
  const linkedSnapshot = await getDocs(linkedQuery);

  if (!linkedSnapshot.empty) {
    window.alert(`Cannot delete "${categoryName}" because ${linkedSnapshot.size} equipment item(s) still use this category.`);
    return;
  }

  const ok = window.confirm(`Delete category "${categoryName}"?`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "categories", categoryId));
    await loadCategoriesIntoSelect();
    await loadCategoriesIntoEditSelect();
    await loadCategoryList();
    saveStatus.textContent = `Category "${categoryName}" deleted.`;
  } catch (error) {
    console.error("Delete category failed:", error);
    saveStatus.textContent = "Delete category failed.";
  }
}

async function updateCategorySortOrder(categoryId, newSortOrder) {
  try {
    await updateDoc(doc(db, "categories", categoryId), {
      sortOrder: Number(newSortOrder),
      updatedAt: serverTimestamp()
    });
    await loadCategoriesIntoSelect();
    await loadCategoriesIntoEditSelect();
    await loadCategoryList();
    await loadEquipmentList();
    saveStatus.textContent = "Category order updated.";
  } catch (error) {
    console.error("Update category sort order failed:", error);
    saveStatus.textContent = "Category order update failed.";
  }
}

async function moveCategory(categoryId, direction) {
  const sorted = sortCategories(categoriesCache);
  const index = sorted.findIndex((category) => category.id === categoryId);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sorted.length) return;

  const current = sorted[index];
  const other = sorted[swapIndex];

  try {
    await updateDoc(doc(db, "categories", current.id), {
      sortOrder: Number(other.sortOrder ?? 0),
      updatedAt: serverTimestamp()
    });

    await updateDoc(doc(db, "categories", other.id), {
      sortOrder: Number(current.sortOrder ?? 0),
      updatedAt: serverTimestamp()
    });

    await loadCategoriesIntoSelect();
    await loadCategoriesIntoEditSelect();
    await loadCategoryList();
    await loadEquipmentList();
    saveStatus.textContent = "Category order updated.";
  } catch (error) {
    console.error("Move category failed:", error);
    saveStatus.textContent = "Move category failed.";
  }
}

async function loadCategoryList() {
  if (!categoryList) return;

  categoryList.innerHTML = "<p class='admin-muted'>Loading categories…</p>";

  try {
    categoriesCache = sortCategories(await fetchAllCategories());

    if (categoriesCache.length === 0) {
      categoryList.innerHTML = "<p class='admin-muted'>No categories yet.</p>";
      return;
    }

    categoryList.innerHTML = "";

    for (const category of categoriesCache) {
      const linkedQuery = query(collection(db, "equipment"), where("categorySlug", "==", category.slug));
      const linkedSnapshot = await getDocs(linkedQuery);

      const row = document.createElement("div");
      row.className = "admin-category-item";

      row.innerHTML = `
        <div>
          <h3>${category.name || "Untitled category"}</h3>
          <p>Slug: ${category.slug || ""} · Items: ${linkedSnapshot.size}</p>
        </div>
        <div class="admin-category-controls">
          <input
            class="admin-sort-input"
            type="number"
            value="${Number(category.sortOrder ?? 0)}"
            aria-label="Sort order for ${category.name || category.slug || "category"}"
          />
          <button class="admin-button-secondary move-up-button" type="button">↑</button>
          <button class="admin-button-secondary move-down-button" type="button">↓</button>
          <button class="admin-button-secondary save-sort-button" type="button">Save</button>
          <button class="admin-button-danger delete-category-button" type="button">Delete</button>
        </div>
      `;

      row.querySelector(".save-sort-button").addEventListener("click", () => {
        const newValue = row.querySelector(".admin-sort-input").value;
        updateCategorySortOrder(category.id, newValue);
      });

      row.querySelector(".move-up-button").addEventListener("click", () => {
        moveCategory(category.id, "up");
      });

      row.querySelector(".move-down-button").addEventListener("click", () => {
        moveCategory(category.id, "down");
      });

      row.querySelector(".delete-category-button").addEventListener("click", () => {
        deleteCategory(category.id, category.slug, category.name || category.slug || "category");
      });

      categoryList.appendChild(row);
    }
  } catch (error) {
    console.error("Load category list failed:", error);
    categoryList.innerHTML = "<p class='admin-muted'>Could not load categories.</p>";
  }
}

async function loadEquipmentList() {
  if (!equipmentList) return;

  equipmentList.innerHTML = "<p class='admin-muted'>Loading equipment…</p>";

  try {
    categoriesCache = sortCategories(await fetchAllCategories());

    const snapshot = await getDocs(query(collection(db, "equipment")));
    const items = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    if (items.length === 0) {
      equipmentList.innerHTML = "<p class='admin-muted'>No equipment yet.</p>";
      return;
    }

    const categoryOrderMap = new Map(categoriesCache.map((category, index) => [category.slug, index]));

    items.sort((a, b) => {
      const aIndex = categoryOrderMap.has(a.categorySlug) ? categoryOrderMap.get(a.categorySlug) : 999999;
      const bIndex = categoryOrderMap.has(b.categorySlug) ? categoryOrderMap.get(b.categorySlug) : 999999;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return (a.name || "").localeCompare(b.name || "");
    });

    const grouped = new Map();
    items.forEach((item) => {
      const slug = item.categorySlug || "__uncategorized__";
      if (!grouped.has(slug)) grouped.set(slug, []);
      grouped.get(slug).push(item);
    });

    const orderedSlugs = [
      ...categoriesCache.map((category) => category.slug).filter((slug) => grouped.has(slug)),
      ...[...grouped.keys()].filter((slug) => !categoriesCache.some((category) => category.slug === slug))
    ];

    equipmentList.innerHTML = "";

    orderedSlugs.forEach((slug) => {
      const categoryMeta = categoriesCache.find((category) => category.slug === slug);
      const categoryName = categoryMeta?.name || slug || "Uncategorized";
      const categoryItems = grouped.get(slug) || [];

      if (!(slug in equipmentExpandedState)) {
        equipmentExpandedState[slug] = false;
      }

      const group = document.createElement("div");
      group.className = `equipment-group${equipmentExpandedState[slug] ? " open" : ""}`;

      const header = document.createElement("button");
      header.type = "button";
      header.className = "equipment-group-header";
      header.innerHTML = `
        <div class="equipment-group-title">
          <span>${categoryName}</span>
          <span class="equipment-group-count">${categoryItems.length} item(s)</span>
        </div>
        <span class="equipment-group-chevron">▼</span>
      `;

      const body = document.createElement("div");
      body.className = "equipment-group-body";

      header.addEventListener("click", () => {
        equipmentExpandedState[slug] = !equipmentExpandedState[slug];
        group.classList.toggle("open", equipmentExpandedState[slug]);
      });

      categoryItems.forEach((item) => {
        const imageUrl = buildImageUrl(item.imageName);

        const row = document.createElement("div");
        row.className = "admin-list-item";

        row.innerHTML = `
          <img src="${imageUrl}" alt="${item.name || ""}" />
          <div class="admin-list-meta">
            <h3>${item.name || "Untitled item"}</h3>
            <p>Category: ${item.categorySlug || ""}</p>
            <p>Inventory: ${Number(item.inventory || 0)}</p>
            <p>${formatPrice(item)} · ${item.active ? "Active" : "Inactive"}</p>
            <p>Image: ${item.imageName || ""}</p>
          </div>
          <div class="admin-list-actions">
            <button class="admin-button-secondary edit-equipment-button" type="button">Edit</button>
            <button class="admin-button-danger delete-equipment-button" type="button">Delete</button>
          </div>
        `;

        row.querySelector(".edit-equipment-button").addEventListener("click", async () => {
          await fillEditModal(item.id, item);
        });

        row.querySelector(".delete-equipment-button").addEventListener("click", () => {
          removeEquipment(item.id);
        });

        body.appendChild(row);
      });

      group.appendChild(header);
      group.appendChild(body);
      equipmentList.appendChild(group);
    });
  } catch (error) {
    console.error("Load equipment failed:", error);
    equipmentList.innerHTML = "<p class='admin-muted'>Could not load equipment list.</p>";
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!window.location.pathname.includes("/admin/dashboard.html")) return;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  await loadCategoriesIntoSelect();
  await loadCategoriesIntoEditSelect();
  await loadCategoryList();
  await loadEquipmentList();
});

if (categorySelect) {
  categorySelect.addEventListener("change", toggleNewCategoryFields);
}

if (editCategorySelect) {
  editCategorySelect.addEventListener("change", toggleEditNewCategoryFields);
}

if (equipmentForm) {
  equipmentForm.addEventListener("submit", saveEquipment);
}

if (editEquipmentForm) {
  editEquipmentForm.addEventListener("submit", saveEditedEquipment);
}

if (clearAllEquipmentButton) {
  clearAllEquipmentButton.addEventListener("click", clearAllEquipment);
}

if (closeEditModalButton) {
  closeEditModalButton.addEventListener("click", closeEditModal);
}

if (cancelEditModalButton) {
  cancelEditModalButton.addEventListener("click", closeEditModal);
}

if (editModal) {
  editModal.addEventListener("click", (event) => {
    if (event.target === editModal) {
      closeEditModal();
    }
  });
}

const cancelEquipmentEditButton = document.getElementById("cancel-edit-button");
if (cancelEquipmentEditButton) {
  cancelEquipmentEditButton.addEventListener("click", resetEquipmentForm);
}