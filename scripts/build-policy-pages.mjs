// LogicHub/scripts/build-policy-pages.mjs
// Generates the policy pages from one layout and one set of constants.
//
// These were previously hand-maintained copies at the repository root and again
// under public/, which is how privacy.html came to describe a "demo marketplace"
// long after the product stopped being one. Generating them means the contact
// address and the transacting state are stated once.
//
// Run: node scripts/build-policy-pages.mjs

import { writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import {
  CONTACT_EMAIL,
  PLACEHOLDER as P,
  PAYMENTS_ENABLED,
  SITE_NAME,
  SERVED_COUNTRIES,
} from './site-constants.mjs';

const UPDATED = new Date().toISOString().slice(0, 10);

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | ${SITE_NAME}</title>
<meta name="description" content="${title} for ${SITE_NAME}.">
<style>
:root{--orange:#ff671f;--dark:#000}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--dark);color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;line-height:1.8}
.container{max-width:800px;margin:0 auto}
h1{color:var(--orange);margin-bottom:10px;font-size:2rem}
.updated{color:#888;font-size:.9rem;margin-bottom:30px}
h2{margin:30px 0 15px;font-size:1.5rem}
h3{margin:20px 0 10px;font-size:1.15rem;color:#ddd}
p{margin-bottom:15px;color:#ccc}
ul{margin:15px 0 15px 20px;color:#ccc}
li{margin-bottom:10px}
a{color:var(--orange);text-decoration:none}
a:hover{text-decoration:underline}
dl{margin:15px 0;color:#ccc}
dt{font-weight:700;margin-top:12px}
dd{margin-left:0;color:#aaa}
.notice{border:1px solid var(--orange);border-radius:8px;padding:16px;margin:20px 0;background:rgba(255,103,31,.08)}
.notice strong{color:var(--orange)}
.back{display:inline-block;margin-top:30px;padding:12px 24px;background:var(--orange);color:#000;border-radius:50px;font-weight:900;text-decoration:none}
.back:hover{background:#ff8c3f}
footer{margin-top:40px;padding-top:20px;border-top:1px solid #333;color:#888;font-size:.85rem}
footer a{margin-right:14px}
</style>
</head><body><div class="container">
${body}
<a class="back" href="/">Back to ${SITE_NAME}</a>
<footer>
<a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refund-policy">Refunds</a><a href="/shipping-policy">Shipping</a><a href="/cookies">Cookies</a><a href="/contact">Contact</a>
<p style="margin-top:12px">Every query: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</footer>
</div></body></html>`;
}

/** Shown on every commerce policy while payments are switched off. */
const notTransacting = PAYMENTS_ENABLED ? '' : `
<div class="notice">
<strong>No payments are being taken.</strong>
<p style="margin:8px 0 0">Checkout is switched off on this deployment. No order is
created, no card or UPI details are collected, and nothing is charged. This policy
is published so the terms are known in advance of payments opening, not because a
transaction can happen today.</p>
</div>`;

const entityBlock = `
<h2>Who operates this service</h2>
<dl>
<dt>Legal entity</dt><dd>${P.legalEntity} (${P.entityType})</dd>
<dt>Registered address</dt><dd>${P.registeredAddress}</dd>
<dt>Registration number</dt><dd>${P.registrationNumber}</dd>
<dt>GSTIN</dt><dd>${P.gstin}</dd>
<dt>Contact</dt><dd><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></dd>
</dl>`;

const pages = {};

// ---------------------------------------------------------------- privacy
pages['privacy.html'] = layout('Privacy Policy', `
<h1>Privacy Policy</h1>
<p class="updated">Last updated: ${UPDATED}</p>

<p>${SITE_NAME} is a tool for designing hardware. This policy describes what we
collect, why, how long we keep it, and what you can require of us.</p>

${entityBlock}

<h2>What stays on your device</h2>
<p>The product graph you build in the design tool is held in your browser's local
storage. It is not transmitted to us, and we have no copy of it. We cannot show
you a design we were never sent, and we cannot produce one if asked for it.</p>

<h2>What we collect</h2>
<dl>
<dt>Waiting list</dt><dd>Your email address, and anything else you choose to type
into the form. Collected only when you submit it.</dd>
<dt>Correspondence</dt><dd>Messages you send us, so we can reply and keep a record
of what was asked.</dd>
<dt>Server logs</dt><dd>Standard request logs kept by our hosting provider,
including IP address and user agent, used for security and diagnosing faults.</dd>
</dl>
<p>We do not use analytics or tracking cookies. See the
<a href="/cookies">cookie policy</a>.</p>

<h2>Why we collect it</h2>
<ul>
<li>To tell you when something you asked to be told about is ready</li>
<li>To answer your questions</li>
<li>To keep the service working and secure</li>
</ul>
<p>We rely on your consent, given when you submit a form. You may withdraw it at
any time, and withdrawing is as easy as giving it: email
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2>How long we keep it</h2>
<dl>
<dt>Waiting list entries</dt><dd>Until the list is fulfilled or you ask us to
remove you, whichever comes first.</dd>
<dt>Correspondence</dt><dd>For as long as needed to resolve the matter, and then
as required for our records.</dd>
<dt>Server logs</dt><dd>As retained by our hosting provider under their standard
retention.</dd>
</dl>

<h2>Who we share it with</h2>
<p>We do not sell personal data and we do not share it for advertising. It is
handled by the providers that run the service on our behalf — hosting, the
transactional email provider, and the payment gateway if and when payments open.
Each processes it only to provide that function.</p>

<h2>Your rights</h2>
<p>Under the Digital Personal Data Protection Act, 2023, you may:</p>
<ul>
<li>Ask what personal data we hold about you and how it is processed</li>
<li>Ask us to correct or complete it</li>
<li>Ask us to erase it, where we are not required to keep it</li>
<li>Nominate someone to exercise these rights if you are unable to</li>
<li>Withdraw consent, and complain about how we handled a request</li>
</ul>

<h2>Grievance Officer</h2>
<dl>
<dt>Name</dt><dd>${P.grievanceOfficer}</dd>
<dt>Email</dt><dd><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></dd>
</dl>
<p>Write with "Grievance" in the subject line and we will respond. If you are not
satisfied with our response you may complain to the Data Protection Board of
India.</p>

<h2>Children</h2>
<p>This service is not directed at children, and we do not knowingly collect
personal data from a child. If you believe we have, tell us and we will delete it.</p>

<h2>Changes</h2>
<p>When this policy changes the date at the top changes with it. Material changes
will be notified to anyone on the waiting list.</p>
`);

// ------------------------------------------------------------------ terms
pages['terms.html'] = layout('Terms of Service', `
<h1>Terms of Service</h1>
<p class="updated">Last updated: ${UPDATED}</p>

${notTransacting}

<h2>1. Agreement</h2>
<p>By using ${SITE_NAME} you agree to these terms. If you do not agree, do not use
the service.</p>

${entityBlock}

<h2>2. What the service does</h2>
<p>${SITE_NAME} lets you assemble a hardware configuration, see the consequences of
your choices calculated, and find out which products that configuration could
become and which kit would match it.</p>

<h2>3. What the service does not claim</h2>
<p>This matters more than the feature list, so it is stated plainly.</p>
<ul>
<li>Figures shown are <strong>calculated or estimated</strong> from component data.
They are not measurements, and no design has been measured on hardware.</li>
<li>A feasibility verdict means the capability arithmetic works on paper. It is not
a statement that a product has been built, tested, or shown to work.</li>
<li>Nothing offered here is certified, and no safety, regulatory, or fitness claim
is made about any design or kit.</li>
<li>No component listed has been sourced. Part numbers, prices and stock are
recorded as unknown rather than estimated.</li>
<li>Simulations and calculations are never presented as verification.</li>
</ul>
<p>You remain responsible for verifying any design before building it, and for
building it safely.</p>

<h2>4. Your responsibilities</h2>
<ul>
<li>Give accurate information when you submit a form</li>
<li>Do not attempt to break, overload, or gain unauthorised access to the service</li>
<li>Do not use the service where doing so would break the law that applies to you</li>
</ul>

<h2>5. Intellectual property</h2>
<p>The designs you create are yours. The service, its code, and its content remain
ours. Using the service grants you no licence to our code or branding.</p>

<h2>6. Availability</h2>
<p>The service is offered as it is. We do not promise it will be uninterrupted or
error free, and we may change or withdraw parts of it.</p>

<h2>7. Liability</h2>
<p>To the extent the law allows, we are not liable for loss arising from use of the
service, including loss arising from a design that did not behave as the
calculations suggested. Nothing here excludes liability that cannot lawfully be
excluded.</p>

<h2>8. Where the service is offered</h2>
<p>Currently ${SERVED_COUNTRIES.join(', ')}.</p>

<h2>9. Governing law</h2>
<p>These terms are governed by the laws of India. Disputes are subject to the
courts of ${P.jurisdiction}.</p>

<h2>10. Contact</h2>
<p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`);

// ------------------------------------------------------------ refund policy
pages['refund-policy.html'] = layout('Cancellation and Refund Policy', `
<h1>Cancellation and Refund Policy</h1>
<p class="updated">Last updated: ${UPDATED}</p>

${notTransacting}

<h2>Cancelling an order</h2>
<p>An order for a physical kit may be cancelled at any time before it is dispatched,
for a full refund. Once dispatched, the return terms below apply instead.</p>

<h2>Returns</h2>
<p>A kit may be returned within ${P.refundWindow} days of delivery if it is unused
and in its original packaging. A kit that has been assembled, modified, or
electrically damaged cannot be returned, because it cannot be resold.</p>

<h2>Faulty or incorrect items</h2>
<p>If a kit arrives damaged, incomplete, or is not what was ordered, tell us within
${P.refundWindow} days and we will replace it or refund it in full, including
return postage. This is in addition to your statutory rights, not instead of them.</p>

<h2>Digital items</h2>
<p>Where a purchase gives immediate access to a digital deliverable, it is refundable
until that deliverable is first downloaded or generated. After that it cannot be
returned, since it cannot be given back.</p>

<h2>How refunds are made</h2>
<p>Refunds go back to the original payment method. Once we approve a refund we
initiate it promptly; how long it then takes to appear is set by your bank or card
issuer, not by us, so we do not promise a date we do not control.</p>

<h2>How to ask</h2>
<p>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with your order
reference and what went wrong.</p>
`);

// ---------------------------------------------------------- shipping policy
pages['shipping-policy.html'] = layout('Shipping and Delivery Policy', `
<h1>Shipping and Delivery Policy</h1>
<p class="updated">Last updated: ${UPDATED}</p>

${notTransacting}

<h2>What ships</h2>
<p>Kits and modules are physical goods, shipped to the address given at checkout.
Anything digital is delivered to your account and is not shipped.</p>

<h2>Where we ship</h2>
<p>Currently ${SERVED_COUNTRIES.join(', ')}. If your country is not listed we cannot
ship to you yet.</p>

<h2>Dispatch and delivery</h2>
<dl>
<dt>Dispatch</dt><dd>${P.dispatchTime} from a confirmed order.</dd>
<dt>Delivery</dt><dd>${P.deliveryTime} from dispatch, depending on destination.</dd>
</dl>
<p>These are the times we work to, not guarantees. Carriers, customs, and weather
are outside our control, and we would rather say so than promise a date we cannot
hold. You will get a tracking reference when your order is dispatched.</p>

<h2>Charges, duties and taxes</h2>
<p>Shipping is charged at checkout and shown before you pay. For international
orders, import duty and local taxes are set by the destination country and are
payable by you.</p>

<h2>Problems</h2>
<p>If an order has not arrived within the expected window, or arrives damaged, email
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> and we will trace it. See
the <a href="/refund-policy">refund policy</a> for what happens next.</p>
`);

// ---------------------------------------------------------------- cookies
pages['cookies.html'] = layout('Cookie Policy', `
<h1>Cookie Policy</h1>
<p class="updated">Last updated: ${UPDATED}</p>

<div class="notice">
<strong>We do not track you.</strong>
<p style="margin:8px 0 0">This site sets no analytics cookies, no advertising
cookies, and no third-party trackers. There is no consent banner because there is
nothing to consent to. A test in our build asserts no analytics script is present,
so this statement cannot quietly stop being true.</p>
</div>

<h2>What is stored</h2>
<dl>
<dt>Essential cookies</dt><dd>Only where needed to keep you signed in or to keep a
session working. They carry no profile and are not shared.</dd>
<dt>Local storage</dt><dd>The design tool saves your product graph in your
browser's local storage so your work survives a refresh. It stays on your device,
is never sent to us, and you can clear it at any time through your browser or with
the Reset control in the tool.</dd>
</dl>

<h2>What is not stored</h2>
<ul>
<li>No analytics or usage tracking</li>
<li>No advertising or cross-site identifiers</li>
<li>No profiling and no behavioural targeting</li>
<li>No fingerprinting</li>
</ul>

<h2>If this changes</h2>
<p>If we ever adopt analytics, this page changes first, a consent mechanism appears
before anything is collected, and the change is notified. We will not switch on
tracking behind an unchanged policy.</p>

<h2>Questions</h2>
<p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`);

// ---------------------------------------------------------------- contact
pages['contact.html'] = layout('Contact', `
<h1>Contact</h1>
<p class="updated">Last updated: ${UPDATED}</p>

<div class="notice">
<strong>One address for every query.</strong>
<p style="margin:8px 0 0"><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</div>

<p>Support, sales, privacy requests, refunds, press, or anything else — the same
address reaches us. There is no queue to pick and no form to guess at.</p>

<h2>To help us answer faster</h2>
<ul>
<li>Orders: include the order reference</li>
<li>Privacy requests: put "Grievance" in the subject</li>
<li>Faults: tell us what you did, what you expected, and what happened</li>
</ul>

${entityBlock}

<h2>Grievance Officer</h2>
<dl>
<dt>Name</dt><dd>${P.grievanceOfficer}</dd>
<dt>Email</dt><dd><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></dd>
</dl>
<p>Appointed under the Digital Personal Data Protection Act, 2023 for questions and
complaints about how your personal data is handled.</p>
`);

// --------------------------------------------------------------- waitlist
pages['waitlist.html'] = layout('Waiting List — Storage Cartridge', `
<h1>Storage Cartridge</h1>
<p class="updated">Waiting list · indicative price USD 20</p>

<div class="notice">
<strong>This does not exist yet.</strong>
<p style="margin:8px 0 0">No cartridge has been built, measured, or sourced. This
page records that you want to be told when there is one, and nothing more. You are
not buying anything, no payment details are collected, and no delivery date is
being offered.</p>
</div>

<h2>What it is meant to be</h2>
<p>An 8&nbsp;MB storage module that carries a ${SITE_NAME} project capsule offline,
sitting beside a controller rather than inside its program space. The design target
is a 64&nbsp;Mbit SPI NOR flash part: 2.7–3.6&nbsp;V, 256-byte pages, 4&nbsp;KB
erase sectors.</p>

<h2>Why it exists</h2>
<p>Your design stays on your own hardware. A capsule is self-contained, carries its
own checksums, and resolves nothing over a network when opened — so the work can be
handed to someone, archived, or moved between machines without passing through a
service.</p>

<h2>What is honestly known</h2>
<ul>
<li>A capsule of a full worked example occupies about 2% of the part, leaving
roughly 7.8&nbsp;MB free. That is measured from real generated output.</li>
<li>The flash figures above are published values for the part family and still need
confirming against the datasheet revision of whatever is actually ordered.</li>
<li>USD 20 is <strong>indicative</strong>. Pricing is not fixed, and it may move in
either direction once the part is sourced and assembly is costed.</li>
<li>There is no schedule. When there is one, the people on this list hear first.</li>
</ul>

<h2>Join the list</h2>
<form id="waitlist-form">
<p><label for="wl-email">Email</label><br>
<input id="wl-email" name="email" type="email" required autocomplete="email"
style="width:100%;padding:10px;border-radius:6px;border:1px solid #444;background:#111;color:#fff;font-size:1rem">
</p>
<p><label for="wl-note">Anything you want us to know (optional)</label><br>
<textarea id="wl-note" name="note" rows="3" maxlength="500"
style="width:100%;padding:10px;border-radius:6px;border:1px solid #444;background:#111;color:#fff;font-size:1rem"></textarea>
</p>
<button type="submit" class="back" style="border:0;cursor:pointer">Add me to the list</button>
</form>
<p id="wl-status" role="status" style="margin-top:16px"></p>
<p style="font-size:.85rem;color:#888">We use your address to tell you about this
one thing. It is covered by our <a href="/privacy">privacy policy</a>, and you can
ask us to remove it at any time by emailing
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<script>
document.getElementById('waitlist-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  var status = document.getElementById('wl-status');
  var button = event.target.querySelector('button');
  button.disabled = true;
  status.textContent = 'Recording...';
  try {
    var response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('wl-email').value,
        note: document.getElementById('wl-note').value
      })
    });
    var data = await response.json();
    if (response.ok) {
      status.textContent = data.message;
      event.target.style.display = 'none';
    } else {
      status.textContent = data.message || 'That did not work. Please email ${CONTACT_EMAIL}.';
      button.disabled = false;
    }
  } catch (error) {
    status.textContent = 'Could not reach the server. Please email ${CONTACT_EMAIL}.';
    button.disabled = false;
  }
});
</script>
`);

// -------------------------------------------------------------------- write
const outputs = Object.entries(pages);
if (!existsSync('public')) mkdirSync('public', { recursive: true });

for (const [file, html] of outputs) {
  writeFileSync(file, html);
  copyFileSync(file, `public/${file}`);
}

console.log(JSON.stringify({
  generated: outputs.map(([file]) => file),
  contactEmail: CONTACT_EMAIL,
  paymentsEnabled: PAYMENTS_ENABLED,
}, null, 2));
