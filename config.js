const config = {
  // --- Colors ---
  colors: {
    primary: '#6a00ff',
    primaryDark: '#5200c7',
    secondary: '#007bff',

    cta: '#ff6a00',
    ctaDark: '#cc5400',

    text: '#333',
    textLight: '#555',
    heading: '#222',
    textFooter: '#ccc',
    textFooterLink: '#a0a0a0',

    backgroundLight: '#f8f9fa',
    backgroundDark: '#212529',
    white: '#fff',

    gradientCtaEnd: '#8a2be2', // Used in CTA section background gradient
    hoverLight: '#eee', // Used for CTA button hover background
  },

  // --- Typography ---
  typography: {
    fontFamily: "'Roboto', sans-serif",
    baseLineHeight: 1.6,
    headingLineHeight: 1.2,
    baseFontSize: '1rem', // Default browser size, used as a reference for rem units

    // Heading Sizes (Desktop First)
    h1: '3.2rem',
    h2: '2.5rem',
    h3: '1.8rem',

    // Specific Element Font Sizes (Desktop First)
    hero: {
      h1: '3.5rem',
      p: '1.3rem',
    },
    navLink: '1.05rem',
    ctaButton: '1.15rem',
    featureItem: {
      h3: '1.6rem',
      p: '1rem',
    },
    testimonial: {
      p: '1.15rem',
      cite: '0.95rem',
    },
    footer: {
      h3: '1.2rem',
      text: '0.95rem',
      bottomText: '0.85rem',
    },

    // Responsive Typography Adjustments based on mediaQueries breakpoints
    responsive: {
      md: { // Applies for (max-width: 992px)
        h1: '2.8rem',
        h2: '2rem',
        hero: {
          h1: '2.8rem',
          p: '1.15rem',
        },
        cta: {
          h2: '2.2rem',
          p: '1.1rem',
        },
      },
      sm: { // Applies for (max-width: 768px)
        h1: '2.2rem',
        h2: '1.8rem',
        hero: {
          h1: '2.2rem',
          p: '1rem',
        },
        cta: {
          h2: '1.8rem',
          p: '1.1rem', // Inherited from md, not changed further
        },
        featureItem: {
          h3: '1.4rem',
        },
        ctaButton: '1rem', // Specific button size override
      },
      xs: { // Applies for (max-width: 480px)
        // No specific typography changes in CSS, mostly layout
      }
    }
  },

  // --- Layout & Dimensions ---
  layout: {
    containerMaxWidth: '1200px',
    borderRadius: '8px',
    boxShadowLight: '0 4px 12px rgba(0, 0, 0, 0.08)',
    headerZIndex: 1000,
  },

  // --- Spacing Scale ---
  // A consistent spacing scale based on rem units for various elements
  spacing: {
    xxxs: '0.5rem', // e.g., small gaps, auth-button vertical on xs
    xxs: '0.8rem', // e.g., auth-buttons gap
    xs: '1rem',    // e.g., header padding, main-nav gap on sm
    sm: '1.5rem',  // e.g., container horizontal padding, footer bottom gap
    md: '2rem',    // e.g., main-nav gap, testimonial gap, h2 margin-bottom
    lg: '2.5rem',  // e.g., feature/footer grid gaps, testimonial card padding
    xl: '3rem',    // e.g., hero section gap, CTA section text margin
    xxl: '3.5rem', // e.g., feature grid margin, testimonial carousel margin
    xxxl: '4rem',  // e.g., footer top padding, hero/cta padding on sm
    xxxxl: '5rem', // e.g., section vertical padding
    xxxxxl: '6rem',// e.g., hero/CTA section vertical padding
  },

  // --- Section Padding ---
  sections: {
    defaultPadding: '5rem 0',
    heroPadding: '6rem 0',
    ctaPadding: '6rem 0',
    footerPadding: '4rem 0 2rem 0',
    responsive: {
      sm: { // Applies for (max-width: 768px)
        defaultPadding: '3rem 0',
        heroPadding: '4rem 0',
        ctaPadding: '4rem 0',
        footerPadding: '2rem 0',
      },
    },
  },

  // --- Buttons ---
  buttons: {
    base: {
      padding: '0.8rem 1.8rem',
      borderRadius: '8px',
      fontWeight: '600',
      fontSize: '1rem',
      lineHeight: 1,
    },
    cta: {
      padding: '1.1rem 2.5rem',
      fontSize: '1.15rem',
    },
    responsive: {
      sm: { // Applies for (max-width: 768px)
        cta: {
          padding: '0.9rem 2rem',
          fontSize: '1rem',
        },
      },
      xs: { // Applies for (max-width: 480px)
        fullWidth: true, // Buttons become width: 100%
      }
    }
  },

  // --- Transitions ---
  transitions: {
    defaultDuration: '0.3s',
    defaultTimingFunction: 'ease',
    color: 'color 0.3s ease',
    all: 'all 0.3s ease',
    opacity: 'opacity 0.3s ease',
  },

  // --- Media Query Breakpoints (max-width) ---
  mediaQueries: {
    lg: '992px', // Applies rules for screens <= 992px (e.g., tablet landscape and below)
    md: '768px', // Applies rules for screens <= 768px (e.g., tablet portrait and below)
    sm: '480px', // Applies rules for screens <= 480px (e.g., mobile landscape and below)
  },

  // --- Image Specifics ---
  images: {
    featureIconSize: '64px',
  },
};

export default config;