// LogicHub Main Application File
// Wires event handlers for auth buttons, CTA buttons, forms

(function() {
  'use strict';

  // Wait for DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('LogicHub app initialized');

    // Wire Sign In button
    const signInBtn = document.querySelector('a.btn-secondary[href="/login"]');
    if (signInBtn) {
      signInBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Sign In clicked');
        // TODO: Route to login page or show modal
        alert('Sign In form would load here');
      });
    }

    // Wire Get Started button
    const signUpBtn = document.querySelector('a.btn-primary[href="/register"]');
    if (signUpBtn) {
      signUpBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Get Started clicked');
        alert('Registration form would load here');
      });
    }

    // Wire CTA buttons (Request Demo, Free Trial)
    const ctaButtons = document.querySelectorAll('a.btn-cta');
    ctaButtons.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('CTA button clicked:', btn.textContent);
        alert('Demo request form would load here');
      });
    });

    // Wire navigation links (smooth scroll)
    document.querySelectorAll('a[href^="#"]').forEach(function(link) {
      link.addEventListener('click', function(e) {
        const href = link.getAttribute('href');
        if (href !== '#' && href !== '#get-started') {
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
            e.preventDefault();
          }
        }
      });
    });
  });
})();
