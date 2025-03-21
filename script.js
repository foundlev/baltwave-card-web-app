let selectedAmount = null;
let currentTab = 'trips';

// Инициализация
function init() {
    const savedCard = getCard();
    if(savedCard) {
        document.getElementById('cardNumber').value = savedCard;
        fetchCardData(savedCard);
        toggleEditButton(true);
    }
}

// Переключение вкладок
function switchTab(tab) {
    if(tab === currentTab) return;

    document.querySelectorAll('.tab').forEach(t =>
        t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.history-list').forEach(list =>
        list.classList.remove('active'));
    document.getElementById(`${tab}History`).classList.add('active');

    currentTab = tab;
}

// Работа с картой
function toggleEditButton(saved) {
    const btn = document.getElementById('editBtn');
    btn.innerHTML = saved ?
        '<i class="fas fa-pencil-alt"></i>' :
        '<i class="fas fa-check"></i>';

    const input = document.getElementById('cardNumber');
    input.disabled = saved;
    if(!saved) input.focus();
}

function saveCard() {
    const cardNumber = document.getElementById('cardNumber').value;
    if(cardNumber.length < 8) return;

    setCard(cardNumber);
    toggleEditButton(true);
    fetchCardData(cardNumber, true);
}

// Обновление баланса
async function refreshBalance(force = false) {
    const cardNumber = getCard()
    if(!cardNumber) return;

    await fetchCardData(cardNumber, force);
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${hours}:${minutes} ${day}:${month}:${year}`;
}

// История
function renderHistory(items, containerId, isTrip) {
    const container = document.getElementById(containerId);
    container.innerHTML = items.length ? items.map(item => `
        <div class="history-item">
            <div class="history-item-icon">
                <i class="fas ${isTrip ? 'fa-bus' : 'fa-wallet'}"></i>
            </div>
            <div class="history-item-content">
                <div class="history-item-title">
                    ${isTrip ? item.vehicleTypeName + ' ' + item.routeNumber : item.orderTypeFriendlyName}
                </div>
                <div class="history-item-details">
                    <span>${formatDate(item.dateTrip || item.datePurchase)}</span>
                    ${isTrip ? `<!--<span>${item.vehicleGovNumber}</span>-->` : ''}
                </div>
            </div>
            <div class="history-item-amount" style="color: ${isTrip ? 'var(--text)' : 'var(--success)'}">
                ${isTrip ? '-' : '+'}${((item.totalAmountCent || item.amountCent) / 100).toFixed(0)} ₽
            </div>
        </div>
    `).join('') : `<div class="history-item">Нет данных</div>`;
}

// Модальное окно
function showTopUpModal() {
    document.getElementById('topUpModal').style.display = 'flex';
}

async function processPayment() {
    const amount = selectedAmount || document.getElementById('customAmount').value * 100;
    if (!amount || amount < 5000) {
        alert('Минимальная сумма 50 ₽!');
        return;
    }

    const response = await fetch('https://beneficiary-kd-api.icom24.ru/api/order/prepare/balance', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Sec-Fetch-Site': 'cross-site',
            'Accept-Language': 'ru',
            'Sec-Fetch-Mode': 'cors',
            'Origin': 'https://oplata.volna39.ru',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0.1 Safari/605.1.15',
            'Referer': 'https://oplata.volna39.ru/',
            'Sec-Fetch-Dest': 'empty',
            'Priority': 'u=3, i',
        },
        body: JSON.stringify({
            cardId: getCardId(),
            amountCent: amount
        })
    });

    const paymentData = await response.json();
    showPaymentModal(paymentData, amount);
    closeModal();
}

function showPaymentModal(paymentData, amountValue) {
    const modal = document.getElementById('paymentModal');
    const payButton = document.getElementById('payButton');
    const timerElement = document.getElementById('paymentTimer');

    // Устанавливаем данные оплаты
    document.getElementById('paymentAmount').textContent = `${Math.floor(amountValue / 100)} ₽`;

    // Таймер обратного отсчета
    let timeLeft = paymentData.ttlMinutes * 60;
    const timer = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(timer);
            modal.style.display = 'none';
        }
    }, 1000);

    // Обработчик для кнопки оплаты
    payButton.onclick = () => {
        window.open(paymentData.url, '_blank');
        clearInterval(timer);
        modal.style.display = 'none';
    };

    // Показываем модальное окно
    modal.style.display = 'flex';

    // Закрытие модального окна при клике вне его
    modal.onclick = (e) => {
        if (e.target === modal) {
            clearInterval(timer);
            modal.style.display = 'none';
        }
    };
}

function closeModal() {
    document.getElementById('topUpModal').style.display = 'none';
    selectedAmount = null;
    document.getElementById('customAmount').value = '';
    document.querySelectorAll('.amount-option').forEach(opt =>
        opt.classList.remove('selected'));
}

function setCard(card) {
    localStorage.setItem('transportCard', card);
}

function getCard() {
    return localStorage.getItem('transportCard');
}

function setCardId(cardId) {
    localStorage.setItem('cardId', cardId);
}

function getCardId() {
    return localStorage.getItem('cardId');
}

// API взаимодействие
async function fetchCardData(cardNumber, force = false) {
    // try {
    document.getElementById('balanceAmount').textContent = 'Загрузка...'

    let cardData = JSON.parse(localStorage.getItem('cardData') || '{}');
    const lastUpdate = cardData.lastUpdate;

    if (lastUpdate && !force) {
        const diff = Date.now() - lastUpdate;
        if (diff < 1000 * 60 * 60 * 24) {
            document.getElementById('balanceAmount').textContent = (cardData.data.balanceAmountCent / 100).toFixed(2) + ' ₽';

            renderHistory(cardData.data.tripHistory, 'tripsHistory', true);
            renderHistory(cardData.data.orderHistory, 'operationsHistory', false);
            return;
        }
    }

    // Сформируй тело запроса
    const payload = JSON.stringify({ cardNumber: cardNumber });

    // Замени существующий fetch на следующий вариант:
    const response = await fetch('https://beneficiary-kd-api.icom24.ru/api/card/check', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Sec-Fetch-Site': 'cross-site',
            'Accept-Language': 'ru',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Mode': 'cors',
            'Origin': 'https://oplata.volna39.ru',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0.1 Safari/605.1.15',
            'Referer': 'https://oplata.volna39.ru/',
            'Content-Length': '29',
            'Sec-Fetch-Dest': 'empty',
            'Priority': 'u=3, i'
        },
        body: payload
    });

    let data = await response.json();
    currentCard = data;

    document.getElementById('balanceAmount').textContent =
        (data.balanceAmountCent / 100).toFixed(2) + ' ₽';

    cardData = {
        data: data,
        lastUpdate: Date.now()
    }
    localStorage.setItem('cardData', JSON.stringify(cardData));

    renderHistory(data.tripHistory, 'tripsHistory', true);
    renderHistory(data.orderHistory, 'operationsHistory', false);
    setCardId(data.cardId);

    return data;
    // } catch(error) {
    //     alert('Ошибка обновления: ' + error.message);
    // }
}

// Обработчики событий
document.getElementById('editBtn').addEventListener('click', () => {
    const input = document.getElementById('cardNumber');
    if(input.disabled) {
        toggleEditButton(false);
    } else {
        saveCard();
    }
});

document.querySelector('.modal').addEventListener('click', e => {
    if(e.target === document.querySelector('.modal')) closeModal();
});

function selectAmount(amount) {
    const customAmount = document.getElementById('customAmount');
    selectedAmount = amount;
    customAmount.value = amount / 100;
    customAmount.focus();

    document.querySelectorAll('.amount-option').forEach((opt) =>
        opt.classList.toggle('selected', opt.dataset.amount === amount)
    );
}

document.getElementById("BalanceHeader").addEventListener("click", async () => {
    await refreshBalance(true);
});

// Запуск приложения
init();