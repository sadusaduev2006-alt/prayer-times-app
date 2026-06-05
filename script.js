// script.js - С API, рабочий компас для iPhone
let currentPrayerTimes = null;
let countdownInterval = null;
let deviceOrientationListener = null;
let currentQiblaAngle = 198;

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
const citiesData = {
    makhachkala: { lat: 42.9833, lng: 47.4833, name: "Махачкала", qibla: 198 },
    derbent: { lat: 42.0678, lng: 48.2978, name: "Дербент", qibla: 196 },
    vachi: { lat: 42.0667, lng: 47.2167, name: "Вачи", qibla: 197 },
    buynaksk: { lat: 42.8167, lng: 47.1167, name: "Буйнакск", qibla: 197 },
    khasavyurt: { lat: 43.2500, lng: 46.5833, name: "Хасавюрт", qibla: 198 },
    kizilyurt: { lat: 43.2000, lng: 46.8667, name: "Кизилюрт", qibla: 197 },
    izberbash: { lat: 42.5667, lng: 47.8667, name: "Избербаш", qibla: 197 },
    kaspiysk: { lat: 42.8833, lng: 47.6333, name: "Каспийск", qibla: 198 },
    moscow: { lat: 55.7558, lng: 37.6173, name: "Москва", qibla: 158 },
    kazan: { lat: 55.7887, lng: 49.1221, name: "Казань", qibla: 168 },
    ufa: { lat: 54.7355, lng: 55.9919, name: "Уфа", qibla: 173 },
    grozny: { lat: 43.3179, lng: 45.6987, name: "Грозный", qibla: 194 },
    ekaterinburg: { lat: 56.8389, lng: 60.6057, name: "Екатеринбург", qibla: 175 },
    novosibirsk: { lat: 55.0084, lng: 82.9357, name: "Новосибирск", qibla: 182 }
};

// Fallback данные (если нет интернета)
const fallbackTimes = {
    makhachkala: { Fajr: "02:15", Sunrise: "04:30", Dhuhr: "11:55", Asr: "15:55", Maghrib: "19:20", Isha: "21:30" },
    derbent: { Fajr: "02:20", Sunrise: "04:35", Dhuhr: "12:00", Asr: "16:00", Maghrib: "19:25", Isha: "21:35" },
    grozny: { Fajr: "02:25", Sunrise: "04:40", Dhuhr: "12:05", Asr: "16:05", Maghrib: "19:30", Isha: "21:40" },
    moscow: { Fajr: "02:00", Sunrise: "04:15", Dhuhr: "12:30", Asr: "16:30", Maghrib: "20:15", Isha: "22:30" }
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadPrayerTimes();
    loadDates();
    
    document.getElementById('city').addEventListener('change', () => {
        loadPrayerTimes();
    });
    
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadPrayerTimes(true);
    });
    
    // Модальное окно компаса
    const qiblaBtn = document.getElementById('qiblaBtn');
    const modal = document.getElementById('qiblaModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const startCompassBtn = document.getElementById('startCompassBtn');
    
    qiblaBtn.addEventListener('click', () => {
        modal.classList.add('active');
        updateQiblaAngleDisplay();
        updateCompassStatus();
    });
    
    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        stopCompass();
    });
    
    startCompassBtn.addEventListener('click', () => {
        startCompass();
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
    const city = citiesData[cityId];
    if (!city) return null;
    
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    const cacheKey = `prayer_times_${cityId}_${dateStr}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!forceRefresh && cached) {
        try {
            const data = JSON.parse(cached);
            const cacheDate = new Date(data.cachedAt);
            const hoursSinceCache = (new Date() - cacheDate) / (1000 * 60 * 60);
            if (hoursSinceCache < 24) {
                console.log("Используем кэш для", cityId);
                updateDataSource("aladhan.com (кэш)");
                return data.times;
            }
        } catch(e) {}
    }
    
    try {
        // API aladhan.com - метод 3 для России
        const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${city.lat}&longitude=${city.lng}&method=3&school=1`;
        
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
                    Isha: timings.Isha.substring(0, 5)
                };
                
                localStorage.setItem(cacheKey, JSON.stringify({
                    times: result,
                    cachedAt: new Date().toISOString()
                }));
                
                updateDataSource("aladhan.com (актуальное)");
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

// Основная функция загрузки времени
async function loadPrayerTimes(forceRefresh = false) {
    const cityId = document.getElementById('city').value;
    
    showLoading();
    
    let apiTimes = await fetchPrayerTimesFromAPI(cityId, forceRefresh);
    
    if (apiTimes) {
        currentPrayerTimes = apiTimes;
    } else {
        if (fallbackTimes[cityId]) {
            currentPrayerTimes = fallbackTimes[cityId];
        } else {
            currentPrayerTimes = fallbackTimes.makhachkala;
        }
    }
    
    updatePrayerTimesUI(currentPrayerTimes);
    updateNextPrayer();
    updateLastUpdated();
    
    const now = new Date();
    document.getElementById('gregorianDate').textContent = now.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
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
                    time: currentPrayerTimes[prayer.key]
                };
            }
        }
    }
    
    return {
        ...prayers[0],
        time: currentPrayerTimes.Fajr
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

// ========== КОМПАС ДЛЯ IPHONE ==========

function updateQiblaAngleDisplay() {
    const cityId = document.getElementById('city').value;
    currentQiblaAngle = citiesData[cityId]?.qibla || 198;
    document.getElementById('qiblaAngle').textContent = `${currentQiblaAngle}°`;
}

function updateCompassStatus() {
    const statusDiv = document.getElementById('compassStatus');
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        statusDiv.innerHTML = '📱 Для работы компаса нажмите кнопку ниже и разрешите доступ';
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
        statusDiv.innerHTML = '🟢 Компас готов. Нажмите "Запустить компас"';
    } else {
        statusDiv.innerHTML = '❌ Компас не поддерживается вашим устройством';
    }
}

function startCompass() {
    const statusDiv = document.getElementById('compassStatus');
    const startBtn = document.getElementById('startCompassBtn');
    
    const handleOrientation = (event) => {
        let alpha = event.alpha;
        if (alpha !== null && alpha !== undefined) {
            // Стрелка компаса (указывает на север)
            const needle = document.getElementById('compassNeedle');
            if (needle) {
                needle.style.transform = `translate(-50%, -50%) rotate(${-alpha}deg)`;
            }
            
            // Стрелка Киблы (указывает на Мекку)
            let qiblaDirection = (currentQiblaAngle - alpha + 360) % 360;
            const qiblaArrow = document.getElementById('qiblaArrow');
            if (qiblaArrow) {
                qiblaArrow.style.transform = `rotate(${qiblaDirection}deg)`;
                qiblaArrow.style.transition = 'transform 0.1s ease-out';
            }
            
            statusDiv.innerHTML = '🧭 Компас работает | Поворачивайте телефон';
            startBtn.style.display = 'none';
        }
    };
    
    // Для iOS - запрос разрешения
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    if (deviceOrientationListener) {
                        window.removeEventListener('deviceorientation', deviceOrientationListener);
                    }
                    window.addEventListener('deviceorientation', handleOrientation);
                    deviceOrientationListener = handleOrientation;
                    statusDiv.innerHTML = '✅ Компас активирован! Поворачивайте телефон';
                    startBtn.style.display = 'none';
                } else {
                    statusDiv.innerHTML = '❌ Доступ запрещён. Разрешите в настройках Safari → Конфиденциальность → Движение и ориентация';
                }
            })
            .catch(error => {
                console.error(error);
                statusDiv.innerHTML = '❌ Ошибка доступа. Проверьте настройки конфиденциальности';
            });
    } 
    // Для Android и других
    else if (typeof DeviceOrientationEvent !== 'undefined') {
        if (deviceOrientationListener) {
            window.removeEventListener('deviceorientation', deviceOrientationListener);
        }
        window.addEventListener('deviceorientation', handleOrientation);
        deviceOrientationListener = handleOrientation;
        statusDiv.innerHTML = '✅ Компас запущен!';
        startBtn.style.display = 'none';
    } 
    else {
        statusDiv.innerHTML = '❌ Компас не поддерживается';
    }
}

function stopCompass() {
    if (deviceOrientationListener) {
        window.removeEventListener('deviceorientation', deviceOrientationListener);
        deviceOrientationListener = null;
    }
    const startBtn = document.getElementById('startCompassBtn');
    if (startBtn) startBtn.style.display = 'block';
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
