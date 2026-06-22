const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
  root.dataset.theme = 'dark';
}

function updateThemeLabel() {
  const isDark = root.dataset.theme === 'dark';
  themeButton.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
}

updateThemeLabel();

themeButton.addEventListener('click', () => {
  const isDark = root.dataset.theme === 'dark';
  if (isDark) {
    delete root.dataset.theme;
    localStorage.setItem('theme', 'light');
  } else {
    root.dataset.theme = 'dark';
    localStorage.setItem('theme', 'dark');
  }
  updateThemeLabel();
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -30px' });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
document.getElementById('year').textContent = new Date().getFullYear();

const projectAccordions = document.querySelectorAll('.project-accordion');
projectAccordions.forEach((accordion) => {
  accordion.addEventListener('toggle', () => {
    if (!accordion.open) return;
    projectAccordions.forEach((otherAccordion) => {
      if (otherAccordion !== accordion) otherAccordion.open = false;
    });
  });
});
