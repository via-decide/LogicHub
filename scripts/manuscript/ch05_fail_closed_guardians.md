# Chapter 5: Fail-Closed Guardians

Just as embedded hardware needs strict physical constraints, the APIs and digital infrastructure surrounding your physical product must follow the same rigid logic. They must fail closed.

## The Danger of Failing Open

For a beginner setting up their first product launch API, the priority is usually "just make it work." They might use a free form-builder or write a simple script that inserts user data into a database. But edge cases are brutal. What happens if a bot submits 10,000 requests? What happens if someone submits another user's email to spam them?

## Double Opt-In and Cryptography

When a user signs up for a physical product waitlist, you shouldn't just blindly drop their email into a database. You must use a double opt-in mechanism secured by an HMAC (Hash-Based Message Authentication Code) token.

The user signs up, and their record is stored with `confirmed: false`. To confirm them, an HMAC-bound token is sent to their email. 

### Why not just use a random string?

Because an HMAC token mathematically binds the specific, normalized email address to the confirmation action. If an attacker tries to use a token meant for Address A to confirm Address B, the math fails.

More importantly, look at how you handle missing secrets in your API. If your server's cryptographic secret is missing from the environment, what happens?

A badly designed API might fall back to an empty string, effectively turning off the encryption and letting anyone forge a token. 

A resilient engineering API will deliberately **crash**. It will throw an HTTP 500 Error and completely refuse to boot. A crashed system cannot be quietly compromised. It fails closed, forcing the engineer to fix the missing variable immediately. 

This uncompromising approach is what separates prototypes from production-ready systems. How do we test all of this? See [Chapter 7: Verification and Production](#chapter-7-verification-and-production).
