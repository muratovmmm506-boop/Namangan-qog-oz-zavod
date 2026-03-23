// ——— Sayt Tashrif Hisoblagichi ———
(function () {
    // Sessiya ichida bir marta sanash (refresh qilsa qayta sanalmaydi)
    if (!sessionStorage.getItem('qogozVisitCounted')) {
        sessionStorage.setItem('qogozVisitCounted', '1');

        const todayKey = new Date().toISOString().slice(0, 10); // "2026-03-08"
        const visits = JSON.parse(localStorage.getItem('qogozVisits') || '{"total":0,"byDate":{}}');

        visits.total = (visits.total || 0) + 1;
        visits.byDate[todayKey] = (visits.byDate[todayKey] || 0) + 1;

        // Faqat so'nggi 30 kunni saqlash (localStorage hajmini tejash)
        const keys = Object.keys(visits.byDate).sort();
        if (keys.length > 30) {
            delete visits.byDate[keys[0]];
        }

        localStorage.setItem('qogozVisits', JSON.stringify(visits));
    }
})();

// Sticky Header Logic
const header = document.querySelector('.header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Counter Animation Logic
const counters = document.querySelectorAll('.counter');
const counterSpeed = 200;

const startCounters = () => {
    counters.forEach(counter => {
        const updateCount = () => {
            const target = +counter.innerText.replace('+', '');
            const count = +counter.getAttribute('data-count') || 0;
            const increment = target / counterSpeed;

            if (count < target) {
                const newCount = Math.ceil(count + increment);
                counter.setAttribute('data-count', newCount);
                counter.innerText = newCount + (target > 100 ? '+' : '');
                setTimeout(updateCount, 1);
            } else {
                counter.innerText = target + (target > 100 ? '+' : '');
            }
        };
        updateCount();
    });
};

// Intersection Observer for Animations and Counters
const observerOptions = {
    threshold: 0.2
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            if (entry.target.classList.contains('stats-section')) {
                startCounters();
            }
            entry.target.querySelectorAll('.animate-up').forEach((el, index) => {
                setTimeout(() => {
                    el.classList.add('show');
                }, index * 150);
            });
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe sections that contain animations
document.querySelectorAll('section, footer, .marquee-container').forEach(section => {
    observer.observe(section);
});

// Smooth Scroll & Scroll Top
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');

        if (targetId === '#' || targetId === '') {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            return;
        }

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// Show/Hide Scroll Top Button based on scroll position
const scrollTopBtn = document.querySelector('.scroll-top-btn');
window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
        scrollTopBtn.style.opacity = '1';
        scrollTopBtn.style.visibility = 'visible';
        scrollTopBtn.style.transform = 'translateY(0)';
    } else {
        scrollTopBtn.style.opacity = '0';
        scrollTopBtn.style.visibility = 'hidden';
        scrollTopBtn.style.transform = 'translateY(20px)';
    }
});

// Initialize Animation CSS
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        .animate-up {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .animate-up.show {
            opacity: 1 !important;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
});
// Side Menu Toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const sideMenu = document.querySelector('.side-menu');
const sideMenuClose = document.querySelector('.side-menu-close');
const sideMenuOverlay = document.querySelector('.side-menu-overlay');

if (mobileMenuToggle && sideMenu && sideMenuClose && sideMenuOverlay) {
    const toggleMenu = (isOpen) => {
        sideMenu.classList.toggle('active', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    mobileMenuToggle.addEventListener('click', () => toggleMenu(true));
    sideMenuClose.addEventListener('click', () => toggleMenu(false));
    sideMenuOverlay.addEventListener('click', () => toggleMenu(false));

    // Close on link click
    sideMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => toggleMenu(false));
    });
}

// Form Submission Handling handled in index.html for backend integration
// ——— Header Search & /admin Shortcut ———
(function () {
    const toggleBtn = document.getElementById('headerSearchToggle');
    const closeBtn = document.getElementById('headerSearchClose');
    const searchBox = document.getElementById('headerSearchBox');
    const input = document.getElementById('headerSearchInput');
    if (!toggleBtn || !input) return;

    function openSearch() {
        searchBox.classList.add('open');
        setTimeout(() => input.focus(), 50);
    }
    function closeSearch() {
        searchBox.classList.remove('open');
        input.value = '';
    }

    toggleBtn.addEventListener('click', () => {
        searchBox.classList.contains('open') ? closeSearch() : openSearch();
    });
    closeBtn.addEventListener('click', closeSearch);

    // /admin yozilsa yoki Enter bosilsa
    input.addEventListener('input', function () {
        if (this.value.trim().toLowerCase() === '/admin') {
            window.location.href = 'admin-login.html';
        }
    });
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            if (this.value.trim().toLowerCase() === '/admin') {
                window.location.href = 'admin-login.html';
            }
        }
        if (e.key === 'Escape') closeSearch();
    });

    // Tashqarida bosish bilan yopish
    document.addEventListener('click', function (e) {
        if (!document.getElementById('headerSearchWrap').contains(e.target)) {
            closeSearch();
        }
    });
})();
