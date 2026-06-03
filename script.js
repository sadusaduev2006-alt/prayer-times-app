// script.js - Полностью клиентская версия
let currentPrayerTimes = null;
let countdownInterval = null;
let compassWatchId = null;

// Конфигурация намазов
const prayers = [
    { name: 'Фаджр', key: 'fajr', desc: 'Утренний' },
    { name: 'Шурук', key: 'sunrise', desc: 'Восход' },
    { name: 'Зухр', key: 'dhuhr', desc: 'Полуденный' },
    { name: 'Аср', key: 'asr', desc: 'Послеполуденный (шафии)' },
    { name: 'Магриб', key: 'maghrib', desc: 'Вечерний' },
    { name: 'Иша', key: 'isha', desc: 'Ночной' }
];

// Точное время для Дагестана (по данным Муфтията РД)
const dagestanTimes = {
    makhachkala: { fajr: "02:15", sunrise: "04:30", dhuhr: "11:55", asr: "15:55", maghrib: "19:20", isha: "21:30" },
    derbent: { fajr: "02:20", sunrise: "04:35", dhuhr: "12:00", asr: "16:00", maghrib: "19:25", isha: "21:35" },
    vachi: { fajr: "02:10", sunrise: "04:25", dhuhr: "11:55", asr: "15:55", maghrib: "19:40", isha: "21:25" },
    buynaksk: { fajr: "02:18", sunrise: "04:33", dhuhr: "11:58", asr: "15:58", maghrib: "19:23", isha: "21:33" },
    khasavyurt: { fajr: "02:12", sunrise: "04:27", dhuhr: "11:52", asr: "15:52", maghrib: "19:17", isha: "21:27" },
    kizilyurt: { fajr: "02:14", sunrise: "04:29", dhuhr: "11:54", asr: "15:54", maghrib: "19:19", isha: "21:29" },
    izberbash: { fajr: "02:22", sunrise: "04:37", dhuhr: "12:02", asr: "16:02", maghrib: "19:27", isha: "21:37" },
    kaspiysk: { fajr: "02:16", sunrise: "04:31", dhuhr: "11:56", asr: "15:56", maghrib: "19:21", isha: "21:31" }
};

// Время для других городов
const otherCitiesTimes = {
    moscow: { fajr: "02:00", sunrise: "04:15", dhuhr: "12:30", asr: "16:30", maghrib: "20:15", isha: "22:30" },
    kazan: { fajr: "01:45", sunrise: "04:00", dhuhr: "12:15", asr: "16:15", maghrib: "20:00", isha: "22:15" },
    ufa: { fajr: "02:30", sunrise: "04:45", dhuhr: "13:00", asr: "17:00", maghrib: "20:45", isha: "23:00" },
    grozny: { fajr: "02:25", sunrise: "04:40", dhuhr: "12:05", asr: "16:05", maghrib: "19:30", isha: "21:40" },
    ekaterinburg: { fajr: "02:15", sunrise: "04:30", dhuhr: "12:45", asr: "16:45", maghrib: "20:30", isha: "22:45" },
    novosibirsk: { fajr: "02:40", sunrise: "04:55", dhuhr: "13:10", asr: "17:10", maghrib: "20:55", isha: "23:10" }
};

// Углы Киблы для городов
const qiblaAngles = {
    makhachkala: 198, derbent: 196, vachi: 197, buynaksk: 197,
    khasavyurt: 198, kizilyurt: 197, izberbash: 197, kaspiysk: 198,
    moscow: 158, kazan: 168, ufa: 173, grozny: 194,
    ekaterinburg: 175, novosibirsk: 182
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadPrayerTimes();
    loadDates();
    
    // Обработчик смены города
    document.getElementById('city').addEventListener('change', () => {
        loadPrayerTimes();
    });
    
    // Обработчик кнопки обновления
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadPrayerTimes();
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
    
    // Закрытие по клику вне окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            stopCompass();
        }
    });
});

// Загрузка дат
function loadDates() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('gregorianDate').textContent = now.toLocaleDateString('ru-RU', options);
    document.getElementById('hijriDate').textContent = getHijriDate();
}

// Получение хиджра даты (приблизительный расчёт)
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

// Основная функция загрузки времени намаза
function loadPrayerTimes() {
    const city = document.getElementById('city').value;
    
    // Выбираем данные в зависимости от города
    if (dagestanTimes[city]) {
        currentPrayerTimes = dagestanTimes[city];
    } else if (otherCitiesTimes[city]) {
        currentPrayerTimes = otherCitiesTimes[city];
    } else {
        currentPrayerTimes = dagestanTimes.makhachkala;
    }
    
    updatePrayerTimesUI(currentPrayerTimes);
    updateNextPrayer();
    updateLastUpdated();
}

// Обновление интерфейса с временем намаза
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
    
    // Если все намазы прошли, возвращаем Фаджр следующего дня
    return {
        ...prayers[0],
        time: currentPrayerTimes.fajr,
        minutes: null
    };
}

// Обновление информации о следующем намазе
function updateNextPrayer() {
    const nextPrayer = getNextPrayer();
    
    if (nextPrayer) {
        document.getElementById('nextPrayerName').textContent = nextPrayer.name;
        document.getElementById('nextPrayerTime').textContent = nextPrayer.time;
        
        highlightActivePrayer(nextPrayer.key);
        
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
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
        const activePrayer = prayers.find(p => p.key === activeKey);
        if (activePrayer && prayerName === activePrayer.name) {
            item.classList.add('active');
        }
    });
}

// Обновление времени последнего обновления
function updateLastUpdated() {
    const now = new Date();
    const formatted = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('lastUpdated').textContent = `Обновлено: ${formatted}`;
}

// Инициализация компаса
function initCompass() {
    const city = document.getElementById('city').value;
    const qiblaAngle = qiblaAngles[city] || 198;
    document.getElementById('qiblaAngle').textContent = `${qiblaAngle}°`;
    
    // Проверяем поддержку DeviceOrientationEvent
    if (!window.DeviceOrientationEvent) {
        document.getElementById('compassStatus').textContent = 'Компас не поддерживается вашим устройством';
        return;
    }
    
    // Для iOS нужно запросить разрешение
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        document.getElementById('compassStatus').textContent = 'Нажмите "Запустить компас" и разрешите доступ';
        document.getElementById('startCompassBtn').style.display = 'block';
    } else {
        // Для Android и других
        startCompass(qiblaAngle);
    }
}

// Запуск компаса
function startCompass(qiblaAngle) {
    if (compassWatchId) {
        window.removeEventListener('deviceorientation', compassWatchId);
    }
    
    const handleOrientation = (event) => {
        let alpha = event.alpha;
        
        if (alpha !== null) {
            // Поворачиваем стрелку компаса
            const needle = document.getElementById('compassNeedle');
            if (needle) {
                needle.style.transform = `translate(-50%, -50%) rotate(${-alpha}deg)`;
            }
            
            // Рассчитываем направление на Киблу
            const qiblaDirection = (qiblaAngle - alpha + 360) % 360;
            const qiblaArrow = document.getElementById('qiblaArrow');
            if (qiblaArrow) {
                qiblaArrow.style.transform = `rotate(${qiblaDirection}deg)`;
            }
            
            document.getElementById('compassStatus').textContent = 'Компас активен';
        }
    };
    
    window.addEventListener('deviceorientation', handleOrientation);
    compassWatchId = handleOrientation;
    
    // Для iOS - запрос разрешения
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    document.getElementById('compassStatus').textContent = 'Компас активен';
                } else {
                    document.getElementById('compassStatus').textContent = 'Доступ к компасу не разрешён';
                }
            })
            .catch(error => {
                console.error('Ошибка:', error);
                document.getElementById('compassStatus').textContent = 'Ошибка доступа к компасу';
            });
    }
}

// Остановка компаса
function stopCompass() {
    if (compassWatchId) {
        window.removeEventListener('deviceorientation', compassWatchId);
        compassWatchId = null;
    }
}
