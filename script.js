// script.js - Полностью рабочая версия
let currentPrayerTimes = null;
let countdownInterval = null;
let deviceOrientationListener = null;

// Конфигурация намазов
const prayers = [
    { name: 'Фаджр', key: 'Fajr', desc: 'Утренний' },
    { name: 'Шурук', key: 'Sunrise', desc: 'Восход' },
    { name: 'Зухр', key: 'Dhuhr', desc: 'Полуденный' },
    { name: 'Аср', key: 'Asr', desc: 'Послеполуденный' },
    { name: 'Магриб', key: 'Maghrib', desc: 'Вечерний' },
    { name: 'Иша', key: 'Isha', desc: 'Ночной' }
];

// Данные городов
const citiesData = {
    makhachkala: { lat: 42.9833, lng: 47.4833, qibla: 198 },
    derbent: { lat: 42.0678, lng: 48.2978, qibla: 196 },
    vachi: { lat: 42.0667, lng: 47.2167, qibla: 197 },
    buynaksk: { lat: 42.8167, lng: 47.1167, qibla: 197 },
    khasavyurt: { lat: 43.2500, lng: 46.5833, qibla: 198 },
    kizilyurt: { lat: 43.2000, lng: 46.8667, qibla: 197 },
    izberbash: { lat: 42.5667, lng: 47.8667, qibla: 197 },
    kaspiysk: { lat: 42.8833, lng: 47.6333, qibla: 198 },
    moscow: { lat: 55.7558, lng: 37.6173, qibla: 158 },
    kazan: { lat: 55.7887, lng: 49.1221, qibla: 168 },
    ufa: { lat: 54.7355, lng: 55.9919, qibla: 173 },
    grozny: { lat: 43.3179, lng: 45.6987, qibla: 194 },
    ekaterinburg: { lat: 56.8389, lng: 60.6057, qibla: 175 },
    novosibirsk: { lat: 55.0084, lng: 82.9357, qibla: 182 }
};

// Резервные данные
const fallbackTimes = {
    Fajr: "04:30", Sunrise: "06:00", Dhuhr: "12:30", Asr: "16:00", Maghrib: "19:00", Isha: "20:30"
};

// Ждём загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log("Страница загружена");
    loadPrayerTimes();
    loadDates();
    
    document.getElementById('city').addEventListener('change', () => {
        loadPrayerTimes();
    });
    
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadPrayerTimes(true);
    });
    
    // Компас
    const qiblaBtn = document.getElementById('qiblaBtn');
    const modal = document.getElementById('qiblaModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const startCompassBtn = document.getElementById('startCompassBtn');
    
    qiblaBtn.addEventListener('click', () => {
        modal.classList.add('active');
        updateQiblaAngle();
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

// Загрузка времени намаза
async function loadPrayerTimes(forceRefresh = false) {
    const cityId = document.getElementById('city').value;
    const city = citiesData[cityId];
    
    if (!city) {
        showError("Город не найден");
        return;
    }
    
    showLoading();
    
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    const cacheKey = `prayer_${cityId}_${dateStr}`;
    
    // Проверяем кэш
    if (!forceRefresh) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                const cacheDate = new Date(data.cachedAt);
                const hoursDiff = (new Date() - cacheDate) / (1000 * 60 * 60);
                if (hoursDiff < 24) {
                    console.log("Используем кэш");
                    currentPrayerTimes = data.times;
                    updatePrayerTimesUI(currentPrayerTimes);
                    updateNextPrayer();
                    updateLastUpdated();
                    document.getElementById('dataSource').textContent = "aladhan.com (кэш)";
                    return;
                }
            } catch(e) {}
        }
    }
    
    // Запрос к API
    try {
        const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${city.lat}&longitude=${city.lng}&method=3&school=1`;
        console.log("Запрос к API:", url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 200 && data.data) {
            const timings = data.data.timings;
            currentPrayerTimes = {
                Fajr: timings.Fajr.substring(0, 5),
                Sunrise: timings.Sunrise.substring(0, 5),
                Dhuhr: timings.Dhuhr.substring(0, 5),
                Asr: timings.Asr.substring(0, 5),
                Maghrib: timings.Maghrib.substring(0, 5),
                Isha: timings.Isha.substring(0, 5)
            };
            
            // Сохраняем в кэш
            localStorage.setItem(cacheKey, JSON.stringify({
                times: currentPrayerTimes,
                cachedAt: new Date().toISOString()
            }));
            
            updatePrayerTimesUI(currentPrayerTimes);
            updateNextPrayer();
            updateLastUpdated();
            document.getElementById('dataSource').textContent = "aladhan.com (актуальное)";
        } else {
            throw new Error("Ошибка API");
        }
    } catch (error) {
        console.error("Ошибка:", error);
        // Используем резервные данные
        currentPrayerTimes = fallbackTimes;
        updatePrayerTimesUI(currentPrayerTimes);
        updateNextPrayer();
        updateLastUpdated();
        document.getElementById('dataSource').textContent = "локальные данные";
    }
}

function updatePrayerTimesUI(times) {
    const prayerList = document.getElementById('prayerList');
    prayerList.innerHTML = '';
    
    prayers.forEach(prayer => {
        const time = times[prayer.key] || '--:--';
        const item = document.createElement('div');
        item.className = 'prayer-item';
        item.setAttribute('data-prayer', prayer.key);
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

function getNextPrayer() {
    if (!currentPrayerTimes) return null;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const prayer of prayers) {
        if (currentPrayerTimes[prayer.key]) {
            const [hours, minutes] = currentPrayerTimes[prayer.key].split(':');
            const prayerMinutes = parseInt(hours) * 60 + parseInt(minutes);
            
            if (prayerMinutes > currentMinutes) {
                return { ...prayer, time: currentPrayerTimes[prayer.key] };
            }
        }
    }
    
    return { ...prayers[0], time: currentPrayerTimes.Fajr };
}

function updateNextPrayer() {
    const nextPrayer = getNextPrayer();
    
    if (nextPrayer) {
        document.getElementById('nextPrayerName').textContent = nextPrayer.name;
        document.getElementById('nextPrayerTime').textContent = nextPrayer.time;
        
        if (countdownInterval) clearInterval(countdownInterval);
        startCountdown(nextPrayer.time);
    }
}

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

function loadDates() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('gregorianDate').textContent = now.toLocaleDateString('ru-RU', options);
    document.getElementById('hijriDate').textContent = getHijriDate();
}

function getHijriDate() {
    const hijriMonths = ['Мухаррам', 'Сафар', 'Раби-уль-авваль', 'Раби-уль-ахир', 'Джумада-уль-уля', 'Джумада-уль-ахира', 'Раджаб', 'Шаабан', 'Рамадан', 'Шавваль', 'Зуль-Каада', 'Зуль-Хиджа'];
    const now = new Date();
    const hijriYear = now.getFullYear() - 622;
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24));
    const month = Math.floor(dayOfYear / 29.5) % 12;
    const day = (dayOfYear % 29.5) + 1;
    return `${Math.floor(day)} ${hijriMonths[month]} ${hijriYear} г. Хиджры`;
}

function updateLastUpdated() {
    const now = new Date();
    document.getElementById('lastUpdated').textContent = `Обновлено: ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function showLoading() {
    const prayerList = document.getElementById('prayerList');
    prayerList.innerHTML = '<div class="prayer-item"><div class="prayer-info">Загрузка...</div></div>';
}

function showError(msg) {
    console.error(msg);
}

// ========== КОМПАС ==========
function updateQiblaAngle() {
    const cityId = document.getElementById('city').value;
    const qiblaAngle = citiesData[cityId]?.qibla || 198;
    document.getElementById('qiblaAngle').textContent = `${qiblaAngle}°`;
    return qiblaAngle;
}

function startCompass() {
    const qiblaAngle = updateQiblaAngle();
    const statusDiv = document.getElementById('compassStatus');
    const startBtn = document.getElementById('startCompassBtn');
    
    const handleOrientation = (event) => {
        let alpha = event.alpha;
        if (alpha !== null && alpha !== undefined) {
            // Стрелка компаса
            const needle = document.getElementById('compassNeedle');
            if (needle) {
                needle.style.transform = `translate(-50%, -50%) rotate(${-alpha}deg)`;
            }
            // Стрелка Киблы
            let qiblaDirection = (qiblaAngle - alpha + 360) % 360;
            const qiblaArrow = document.getElementById('qiblaArrow');
            if (qiblaArrow) {
                qiblaArrow.style.transform = `rotate(${qiblaDirection}deg)`;
            }
            statusDiv.innerHTML = '🧭 Компас работает | Поворачивайте телефон';
            startBtn.style.display = 'none';
        }
    };
    
    // Для iOS
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    if (deviceOrientationListener) {
                        window.removeEventListener('deviceorientation', deviceOrientationListener);
                    }
                    window.addEventListener('deviceorientation', handleOrientation);
                    deviceOrientationListener = handleOrientation;
                    statusDiv.innerHTML = '✅ Компас активирован!';
                    startBtn.style.display = 'none';
                } else {
                    statusDiv.innerHTML = '❌ Доступ запрещён. Разрешите в настройках Safari';
                }
            })
            .catch(error => {
                statusDiv.innerHTML = '❌ Ошибка доступа';
            });
    } 
    // Для Android
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
