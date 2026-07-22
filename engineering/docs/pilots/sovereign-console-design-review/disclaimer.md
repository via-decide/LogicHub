# Disclaimer

This disclaimer must be included in every design review report and customer-facing document.

---

## Engineering Design Review — Terms and Limitations

This design review is produced by a deterministic rule-evaluation kernel that performs systematic analysis of declared design inputs against engineering thresholds. By accepting this review, you acknowledge the following:

### What this review IS

- A structured analysis of your declared design parameters against engineering rules
- Deterministic: identical inputs produce identical outputs, verifiable by re-running the kernel
- A tool for identifying evidence gaps, potential issues, and required physical testing

### What this review is NOT

- **Not a safety certification.** This review does not certify the product as safe for any use, including use by children, in classrooms, or in any other environment.
- **Not a regulatory compliance assessment.** This review does not assess compliance with any standard, regulation, or certification scheme (CE, FCC, UL, BIS, IEC, ISO, or any other).
- **Not a guarantee of product fitness.** A `pass` result indicates that declared inputs satisfy the rule's thresholds. It does not guarantee the product will function correctly, safely, or reliably in practice.
- **Not a substitute for physical testing.** Results marked `requires_validation` explicitly require physical bench testing before any claim of product readiness can be made.
- **Not legal advice.** No aspect of this review constitutes legal advice regarding product liability, consumer protection, or regulatory obligations.

### Evidence grade limitations

All kernel calculations operate on inputs with declared evidence grades:
- **measured**: Instrument-verified value with documented methodology
- **datasheet**: Manufacturer-published specification
- **estimated**: Engineering estimate without independent verification
- **unknown**: No value available — produces `unknown` result, never `pass`

Results produced from `estimated` inputs carry `deterministic_estimated_inputs` confidence class. These results are internally consistent but have not been validated against physical reality.

### No claims without evidence

We do not claim, and this review does not establish, that any product is:
- Certified or compliant with any standard
- Safe for unsupervised use by children or any user group
- Ready for production, sale, or distribution
- Free from defects, hazards, or failure modes

Such claims require documented physical evidence that is outside the scope of this analytical review.

### Limitation of liability

This review is provided as-is. The maximum liability for any claim arising from this review is limited to the fee paid for the review.
