emailjs.init('jEPsmc03XiqQMqiy5');

function getBasket() {
    return JSON.parse(localStorage.getItem('basket') || '{}');
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

function calculateRentalDays(fromDate, toDate) {
    if (!fromDate || !toDate) return 1;

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 1;
    }

    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

    const diffMs = endUtc - startUtc;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

    return diffDays >= 1 ? diffDays : 1;
}

function calculateLineTotal(quantity, unitPrice, rentalDays) {
    if (unitPrice === null || unitPrice === undefined || unitPrice === '' || Number.isNaN(Number(unitPrice))) {
        return null;
    }
    return Number(quantity) * Number(unitPrice) * Number(rentalDays);
}

document.getElementById('contact-form').addEventListener('submit', function(event) {
    event.preventDefault();

    let from_name = document.getElementById('name').value;
    let from_email = document.getElementById('email').value;
    let from_date = document.getElementById('from_date').value;
    let to_date = document.getElementById('to_date').value;
    let message = document.getElementById('message').value;

    const rentalDays = calculateRentalDays(from_date, to_date);
    let basket = getBasket();
    let basketContent = '';
    let grandTotal = 0;
    let hasNumericTotal = false;

    for (let item in basket) {
        if (basket.hasOwnProperty(item)) {
            const entry = normalizeBasketEntry(basket[item]);
            const lineTotal = calculateLineTotal(entry.quantity, entry.unitPrice, rentalDays);

            if (lineTotal !== null) {
                grandTotal += lineTotal;
                hasNumericTotal = true;
            }

            basketContent += `${item}
Quantity: ${entry.quantity}
Unit price: ${formatPrice(entry.unitPrice)}
Rental days: ${rentalDays}
Full price: ${lineTotal === null ? 'Price on request' : `${lineTotal} NOK`}

`;
        }
    }

    if (basketContent === '') {
        basketContent = 'Basket is empty.';
    } else {
        basketContent += `Grand total: ${hasNumericTotal ? `${grandTotal} NOK` : 'Price on request'}`;
    }

    let templateParams = {
        from_name: from_name,
        from_email: from_email,
        from_date: from_date,
        to_date: to_date,
        message: message,
        basket_items: basketContent
    };

    emailjs.send('service_2gyl3vr', 'template_ijqjjne', templateParams)
        .then(function() {
            alert('Your inquiry has been sent successfully!');
            document.getElementById('contact-form').reset();
        }, function(error) {
            alert('There was an error sending your inquiry. Please try again later.');
            console.error('EmailJS Error:', error);
        });
});