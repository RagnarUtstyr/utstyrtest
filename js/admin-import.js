import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const jsonFileInput = document.getElementById("jsonFile");
const jsonInput = document.getElementById("jsonInput");
const loadFileButton = document.getElementById("loadFileButton");
const validateJsonButton = document.getElementById("validateJsonButton");
const importJsonButton = document.getElementById("importJsonButton");
const importModeSelect = document.getElementById("importMode");
const resultBox = document.getElementById("result");

function setResult(message) {
  resultBox.textContent = message;
}

function slugify(value) {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9æøå\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseJsonInput() {
  const raw = jsonInput.value.trim();

  if (!raw) {
    throw new Error("JSON input is empty.");
  }

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Top-level JSON must be an array.");
  }

  return parsed;
}

function normalizeArrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item || "").toString().trim())
    .filter(Boolean);
}

function normalizeSpecifications(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((spec) => ({
      label: (spec?.label || "").toString().trim(),
      value: (spec?.value || "").toString().trim()
    }))
    .filter((spec) => spec.label || spec.value);
}

function validateItem(item, index) {
  const errors = [];

  if (!item || typeof item !== "object") {
    return [`Item ${index + 1}: must be an object.`];
  }

  if (!item.name || typeof item.name !== "string") {
    errors.push(`Item ${index + 1}: missing or invalid "name".`);
  }

  if (!item.categorySlug || typeof item.categorySlug !== "string") {
    errors.push(`Item ${index + 1}: missing or invalid "categorySlug".`);
  }

  if (!item.imageName || typeof item.imageName !== "string") {
    errors.push(`Item ${index + 1}: missing or invalid "imageName".`);
  }

  return errors;
}

function normalizeItem(item) {
  const name = item.name.trim();
  const categorySlug = slugify(item.categorySlug);
  const imageName = item.imageName.trim();

  return {
    name,
    slug: slugify(name),
    categorySlug,
    imageName,
    imageUrl: `/utstyrtest/images/${imageName}`,
    inventory: Number(item.inventory ?? 0),
    rentalPrice:
      item.rentalPrice === undefined || item.rentalPrice === null
        ? null
        : Number(item.rentalPrice),
    keywords: normalizeArrayOfStrings(item.keywords),
    description: normalizeArrayOfStrings(item.description),
    specifications: normalizeSpecifications(item.specifications),
    active: item.active === false ? false : true
  };
}

async function loadFileIntoTextbox() {
  const file = jsonFileInput.files?.[0];
  if (!file) {
    setResult("No file selected.");
    return;
  }

  const text = await file.text();
  jsonInput.value = text;
  setResult(`Loaded file: ${file.name}`);
}

function validateJsonOnly() {
  try {
    const parsed = parseJsonInput();
    const errors = parsed.flatMap((item, index) => validateItem(item, index));

    if (errors.length) {
      setResult(`Validation failed:\n\n${errors.join("\n")}`);
      return;
    }

    setResult(`Validation successful.\n\nItems found: ${parsed.length}`);
  } catch (error) {
    setResult(`Validation failed:\n\n${error.message}`);
  }
}

async function findCategoryBySlug(categorySlug) {
  const q = query(collection(db, "categories"), where("slug", "==", categorySlug));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0];
}

async function ensureCategoryExists(categorySlug) {
  const existing = await findCategoryBySlug(categorySlug);
  if (existing) return;

  const categoriesSnapshot = await getDocs(collection(db, "categories"));
  const sortOrder =
    categoriesSnapshot.empty
      ? 0
      : Math.max(
          ...categoriesSnapshot.docs.map((docSnap) =>
            Number(docSnap.data().sortOrder || 0)
          )
        ) + 1;

  await addDoc(collection(db, "categories"), {
    name: categorySlug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    slug: categorySlug,
    sortOrder,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

async function findEquipmentBySlug(slug) {
  const q = query(collection(db, "equipment"), where("slug", "==", slug));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0];
}

async function importJson() {
  try {
    const parsed = parseJsonInput();
    const mode = importModeSelect.value;

    const errors = parsed.flatMap((item, index) => validateItem(item, index));
    if (errors.length) {
      setResult(`Import blocked by validation errors:\n\n${errors.join("\n")}`);
      return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    setResult(`Import started for ${parsed.length} items...`);

    for (const rawItem of parsed) {
      const item = normalizeItem(rawItem);

      await ensureCategoryExists(item.categorySlug);

      const existing = await findEquipmentBySlug(item.slug);

      const payload = {
        ...item,
        updatedAt: serverTimestamp()
      };

      if (existing) {
        if (mode === "createOnly") {
          skipped += 1;
          continue;
        }

        await updateDoc(existing.ref, payload);
        updated += 1;
      } else {
        await addDoc(collection(db, "equipment"), {
          ...payload,
          createdAt: serverTimestamp()
        });
        created += 1;
      }
    }

    setResult(
      `Import finished.\n\nCreated: ${created}\nUpdated: ${updated}\nSkipped: ${skipped}\nTotal processed: ${parsed.length}`
    );
  } catch (error) {
    console.error(error);
    setResult(`Import failed:\n\n${error.message}`);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!window.location.pathname.includes("/admin/import.html")) return;

  if (!user) {
    window.location.href = "login.html";
  }
});

loadFileButton?.addEventListener("click", loadFileIntoTextbox);
validateJsonButton?.addEventListener("click", validateJsonOnly);
importJsonButton?.addEventListener("click", importJson);