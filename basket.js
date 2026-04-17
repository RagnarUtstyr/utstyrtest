function getBasket() {
    return JSON.parse(localStorage.getItem('basket') || '{}');
}

function saveBasket(basket) {
    localStorage.setItem('basket', JSON.stringify(basket));
}

function normalizeBasketEntry(entry) {
    if (typeof entry === 'number') {
        return {
            quantity: entry,
            unitPrice: null
        };
    }

    return {
        quantity: Number(entry?.quantity || 0),
        unitPrice:
            entry?.unitPrice === undefined || entry?.unitPrice === null || entry?.unitPrice === ''
                ? null
                : Number(entry.unitPrice)
    };
}

function formatPrice(value) {
    if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
        return 'Price on request';
    }
    return `${Number(value)} NOK`;
}

function escapeForSingleQuotedJsString(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

// Add item to basket using LocalStorage and enforce maxQuantity
function addToBasket(itemName, maxQuantity, unitPrice = null) {
    let basket = getBasket();
    const existing = normalizeBasketEntry(basket[itemName] || 0);

    if (!basket[itemName]) {
        basket[itemName] = {
            quantity: 1,
            unitPrice: unitPrice === null || unitPrice === undefined || unitPrice === '' ? null : Number(unitPrice)
        };
    } else {
        if (existing.quantity < maxQuantity) {
            basket[itemName] = {
                quantity: existing.quantity + 1,
                unitPrice:
                    unitPrice === null || unitPrice === undefined || unitPrice === ''
                        ? existing.unitPrice
                        : Number(unitPrice)
            };
        } else {
            return;
        }
    }

    saveBasket(basket);
    updateBasketIcon();
    updateBasketPage();
}

// Remove item from the basket
function removeFromBasket(itemName) {
    let basket = getBasket();

    if (basket[itemName]) {
        delete basket[itemName];
    }

    saveBasket(basket);
    updateBasketIcon();
    updateBasketPage();
}

// Empty the entire basket
function emptyCart() {
    saveBasket({});
    updateBasketIcon();
    updateBasketPage();
}

// Update the basket icon with the total item count
function updateBasketIcon() {
    let basket = getBasket();
    let totalItems = 0;

    for (let item in basket) {
        if (basket.hasOwnProperty(item)) {
            const entry = normalizeBasketEntry(basket[item]);
            totalItems += entry.quantity;
        }
    }

    let basketIconCount = document.getElementById('basket-icon-count');
    if (basketIconCount) {
        basketIconCount.textContent = totalItems;
    }
}

// Update the basket page display with quantity controls
function updateBasketPage() {
    let basket = getBasket();
    let basketItems = document.getElementById('basket-items');
    let basketTotal = document.getElementById('basket-total');

    if (!basketItems) return;

    basketItems.innerHTML = '';

    const itemNames = Object.keys(basket);

    if (itemNames.length === 0) {
        basketItems.innerHTML = '<li><div class="basket-item-content"><span class="item-name">Your basket is empty.</span></div></li>';
        if (basketTotal) {
            basketTotal.textContent = '0';
        }
        return;
    }

    itemNames.forEach((item) => {
        const entry = normalizeBasketEntry(basket[item]);
        const safeItem = escapeForSingleQuotedJsString(item);

        let li = document.createElement('li');
        li.innerHTML = `
            <div class="basket-item-content">
                <span class="item-name">${item}</span>
                <div class="quantity-controls">
                    <button class="decrease" onclick="changeQuantity('${safeItem}', ${entry.quantity - 1})">-</button>
                    <input
                        type="number"
                        class="quantity-input"
                        value="${entry.quantity}"
                        min="1"
                        onchange="changeQuantity('${safeItem}', this.value)"
                    >
                    <button class="increase" onclick="changeQuantity('${safeItem}', ${entry.quantity + 1})">+</button>
                    <button class="remove" onclick="removeFromBasket('${safeItem}')" aria-label="Remove ${item}">
                        <img src="images/bin.png" alt="Remove">
                    </button>
                </div>
            </div>
        `;
        basketItems.appendChild(li);
    });

    let totalItems = Object.values(basket).reduce((sum, entry) => {
        return sum + normalizeBasketEntry(entry).quantity;
    }, 0);

    if (basketTotal) {
        basketTotal.textContent = totalItems;
    }
}

// Change quantity based on user input
function changeQuantity(itemName, newQuantity) {
    let basket = getBasket();
    const existing = normalizeBasketEntry(basket[itemName]);
    let quantity = parseInt(newQuantity, 10);

    if (isNaN(quantity) || quantity < 1) {
        quantity = 1;
    }

    basket[itemName] = {
        quantity,
        unitPrice: existing.unitPrice
    };

    saveBasket(basket);
    updateBasketIcon();
    updateBasketPage();
}

// Generate and download the basket contents as a PDF file
function downloadBasket() {
    let basket = getBasket();

    if (Object.keys(basket).length === 0) {
        alert("Your basket is empty.");
        return;
    }

    let basketContent = `
        <div style="font-family: 'Poppins', sans-serif; color: white; background-color: #333; padding: 20px; border-radius: 10px;">
            <h1 style="color: #ffcc00; text-align: center;">Your Basket Inquiry</h1>
            <ul style="list-style-type: none; padding: 0; font-size: 16px; background-color: #333;">`;

    for (let item in basket) {
        if (basket.hasOwnProperty(item)) {
            const entry = normalizeBasketEntry(basket[item]);
            basketContent += `
                <li style="display: grid; grid-template-columns: 1.6fr 0.7fr 1fr; gap: 10px; padding: 10px 0; border-bottom: 1px solid #ffcc00; align-items: center;">
                    <span style="text-align: left;">${item}</span>
                    <span style="text-align: center;">${entry.quantity} unit(s)</span>
                    <span style="text-align: right;">${formatPrice(entry.unitPrice)}</span>
                </li>`;
        }
    }

    basketContent += `</ul></div>`;

    let pdfContainer = document.createElement('div');
    pdfContainer.innerHTML = basketContent;

    html2pdf(pdfContainer, {
        margin: 0,
        filename: 'basket_inquiry.pdf',
        html2canvas: { scale: 2, backgroundColor: "#333" },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('basket-icon-count')) {
        updateBasketIcon();
    }

    if (document.getElementById('basket-items')) {
        updateBasketPage();
    }

    let submitButton = document.getElementById('submit-inquiry');
    if (submitButton) {
        submitButton.addEventListener('click', downloadBasket);
    }

    let emptyCartButton = document.getElementById('empty-cart');
    if (emptyCartButton) {
        emptyCartButton.addEventListener('click', emptyCart);
    }
});