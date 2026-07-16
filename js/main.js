// Mobile nav toggle — same pattern as the current site's index.js
// (vanilla JS, no dependencies, no build step).
const menuBtn = document.querySelector('.nd-menu-btn')
const mobileNav = document.querySelector('.nd-mobile-nav')
const mobileNavLinks = document.querySelectorAll('.nd-mobile-nav__link')

if (menuBtn && mobileNav) {
  menuBtn.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('nd-is-open')
    menuBtn.setAttribute('aria-expanded', String(isOpen))
  })

  mobileNavLinks.forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('nd-is-open')
      menuBtn.setAttribute('aria-expanded', 'false')
    })
  })
}

// Mark the nav link matching the current page as aria-current, so the
// wavy-underline hover style also shows a resting state on the active page.
// In-page anchors (e.g. "index.html#about") are section links, not page
// links, so only a hash-free href counts as "the current page".
const currentPage = window.location.pathname.split('/').pop() || 'index.html'
document.querySelectorAll('.nd-nav__link, .nd-mobile-nav__link').forEach((link) => {
  const rawHref = link.getAttribute('href')
  const isPageLink = !rawHref.includes('#')
  const page = rawHref.split('#')[0] || 'index.html'
  if (isPageLink && page === currentPage) {
    link.setAttribute('aria-current', 'page')
  }
})
