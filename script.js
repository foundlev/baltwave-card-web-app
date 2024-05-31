document.addEventListener('DOMContentLoaded', () => {
    // Determine startMode based on localStorage
    const accessToken = localStorage.getItem('access-token');
    const refreshToken = localStorage.getItem('refresh-token');
    const cardNumber = localStorage.getItem('card-number');
    const expiresIn = localStorage.getItem('expires-in');
    const proxyPassword = localStorage.getItem('proxy-password');
    const startMode = (accessToken && refreshToken && cardNumber && proxyPassword) ? 1 : 0;

    document.getElementById('proxy-password').value = proxyPassword;
    document.getElementById('access-token').value = accessToken;
    document.getElementById('refresh-token').value = refreshToken;

    const resetButton = document.getElementById('reset');
    const refreshButton = document.getElementById('refresh');
    const balanceContainer = document.getElementById('balance-container');
    const topUpButton = document.getElementById('top-up');
    const amountInput = document.getElementById('amount');
    const balanceAmount = document.getElementById('balance-amount');
    const amountButtons = document.querySelectorAll('.amount-btn');
    const mainContent = document.getElementById('main-content');
    const setupContent = document.getElementById('setup-content');
    const setDataButton = document.getElementById('set-data');
    const proxyPasswordInput = document.getElementById('proxy-password');
    const accessTokenInput = document.getElementById('access-token');
    const refreshTokenInput = document.getElementById('refresh-token');
    const cardNumberInput = document.getElementById('card-number');
    const cardElement = document.querySelector('.card');

    const proxyServerUrl = "https://myapihelper.na4u.ru/proxy.php"

    // Handle mode switching
    if (startMode === 0) {
        mainContent.classList.add('hidden');
        setupContent.classList.remove('hidden');
        resetButton.classList.add('hidden');
        setDataButton.style.display = 'flex';
    } else {
        mainContent.classList.remove('hidden');
        setupContent.classList.add('hidden');
        resetButton.classList.remove('hidden');
        setDataButton.style.display = 'none';
    }

    // Validate amount input and enable/disable top-up button
    amountInput.addEventListener('input', () => {
        const amount = parseInt(amountInput.value, 10);

        // Restrict input to a maximum of 4 characters
        if (amountInput.value.length > 4) {
            amountInput.value = amountInput.value.slice(0, 4);
        }

        // Validate amount
        if (amount >= 10 && amount <= 9999) {
            topUpButton.disabled = false;
            topUpButton.style.background = '#4C4DDC';
            topUpButton.style.cursor = 'pointer';
        } else {
            topUpButton.disabled = true;
            topUpButton.style.background = '#ccc';
            topUpButton.style.cursor = 'not-allowed';
        }
    });

    // Initial validation on page load
    const initialAmount = parseInt(amountInput.value, 10);
    if (initialAmount < 10 || initialAmount > 9999) {
        topUpButton.disabled = true;
        topUpButton.style.background = '#ccc';
        topUpButton.style.cursor = 'not-allowed';
    } else {
        topUpButton.disabled = false;
        topUpButton.style.background = '#4C4DDC';
        topUpButton.style.cursor = 'pointer';
    }

    resetButton.addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите сбросить данные?')) {
            // Erase data from localStorage
            localStorage.removeItem('card-number');
            localStorage.removeItem('expires-in');
            localStorage.removeItem('last-balance');
            localStorage.removeItem('last-balance-update');
            // Reload the page
            location.reload();
        }
    });

    async function checkProxyPassword(proxyPassword) {
        const proxyUrl = proxyServerUrl + "?proxypassword=" + proxyPassword;

        try {
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    // Function to update tokens
    async function updateTokens(accessToken, refreshToken) {
        const payload = {
            "access-token": accessToken,
            "refresh-token": refreshToken
        };
        let currentProxyPassword;
        if (proxyPassword) {
            currentProxyPassword = proxyPassword;
        } else {
            currentProxyPassword = localStorage.getItem('proxy-password');
        }

        const proxyUrl = proxyServerUrl + '?url=https://transport.nko-rr.ru/api/v1/user/refresh_user_token/&proxypassword=' + currentProxyPassword;

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                const newAccessToken = result["access-token"];
                const newRefreshToken = result["refresh-token"];
                const expiresIn = parseInt(result["expires_in"] + Date.now() / 1000);

                if (newAccessToken && newRefreshToken && expiresIn) {
                    if (newAccessToken !== undefined && newRefreshToken !== undefined) {
                        localStorage.setItem('access-token', newAccessToken);
                        localStorage.setItem('refresh-token', newRefreshToken);
                        localStorage.setItem('expires-in', expiresIn);
                    }
                }

                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    function getTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    // Function to get balance
    async function getBalance() {
        const currentAccessToken = localStorage.getItem('access-token');
        const currentCardNumber = localStorage.getItem('card-number');
        const proxyUrl = proxyServerUrl + "?url=https://transport.nko-rr.ru/api/v1/wallet/get_data/&proxypassword=" + proxyPassword;

        const headers = {
            "Content-Type": "application/json",
            "Access-Token": currentAccessToken
        };

        const payload = {
            "project_id": 77,
            "surrogate_name": currentCardNumber
        };

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.balance) {
                return result.balance;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    async function refreshBalance() {
        // Show loading state
        balanceAmount.textContent = '...₽';
        refreshButton.classList.add('rotating');

        const expired = getTimestamp() > parseInt(localStorage.getItem('expires-in'));
        let balance;

        if (expired) {
            const success = await updateTokens(localStorage.getItem('access-token'), localStorage.getItem('refresh-token'));

            if (success) {
                balance = await getBalance();
            }
        } else {
            balance = await getBalance();

            if (!balance) {
                const success = await updateTokens(localStorage.getItem('access-token'), localStorage.getItem('refresh-token'));

                if (success) {
                    balance = await getBalance();
                }
            }
        }

        if (balance !== false) {
            balanceAmount.textContent = balance + '₽';
            localStorage.setItem('last-balance-update', getTimestamp());
            localStorage.setItem('last-balance', balance);
        } else if (balance === false && !expired) {
            balanceAmount.textContent = 'Ошибка';
            alert('Не удалось обновить баланс. Проверьте пароль для прокси или привязана ли карта.');
        }

        // Ensure the rotation completes before removing the class
        setTimeout(() => {
            refreshButton.classList.remove('rotating');
        }, 1000);
    }

//    refreshButton.addEventListener('click', refreshBalance);
    balanceContainer.addEventListener('click', refreshBalance);

    topUpButton.addEventListener('click', async () => {
        // Change button text to "..."
        const originalText = topUpButton.innerHTML;
        topUpButton.innerHTML = '...';

        // Get the amount and card number
        const amount = amountInput.value;
        const cardNumber = localStorage.getItem('card-number');

        // Prepare the data for the POST request
        const data = {
            credit_amount: amount,
            wallet_surrogate: cardNumber
        };

        const proxyUrl = proxyServerUrl + "?url=https://transport.nko-rr.ru/api/v1/operations/credit_acquiring/&proxypassword=" + proxyPassword;

        try {
            // Make the POST request through the proxy server
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            // Check the response
            if (result.code === 1000 && result.redirect_url) {
                // Open the redirect URL in a new window
                window.open(result.redirect_url, '_self');
            } else {
                // Show an alert message
                alert('Не удалось создать ссылку на оплату. Проверьте пароль для прокси.');
            }
        } catch (error) {
            // Show an alert message
            alert('Не удалось создать ссылку на оплату. Проверьте пароль для прокси.');
        } finally {
            // Restore the original button text
            topUpButton.innerHTML = originalText;
        }
    });

    amountButtons.forEach(button => {
        button.addEventListener('click', () => {
            amountInput.value = button.textContent.replace('₽', '');
            const amount = parseInt(amountInput.value, 10);

            // Validate amount
            if (amount >= 10 && amount <= 9999) {
                topUpButton.disabled = false;
                topUpButton.style.background = '#4C4DDC';
                topUpButton.style.cursor = 'pointer';
            } else {
                topUpButton.disabled = true;
                topUpButton.style.background = '#ccc';
                topUpButton.style.cursor = 'not-allowed';
            }
        });
    });

    // Function to validate all input fields in the setup content
    const validateSetupInputs = () => {
        const isProxyPasswordValid = proxyPasswordInput.value.trim().length > 0;
        const isCardNumberValid = /^\d{12}$/.test(cardNumberInput.value);
        const isAccessTokenValid = accessTokenInput.value.trim().length > 120;
        const isRefreshTokenValid = refreshTokenInput.value.trim().length > 120;

        if (isProxyPasswordValid && isCardNumberValid && isAccessTokenValid && isRefreshTokenValid) {
            setDataButton.disabled = false;
            setDataButton.style.background = '#4C4DDC';
            setDataButton.style.cursor = 'pointer';
        } else {
            setDataButton.disabled = true;
            setDataButton.style.background = '#ccc';
            setDataButton.style.cursor = 'not-allowed';
        }
    };

    // Validate setup inputs on load
    validateSetupInputs();

    // Add event listeners to setup input fields for validation
    [proxyPasswordInput, accessTokenInput, refreshTokenInput, cardNumberInput].forEach(input => {
        input.addEventListener('input', validateSetupInputs);
    });

    // Restrict card number input to digits only
    cardNumberInput.addEventListener('keypress', (e) => {
        if (!/\d/.test(e.key)) {
            e.preventDefault();
        }
    });

    // Store input data in localStorage and update tokens when "Set data" button is clicked
    setDataButton.addEventListener('click', async () => {
        setDataButton.textContent = "...";
        const proxyPassword = proxyPasswordInput.value;
        const accessToken = accessTokenInput.value;
        const refreshToken = refreshTokenInput.value;

        const proxyPasswordSuccess = await checkProxyPassword(proxyPassword);
        if (proxyPasswordSuccess) {
            localStorage.setItem('proxy-password', proxyPassword);
            const success = await updateTokens(accessToken, refreshToken);

            setDataButton.textContent = "Установить данные";
            if (success) {
                localStorage.setItem('card-number', cardNumberInput.value);
                location.reload();
            } else {
                alert('Не удалось загрузить информацию. Проверьте токены.');
            }
        } else {
            setDataButton.textContent = "Установить данные";
            alert('Не удалось подключиться к серверу. Проверьте пароль для прокси.');
        }
    });

    // Copy card number to clipboard and alert when card is clicked
    cardElement.addEventListener('click', () => {
        const cardNumber = localStorage.getItem('card-number');
        if (cardNumber) {
            navigator.clipboard.writeText(cardNumber).then(() => {
                alert(`Номер карты: ${cardNumber}`);
            });
        } else {
            alert('Номер карты не найден.');
        }
    });

    // Perform balance refresh on page load
    if (startMode === 1) {
        const lastBalanceUpdate = parseInt(localStorage.getItem('last-balance-update'), 10);
        const lastBalance = localStorage.getItem('last-balance');
        const oneHour = 3600;

        if (!lastBalance || !lastBalanceUpdate || (getTimestamp() - lastBalanceUpdate > oneHour)) {
            refreshBalance();
        } else {
            balanceAmount.textContent = lastBalance + '₽';
        }
    }
});
