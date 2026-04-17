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

function formatLineTotal(quantity, unitPrice) {
    if (unitPrice === null || unitPrice === undefined || unitPrice === '' || Number.isNaN(Number(unitPrice))) {
        return 'Price on request';
    }
    return `${Number(quantity) * Number(unitPrice)} NOK`;
}

document.getElementById('contact-form').addEventListener('submit', function(event) {
    event.preventDefault();

    let from_name = document.getElementById('name').value;
    let from_email = document.getElementById('email').value;
    let from_date = document.getElementById('from_date').value;
    let to_date = document.getElementById('to_date').value;
    let message = document.getElementById('message').value;

    let basket = getBasket();
    let basketContent = '';

    for (let item in basket) {
        if (basket.hasOwnProperty(item)) {
            const entry = normalizeBasketEntry(basket[item]);
            basketContent += `${item}: ${entry.quantity} unit(s) | Unit price: ${formatPrice(entry.unitPrice)} | Full price: ${formatLineTotal(entry.quantity, entry.unitPrice)}\n`;
        }
    }

    if (basketContent === '') {
        basketContent = 'Basket is empty.';
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