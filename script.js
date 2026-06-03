// script.js - С ежедневным обновлением времени
let currentPrayerTimes = null;
let countdownInterval = null;
let compassWatchId = null;

// Конфигурация намазов
const prayers = [
    { name: 'Фаджр', key: 'Fajr', desc: 'Утренний' },
    { name: 'Шурук', key: 'Sunrise', desc: 'Восход' },
    { name: 'Зухр', key: 'Dhuhr', desc: 'Полуденный' },
    { name: 'Аср', key: 'Asr', desc: 'Послеполуденный (шафии)' },
    { name: 'Магриб', key: 'Maghrib', desc: 'Вечерний' },
    { name: 'Иша', key: 'Isha', desc: 'Ночной' }
];

// Координаты городов для API
const citiesCoordinates = {
    makhachkala: { lat: 42.9833, lng: 47.4833, name: "Махачкала" },
    derbent: { lat: 42.0678, lng: 48.2978, name: "Дербент" },
    vachi: { lat: 42.0667, lng: 47.2167, name: "Вачи" },
    buynaksk: { lat: 42.8167, lng: 47.1167, name: "Буйнакск" },
    khasavyurt: { lat: 43.2500, lng: 46.5833, name: "Хасавюрт" },
    kizilyurt: { lat: 43.2000, lng: 46.8667, name: "Кизилюрт" },
    izberbash: { lat: 42.5667, lng: 47.8667, name: "Избербаш" },
    kaspiysk: { lat: 42.8833, lng: 47.6333, name: "Каспийск" },
    moscow: { lat: 55.7558, lng: 37.6173, name: "Москва" },
    kazan: { lat: 55.7887, lng: 49.1221, name: "Казань" },
    ufa: { lat: 54.7355, lng: 55.9919, name: "Уфа" },
    grozny: { lat: 43.3179, lng: 45.6987, name: "Грозный" },
    ekaterinburg: { lat: 56.8389, lng: 60.6057, name: "Екатеринбург" },
    novosibirsk: { lat: 55.0084, lng: 82.9357, name: "Новосибирск" }
};

// Fallback данные (если нет интернета)
const fallbackTimes = {
    makhachkala: { Fajr: "02:15", Sunrise: "04:30", Dhuhr: "11:55", Asr: "15:55", Maghrib: "19:20", Isha: "21:30" },
    derbent: { Fajr: "02:20", Sunrise: "04:35", Dhuhr: "12:00", Asr: "16:00", Maghrib: "19:25", Isha: "21:35" },
    grozny: { Fajr: "02:25", Sunrise: "04:40", Dhuhr: "12:05", Asr: "16:05", Maghrib: "19:30", Isha: "21:40" },
    moscow: { Fajr: "02:00", Sunrise: "04:15", Dhuhr: "12:30", Asr: "16:30", Maghrib: "20:15", Isha: "22:30" }
};

// Углы Киблы для городов
const qiblaAngles = {
    makhachkala: 198, derbent: 196, vachi: 197, buynaksk: 197,
    khasavyurt: 198, kizilyurt: 197, izberbash: 197, kaspiysk: 198,
    moscow: 158, kazan: 168, ufa: 173, grozny: 194,
    ekaterinburg: 175, novosibirsk: 182
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadPrayerTimes();
    loadDates();
    
    document.getElementById('city').addEventListener('change', () => {
        loadPrayerTimes();
    });
    
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadPrayerTimes(true); // Принудительное обновление
    });
    
    // Модальное окно компаса
    const qiblaBtn = document.getElementById('qiblaBtn');
    const modal = document.getElementById('qiblaModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const startCompassBtn = document.getElementById('startCompassBtn');
    
    qiblaBtn.addEventListener('click', () => {
        modal.classList.add('active');
        initCompass();
    });
    
    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        stopCompass();
    });
    
    startCompassBtn.addEventListener('click', () => {
        initCompass();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            stopCompass();
        }
    });
});

// Получение времени намаза из API
async function fetchPrayerTimesFromAPI(cityId, forceRefresh = false) {
    const coords = citiesCoordinates[cityId];
    if (!coords) return null;
    
    // Получаем сегодняшнюю дату в формате DD-MM-YYYY
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    
    // Проверяем localStorage (кэш на сегодня)
    const cacheKey = `prayer_times_${cityId}_${dateStr}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!forceRefresh && cached) {
        try {
            const data = JSON.parse(cached);
            console.log("Используем кэш для", cityId);
            return data;
        } catch(e) {}
    }
    
    try {
        // Используем API aladhan.com (бесплатно, без ключа)
        // method=3 - для России и северных широт
        const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${coords.lat}&longitude=${coords.lng}&method=3&school=1`;
        
        console.log("Запрос к API:", url);
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.code === 200 && data.data) {
                const timings = data.data.timings;
                
                const result = {
                    Fajr: timings.Fajr.substring(0, 5),
                    Sunrise: timings.Sunrise.substring(0, 5),
                    Dhuhr: timings.Dhuhr.substring(0, 5),
                    Asr: timings.Asr.substring(0, 5),
                    Maghrib: timings.Maghrib.substring(0, 5),
                    Isha: timings.Isha.substring(0, 5),
                    date: data.data.date.readable
                };
                
                // Сохраняем в кэш
                localStorage.setItem(cacheKey, JSON.stringify(result));
                
                // Обновляем источник данных
                updateDataSource("aladhan.com (актуальное на сегодня)");
                
                return result;
            }
        }
        throw new Error("API не ответил");
    } catch (error) {
        console.error("Ошибка API:", error);
        updateDataSource("локальные данные (нет интернета)");
        return null;
    }
}

// Основная функция загрузки времени намаза
async function loadPrayerTimes(forceRefresh = false) {
    const cityId = document.getElementById('city').value;
    const cityName = document.getElementById('city').options[document.getElementById('city').selectedIndex].text;
    
    // Показываем загрузку
    showLoading();
    
    // Пробуем получить данные из API
    let apiTimes = await fetchPrayerTimesFromAPI(cityId, forceRefresh);
    
    if (apiTimes) {
        currentPrayerTimes = apiTimes;
    } else {
        // Fallback на локальные данные
        if (fallbackTimes[cityId]) {
            currentPrayerTimes = fallbackTimes[cityId];
            updateDataSource("локальные данные (офлайн режим)");
        } else {
            currentPrayerTimes = fallbackTimes.makhachkala;
            updateDataSource("локальные данные (по умолчанию)");
        }
    }
    
    updatePrayerTimesUI(currentPrayerTimes);
    updateNextPrayer();
    updateLastUpdated();
    
    // Обновляем дату в информации
    const today = new Date();
    document.getElementById('gregorianDate').textContent = today.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Обновление интерфейса
function updatePrayerTimesUI(times) {
    const prayerList = document.getElementById('prayerList');
    prayerList.innerHTML = '';
    
    prayers.forEach(prayer => {
        const time = times[prayer.key] || '--:--';
        const item = document.createElement('div');
        item.className = 'prayer-item';
        item.setAttribute('data-prayer', prayer.key.toLowerCase());
        item.innerHTML = `
            <div class="prayer-info">
                <span class="prayer-name">${prayer.name}</span>
                <span class="prayer-desc">${prayer.desc}</span>
            </div>
            <div class="prayer-time">${time}</div>
        `;
        prayerList.appendChild(item);
    });
}

// Определение следующего намаза
function getNextPrayer() {
    if (!currentPrayerTimes) return null;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const prayer of prayers) {
        if (currentPrayerTimes[prayer.key]) {
            const [hours, minutes] = currentPrayerTimes[prayer.key].split(':');
            const prayerMinutes = parseInt(hours) * 60 + parseInt(minutes);
            
            if (prayerMinutes > currentMinutes) {
                return {
                    ...prayer,
                    time: currentPrayerTimes[prayer.key],
                    minutes: prayerMinutes
                };
            }
        }
    }
    
    return {
        ...prayers[0],
        time: currentPrayerTimes.Fajr,
        minutes: null
    };
}

// Обновление следующего намаза
function updateNextPrayer() {
    const nextPrayer = getNextPrayer();
    
    if (nextPrayer) {
        document.getElementById('nextPrayerName').textContent = nextPrayer.name;
        document.getElementById('nextPrayerTime').textContent = nextPrayer.time;
        
        highlightActivePrayer(nextPrayer.key.toLowerCase());
        
        if (countdownInterval) clearInterval(countdownInterval);
        startCountdown(nextPrayer.time);
    }
}

// Запуск обратного отсчёта
function startCountdown(prayerTime) {
    function updateCountdown() {
        const now = new Date();
        const [hours, minutes] = prayerTime.split(':');
        const prayerDate = new Date();
        prayerDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        if (prayerDate < now) {
            prayerDate.setDate(prayerDate.getDate() + 1);
        }
        
        const diff = prayerDate - now;
        
        if (diff <= 0) {
            document.getElementById('countdown').textContent = '00:00:00';
            loadPrayerTimes();
            return;
        }
        
        const hoursRem = Math.floor(diff / (1000 * 60 * 60));
        const minutesRem = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secondsRem = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('countdown').textContent = 
            `${String(hoursRem).padStart(2, '0')}:${String(minutesRem).padStart(2, '0')}:${String(secondsRem).padStart(2, '0')}`;
    }
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

// Подсветка активного намаза
function highlightActivePrayer(activeKey) {
    const items = document.querySelectorAll('.prayer-item');
    items.forEach(item => {
        item.classList.remove('active');
        const prayerName = item.querySelector('.prayer-name').textContent;
        const activePrayer = prayers.find(p => p.key.toLowerCase() === activeKey);
        if (activePrayer && prayerName === activePrayer.name) {
            item.classList.add('active');
        }
    });
}

// Загрузка дат
function loadDates() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('gregorianDate').textContent = now.toLocaleDateString('ru-RU', options);
    document.getElementById('hijriDate').textContent = getHijriDate();
}

// Получение хиджра даты
function getHijriDate() {
    const hijriMonths = [
        'Мухаррам', 'Сафар', 'Раби-уль-авваль', 'Раби-уль-ахир',
        'Джумада-уль-уля', 'Джумада-уль-ахира', 'Раджаб', 'Шаабан',
        'Рамадан', 'Шавваль', 'Зуль-Каада', 'Зуль-Хиджа'
    ];
    
    const now = new Date();
    const gregorianYear = now.getFullYear();
    const hijriYear = gregorianYear - 622;
    const dayOfYear = Math.floor((now - new Date(gregorianYear, 0, 1)) / (1000 * 60 * 60 * 24));
    const month = Math.floor(dayOfYear / 29.5) % 12;
    const day = (dayOfYear % 29.5) + 1;
    
    return `${Math.floor(day)} ${hijriMonths[month]} ${hijriYear} г. Хиджры`;
}

// Вспомогательные функции
function updateDataSource(source) {
    const sourceElement = document.getElementById('dataSource');
    if (sourceElement) {
        sourceElement.textContent = source || 'ДУМД';
    }
}

function updateLastUpdated() {
    const now = new Date();
    const formatted = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('lastUpdated').textContent = `Обновлено: ${formatted}`;
}

function showLoading() {
    const prayerList = document.getElementById('prayerList');
    prayerList.innerHTML = '<div class="prayer-item"><div class="prayer-info">Загрузка актуального времени...</div></div>';
}

// Компас
function initCompass() {
    const city = document.getElementById('city').value;
    const qiblaAngle = qiblaAngles[city] || 198;
    document.getElementById('qiblaAngle').textContent = `${qiblaAngle}°`;
    
    if (!window.DeviceOrientationEvent) {
        document.getElementById('compassStatus').textContent = 'Компас не поддерживается';
        return;
    }
    
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        document.getElementById('compassStatus').textContent = 'Нажмите "Запустить компас"';
        document.getElementById('startCompassBtn').style.display = 'block';
    } else {
        startCompass(qiblaAngle);
    }
}

function startCompass(qiblaAngle) {
    if (compassWatchId) {
        window.removeEventListener('deviceorientation', compassWatchId);
    }
    
    const handleOrientation = (event) => {
        let alpha = event.alpha;
        if (alpha !== null) {
            const needle = document.getElementById('compassNeedle');
            if (needle) needle.style.transform = `translate(-50%, -50%) rotate(${-alpha}deg)`;
            
            const qiblaDirection = (qiblaAngle - alpha + 360) % 360;
            const qiblaArrow = document.getElementById('qiblaArrow');
            if (qiblaArrow) qiblaArrow.style.transform = `rotate(${qiblaDirection}deg)`;
            
            document.getElementById('compassStatus').textContent = 'Компас активен';
        }
    };
    
    window.addEventListener('deviceorientation', handleOrientation);
    compassWatchId = handleOrientation;
    
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            })
            .catch(console.error);
    }
}

function stopCompass() {
    if (compassWatchId) {
        window.removeEventListener('deviceorientation', compassWatchId);
        compassWatchId = null;
    }
}
