// Circuit Trace — shared JS

// Mobile menu hamburger
(function () {
    const hamburger = document.getElementById('hamburger');
    const mobMenu = document.getElementById('mobMenu');
    if (!hamburger || !mobMenu) return;
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        mobMenu.classList.toggle('open');
    });
    mobMenu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            hamburger.classList.remove('open');
            mobMenu.classList.remove('open');
        });
    });
})();

// FAQ accordion
(function () {
    document.querySelectorAll('.faq-item').forEach(item => {
        const q = item.querySelector('.faq-q');
        if (!q) return;
        q.addEventListener('click', () => {
            const isOpen = item.classList.toggle('open');
            q.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });
})();

// Smooth-scroll anchor links
(function () {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const target = document.querySelector(a.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
})();
