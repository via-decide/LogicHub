document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('mobile-nav-style')) return;

  var style = document.createElement('style');
  style.id = 'mobile-nav-style';
  style.textContent = [
    '.mobile-menu-toggle{display:none;background:none;border:none;color:var(--text,#f4fff9);font-size:1.5rem;cursor:pointer;padding:0.5rem;line-height:1}',
    '@media(max-width:840px){.mobile-menu-toggle{display:block}.nav-links{display:none!important}}',
    '.mobile-nav-overlay{position:fixed;inset:0;z-index:9999;background:rgba(7,17,15,0.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);display:flex;flex-direction:column;justify-content:center;align-items:center;padding:5rem 1.25rem 2rem;opacity:0;pointer-events:none;transition:opacity 0.3s ease}',
    '.mobile-nav-overlay.is-active{opacity:1;pointer-events:auto}',
    '.mobile-nav-overlay a{font-size:1.5rem;font-weight:700;color:#f4fff9;margin:0.55rem 0;min-height:44px;display:inline-flex;align-items:center;text-transform:uppercase;letter-spacing:0.05em;transition:color 0.2s;text-decoration:none}',
    '.mobile-nav-overlay a:hover{color:#62ffd0}',
    '.mobile-nav-overlay a.demo-link{color:#62ffd0}',
    '.mobile-nav-close{position:absolute;top:1.5rem;right:1.5rem;background:none;border:none;color:#f4fff9;font-size:2rem;cursor:pointer;line-height:1}'
  ].join('\n');
  document.head.appendChild(style);

  var nav = document.querySelector('.nav');
  if (!nav) return;

  var toggle = document.createElement('button');
  toggle.className = 'mobile-menu-toggle';
  toggle.setAttribute('aria-label', 'Open mobile menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'mobile-nav-overlay');
  toggle.textContent = '☰';
  nav.appendChild(toggle);

  var overlay = document.createElement('div');
  overlay.className = 'mobile-nav-overlay';
  overlay.id = 'mobile-nav-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('inert', '');
  overlay.innerHTML = [
    '<button class="mobile-nav-close" aria-label="Close menu">×</button>',
    '<a href="/how-it-works">How It Works</a>',
    '<a href="/tools/">14 Gates</a>',
    '<a href="/workspace">Workspace</a>',
    '<a href="https://aporaksha.com/store">Store</a>',
    '<a href="https://aporaksha.com/sell">Sell</a>',
    '<a href="https://aporaksha.com/membership">Membership</a>',
    '<a href="https://aporaksha.com/passport">Passport</a>',
    '<a href="/workspace" class="demo-link">Run LogicHub →</a>',
    '<a href="https://daxini.xyz" style="margin-top:1.5rem;font-size:1rem;color:#a7bcb4">Daxini Ecosystem →</a>'
  ].join('');
  document.body.appendChild(overlay);

  var closeBtn = overlay.querySelector('.mobile-nav-close');

  function open() {
    overlay.classList.add('is-active');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.removeAttribute('inert');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('is-active');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggle.focus();
  }

  toggle.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-active')) close();
  });
  overlay.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', close);
  });
});
