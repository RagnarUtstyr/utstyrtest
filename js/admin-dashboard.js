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
const adminEquipmentSearch = document.getElementById("admin-equipment-search");

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
let allEquipmentCache = [];
let currentAdminSearch = "";

function slugify(value) {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9æøå\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeText(value) {
  return (value || "").toString().toLowerCase().trim();
}

function parseLines(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
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
  if (item.rentalPrice === undefined || item.rentalPrice === null || item.rentalPrice === "") {
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

function sortEquipment(items, categoryOrderMap) {
  return [...items].sort((a, b) => {
    const aCategory = categoryOrderMap.has(a.categorySlug) ? categoryOrderMap.get(a.categorySlug) : 999999;
    const bCategory = categoryOrderMap.has(b.categorySlug) ? categoryOrderMap.get(b.categorySlug) : 999999;
    if (aCategory !== bCategory) return aCategory - bCategory;

    const aSort = Number(a.sortOrder ?? 999999);
    const bSort = Number(b.sortOrder ?? 999999);
    if (aSort !== bSort) return aSort - bSort;

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
  categoriesCache = sortCategories(await fetchAllCategories());

  categorySelect.innerHTML = `
    <option value="">Select category</option>
    ${categoriesCache
      .filter((category) => category.active !== false)
      .map((category) => `<option value="${category.slug}">${category.name}</option>`)
      .join("")}
    <option value="__new__">Create new category</option>
  `;

  if (selectedSlug && categoriesCache.some((category) => category.slug === selectedSlug)) {
    categorySelect.value = selectedSlug;
  }

  toggleNewCategoryFields();
}

async function loadCategoriesIntoEditSelect(selectedSlug = "") {
  categoriesCache = sortCategories(await fetchAllCategories());

  editCategorySelect.innerHTML = `
    <option value="">Select category</option>
    ${categoriesCache
      .filter((category) => category.active !== false)
      .map((category) => `<option value="${category.slug}">${category.name}</option>`)
      .join("")}
    <option value="__new__">Create new category</option>
  `;

  if (selectedSlug && categoriesCache.some((category) => category.slug === selectedSlug)) {
    editCategorySelect.value = selectedSlug;
  }

  toggleEditNewCategoryFields();
}

async function ensureCategoryExists(fromEdit = false) {
  const select = fromEdit ? editCategorySelect : categorySelect;
  const nameInput = fromEdit ? editNewCategoryNameInput : newCategoryNameInput;
  const slugInput = fromEdit ? editNewCategorySlugInput : newCategorySlugInput;

  const selectedValue = select.value;

  if (!selectedValue) throw new Error("Please select a category.");
  if (selectedValue !== "__new__") return selectedValue;

  const newCategoryName = nameInput.value.trim();
  const newCategorySlug = slugify(slugInput.value.trim());

  if (!newCategoryName || !newCategorySlug) {
    throw new Error("New category name and slug are required.");
  }

  const existingQuery = query(collection(db, "categories"), where("slug", "==", newCategorySlug));
  const existingSnapshot = await getDocs(existingQuery);
  if (!existingSnapshot.empty) return newCategorySlug;

  const nextSortOrder =
    categoriesCache.length > 0
      ? Math.max(...categoriesCache.map((category) => Number(category.sortOrder || 0))) + 10
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

    const categorySlug = await ensureCategoryExists(false);
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

    const sameCategoryItems = allEquipmentCache.filter((item) => item.categorySlug === categorySlug);
    const nextSortOrder =
      sameCategoryItems.length > 0
        ? Math.max(...sameCategoryItems.map((item) => Number(item.sortOrder || 0))) + 10
        : 10;

    await addDoc(collection(db, "equipment"), {
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
      sortOrder: nextSortOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    saveStatus.textContent = "Equipment saved.";
    resetEquipmentForm();
    await loadEquipmentList();
  } catch (error) {
    console.error(error);
    saveStatus.textContent = error.message || "Equipment save failed.";
  }
}

async function saveEditedEquipment(event) {
  event.preventDefault();
  if (!currentEquipmentEditId) return;

  try {
    saveStatus.textContent = "Saving changes…";

    const categorySlug = await ensureCategoryExists(true);
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

    const existing = allEquipmentCache.find((item) => item.id === currentEquipmentEditId);
    let sortOrder = existing?.sortOrder ?? 999999;

    if (existing && existing.categorySlug !== categorySlug) {
      const sameCategoryItems = allEquipmentCache.filter(
        (item) => item.categorySlug === categorySlug && item.id !== currentEquipmentEditId
      );
      sortOrder =
        sameCategoryItems.length > 0
          ? Math.max(...sameCategoryItems.map((item) => Number(item.sortOrder || 0))) + 10
          : 10;
    }

    await updateDoc(doc(db, "equipment", currentEquipmentEditId), {
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
      sortOrder,
      updatedAt: serverTimestamp()
    });

    saveStatus.textContent = "Equipment updated.";
    closeEditModal();
    await loadEquipmentList();
  } catch (error) {
    console.error(error);
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

  openEditModal();
}

async function removeEquipment(id) {
  if (!window.confirm("Delete this equipment item?")) return;

  await deleteDoc(doc(db, "equipment", id));
  await loadEquipmentList();
  await loadCategoryList();
}

async function clearAllEquipment() {
  if (!window.confirm("Delete ALL equipment items?")) return;
  if (!window.confirm("Are you absolutely sure?")) return;

  const snapshot = await getDocs(collection(db, "equipment"));
  for (const docSnap of snapshot.docs) {
    await deleteDoc(doc(db, "equipment", docSnap.id));
  }

  await loadEquipmentList();
  await loadCategoryList();
  saveStatus.textContent = "All equipment deleted.";
}

async function deleteCategory(categoryId, categorySlug, categoryName) {
  const linkedQuery = query(collection(db, "equipment"), where("categorySlug", "==", categorySlug));
  const linkedSnapshot = await getDocs(linkedQuery);

  if (!linkedSnapshot.empty) {
    window.alert(`Cannot delete "${categoryName}" because ${linkedSnapshot.size} equipment item(s) still use this category.`);
    return;
  }

  if (!window.confirm(`Delete category "${categoryName}"?`)) return;

  await deleteDoc(doc(db, "categories", categoryId));
  await loadCategoriesIntoSelect();
  await loadCategoriesIntoEditSelect();
  await loadCategoryList();
  await loadEquipmentList();
}

async function updateCategorySortOrder(categoryId, newSortOrder) {
  await updateDoc(doc(db, "categories", categoryId), {
    sortOrder: Number(newSortOrder),
    updatedAt: serverTimestamp()
  });
  await loadCategoriesIntoSelect();
  await loadCategoriesIntoEditSelect();
  await loadCategoryList();
  await loadEquipmentList();
}

async function persistCategoryOrder(orderedIds) {
  for (let i = 0; i < orderedIds.length; i += 1) {
    const categoryId = orderedIds[i];
    await updateDoc(doc(db, "categories", categoryId), {
      sortOrder: (i + 1) * 10,
      updatedAt: serverTimestamp()
    });
  }

  await loadCategoriesIntoSelect();
  await loadCategoriesIntoEditSelect();
  await loadCategoryList();
  await loadEquipmentList();
  saveStatus.textContent = "Category order updated.";
}

async function loadCategoryList() {
  categoryList.innerHTML = "<p class='admin-muted'>Loading categories…</p>";
  categoriesCache = sortCategories(await fetchAllCategories());

  if (!categoriesCache.length) {
    categoryList.innerHTML = "<p class='admin-muted'>No categories yet.</p>";
    return;
  }

  categoryList.innerHTML = "";

  let dragged = null;

  for (const category of categoriesCache) {
    const linkedQuery = query(collection(db, "equipment"), where("categorySlug", "==", category.slug));
    const linkedSnapshot = await getDocs(linkedQuery);

    const row = document.createElement("div");
    row.className = "admin-category-item";
    row.dataset.categoryId = category.id;
    row.setAttribute("draggable", "true");

    row.innerHTML = `
      <div>
        <h3>${category.name || "Untitled category"}</h3>
        <p>Slug: ${category.slug || ""} · Items: ${linkedSnapshot.size}</p>
      </div>
      <div class="admin-category-controls">
        <input class="admin-sort-input" type="number" value="${Number(category.sortOrder ?? 0)}">
        <button class="admin-button-secondary save-sort-button" type="button">Save</button>
        <button class="admin-button-danger delete-category-button" type="button">Delete</button>
      </div>
    `;

    row.querySelector(".save-sort-button").addEventListener("click", () => {
      const newValue = row.querySelector(".admin-sort-input").value;
      updateCategorySortOrder(category.id, newValue);
    });

    row.querySelector(".delete-category-button").addEventListener("click", () => {
      deleteCategory(category.id, category.slug, category.name || category.slug || "category");
    });

    row.addEventListener("dragstart", () => {
      dragged = row;
      row.classList.add("dragging");
    });

    row.addEventListener("dragend", async () => {
      row.classList.remove("dragging");
      categoryList.querySelectorAll(".admin-category-item").forEach((el) => el.classList.remove("admin-drop-target"));
      const orderedIds = Array.from(categoryList.querySelectorAll(".admin-category-item")).map((el) => el.dataset.categoryId);
      await persistCategoryOrder(orderedIds);
    });

    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!dragged || dragged === row) return;
      row.classList.add("admin-drop-target");
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("admin-drop-target");
    });

    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("admin-drop-target");
      if (!dragged || dragged === row) return;

      const rows = Array.from(categoryList.querySelectorAll(".admin-category-item"));
      const draggedIndex = rows.indexOf(dragged);
      const targetIndex = rows.indexOf(row);

      if (draggedIndex < targetIndex) {
        row.after(dragged);
      } else {
        row.before(dragged);
      }
    });

    categoryList.appendChild(row);
  }
}

function matchesAdminSearch(item) {
  if (!currentAdminSearch) return true;

  const haystack = [
    item.name,
    item.categorySlug,
    ...(item.keywords || [])
  ].join(" ").toLowerCase();

  return haystack.includes(currentAdminSearch);
}

async function persistCategoryItemOrder(categorySlug, orderedIds) {
  const categoryItems = allEquipmentCache
    .filter((item) => item.categorySlug === categorySlug)
    .sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));

  for (let i = 0; i < categoryItems.length; i += 1) {
    const item = categoryItems[i];
    const newSortOrder = (i + 1) * 10;
    await updateDoc(doc(db, "equipment", item.id), {
      sortOrder: newSortOrder,
      updatedAt: serverTimestamp()
    });
    item.sortOrder = newSortOrder;
  }
}

function attachDragHandlers(body, categorySlug) {
  let dragged = null;
  const rows = Array.from(body.querySelectorAll(".admin-list-item"));

  rows.forEach((row) => {
    row.addEventListener("dragstart", () => {
      dragged = row;
      row.classList.add("dragging");
    });

    row.addEventListener("dragend", async () => {
      row.classList.remove("dragging");
      body.querySelectorAll(".admin-list-item").forEach((el) => el.classList.remove("admin-drop-target"));
      const orderedIds = Array.from(body.querySelectorAll(".admin-list-item")).map((el) => el.dataset.itemId);
      await persistCategoryItemOrder(categorySlug, orderedIds);
      await loadEquipmentList();
    });

    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!dragged || dragged === row) return;
      row.classList.add("admin-drop-target");
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("admin-drop-target");
    });

    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("admin-drop-target");
      if (!dragged || dragged === row) return;

      const bodyRows = Array.from(body.querySelectorAll(".admin-list-item"));
      const draggedIndex = bodyRows.indexOf(dragged);
      const targetIndex = bodyRows.indexOf(row);

      if (draggedIndex < targetIndex) {
        row.after(dragged);
      } else {
        row.before(dragged);
      }
    });
  });
}

async function loadEquipmentList() {
  equipmentList.innerHTML = "<p class='admin-muted'>Loading equipment…</p>";

  categoriesCache = sortCategories(await fetchAllCategories());
  const categoryOrderMap = new Map(categoriesCache.map((category, index) => [category.slug, index]));

  const snapshot = await getDocs(query(collection(db, "equipment")));
  allEquipmentCache = sortEquipment(
    snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })),
    categoryOrderMap
  );

  const filteredItems = allEquipmentCache.filter(matchesAdminSearch);

  if (!filteredItems.length) {
    equipmentList.innerHTML = "<p class='admin-muted'>No matching equipment.</p>";
    return;
  }

  const grouped = new Map();
  filteredItems.forEach((item) => {
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
      equipmentExpandedState[slug] = currentAdminSearch ? true : false;
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
      const row = document.createElement("div");
      row.className = "admin-list-item";
      row.setAttribute("draggable", "true");
      row.dataset.itemId = item.id;

      row.innerHTML = `
        <img src="${buildImageUrl(item.imageName)}" alt="${item.name || ""}" />
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

      row.querySelector(".edit-equipment-button").addEventListener("click", () => fillEditModal(item.id, item));
      row.querySelector(".delete-equipment-button").addEventListener("click", () => removeEquipment(item.id));

      body.appendChild(row);
    });

    group.appendChild(header);
    group.appendChild(body);
    equipmentList.appendChild(group);

    attachDragHandlers(body, slug);
  });
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

categorySelect?.addEventListener("change", toggleNewCategoryFields);
editCategorySelect?.addEventListener("change", toggleEditNewCategoryFields);
equipmentForm?.addEventListener("submit", saveEquipment);
editEquipmentForm?.addEventListener("submit", saveEditedEquipment);
clearAllEquipmentButton?.addEventListener("click", clearAllEquipment);

adminEquipmentSearch?.addEventListener("input", (event) => {
  currentAdminSearch = normalizeText(event.target.value);
  if (currentAdminSearch) {
    Object.keys(equipmentExpandedState).forEach((key) => {
      equipmentExpandedState[key] = true;
    });
  }
  loadEquipmentList();
});

closeEditModalButton?.addEventListener("click", closeEditModal);
cancelEditModalButton?.addEventListener("click", closeEditModal);

editModal?.addEventListener("click", (event) => {
  if (event.target === editModal) closeEditModal();
});

document.getElementById("cancel-edit-button")?.addEventListener("click", resetEquipmentForm);