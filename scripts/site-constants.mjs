// LogicHub/scripts/site-constants.mjs
// Single source for the values that appear across every policy page.

/** One contact address for every query, everywhere. */
export const CONTACT_EMAIL = 'dharam@viadecide.com';

/**
 * Facts only the business can supply.
 *
 * Each is a distinctive marker rather than a plausible-looking value. Inventing
 * a registered address or a GST number would put a false statement into a legal
 * document, so these stay obviously unfilled until someone fills them, and
 * scripts/check-placeholders.mjs fails the build while any remain.
 */
export const PLACEHOLDER = {
  legalEntity: '{{LEGAL_ENTITY_NAME}}',
  entityType: '{{ENTITY_TYPE}}',
  registeredAddress: '{{REGISTERED_ADDRESS}}',
  registrationNumber: '{{CIN_OR_REGISTRATION_NUMBER}}',
  gstin: '{{GSTIN}}',
  jurisdiction: '{{DISPUTE_JURISDICTION_CITY}}',
  grievanceOfficer: '{{GRIEVANCE_OFFICER_NAME}}',
  refundWindow: '{{REFUND_WINDOW_DAYS}}',
  dispatchTime: '{{DISPATCH_TIME}}',
  deliveryTime: '{{DELIVERY_TIME}}',
};

/** Every placeholder token, for the build-time check. */
export const PLACEHOLDER_TOKENS = Object.values(PLACEHOLDER);

/**
 * Whether this deployment charges money.
 *
 * Kept beside the policy copy because the policies must describe the same
 * reality the payment endpoints implement. They read the same environment
 * variable.
 */
export const PAYMENTS_ENABLED = String(process.env.PAYMENTS_ENABLED || '').toLowerCase() === 'true';

export const SITE_NAME = 'LogicHub';
export const SITE_ORIGIN = 'https://logichub.app';

/** Countries the checkout geofence currently permits. */
export const SERVED_COUNTRIES = ['India', 'Luxembourg', 'Japan'];
