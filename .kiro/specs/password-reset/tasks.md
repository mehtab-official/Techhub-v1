# Implementation Plan: Password Reset

## Overview

Implement a secure, token-based password reset flow on the existing Techhub-v1 Express/MongoDB backend. The work is broken into six incremental steps: schema changes, email utility, controller functions, route registration, environment variable documentation, and tests. Each step builds on the previous one and ends with all code wired together.

Tests use **Jest** (unit + property) and **Supertest** (integration). Property-based tests use **fast-check**. Install dev dependencies before starting the test tasks:

```
npm install --save-dev jest fast-check supertest
```

Add a `test` script to `package.json`:
```json
"test": "jest --runInBand"
```

---

## Tasks

- [x] 1. Extend the User model with reset-token fields
  - Open `models/user.js` and add two new optional fields to `userSchema` after the `role` field:
    - `resetPasswordToken: { type: String }` — stores the SHA-256 hex digest of the raw token
    - `resetPasswordExpires: { type: Date }` — stores the UTC expiry timestamp (now + 1 hour)
  - Neither field should have a `required` constraint or a `default` value so they remain `undefined` on new registrations
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Create `utils/sendEmail.js`
  - [x] 2.1 Implement the `sendEmail` utility
    - Create `utils/sendEmail.js` exporting a single async function `sendEmail({ to, subject, text })`
    - Inside the function, create a nodemailer transport using `nodemailer.createTransport` with `service: 'gmail'` and `auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }`
    - Call `transport.sendMail({ from: process.env.GMAIL_USER, to, subject, text })` and `await` it
    - The function should resolve on success and let the transport error propagate (reject) on failure — no internal try/catch
    - Install nodemailer: `npm install nodemailer`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.2 Write unit tests for `sendEmail`
    - Create `__tests__/unit/sendEmail.test.js`
    - Mock `nodemailer.createTransport` with `jest.mock('nodemailer')`
    - Test: transport is created with `service: 'gmail'` and the correct env-var credentials
    - Test: `from` field in `sendMail` call equals `process.env.GMAIL_USER`
    - Test: the returned Promise resolves when `sendMail` resolves
    - Test: the returned Promise rejects with the transport error when `sendMail` rejects
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement `forgotPassword` controller function
  - [x] 3.1 Add `forgotPassword` to `controllers/authController.js`
    - Add `const crypto = require('crypto')` and `const sendEmail = require('../utils/sendEmail')` at the top of the file
    - Implement `forgotPassword` as an `async (req, res, next)` function following the pseudocode in the design document:
      1. Return 400 `"Email is required"` if `req.body.email` is missing
      2. `User.findOne({ email })` — return 404 `"No account found with that email address"` if null
      3. Generate `rawToken = crypto.randomBytes(32).toString('hex')`
      4. Compute `tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')`
      5. Set `user.resetPasswordToken = tokenHash` and `user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000)`
      6. `await user.save()`
      7. Construct `resetURL = \`${process.env.FRONT_URL}/reset-password/${rawToken}\``
      8. `await sendEmail(...)` inside a try/catch — on catch: clear both token fields, `await user.save()`, return 500 `"Email could not be sent. Please try again later."`
      9. On success return 200 `"Password reset link sent to your email"`
    - Wrap the entire function body in a try/catch that calls `next(err)` for unexpected errors
    - Add `forgotPassword` to the `module.exports` object
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 3.2 Write unit tests for `forgotPassword`
    - Create `__tests__/unit/forgotPassword.test.js`
    - Mock `../models/user` and `../utils/sendEmail` with `jest.mock`
    - Test: returns 400 when `email` is missing from request body
    - Test: returns 404 when `User.findOne` returns null
    - Test: returns 200 and calls `sendEmail` with correct `to`, `subject`, and a `text` containing the reset URL when user is found and email succeeds
    - Test: returns 500 and clears `resetPasswordToken` / `resetPasswordExpires` (both `undefined`) and calls `user.save()` a second time when `sendEmail` rejects
    - _Requirements: 3.1, 3.2, 3.8, 3.9, 3.10_

  - [ ]* 3.3 Write property test — Property 1: token generation format
    - Create `__tests__/property/tokenGeneration.property.test.js`
    - **Property 1: Token generation always produces a valid 64-character hex string**
    - Use `fc.integer({ min: 1, max: 1000 })` to drive N repeated calls to `crypto.randomBytes(32).toString('hex')` and assert each result matches `/^[0-9a-f]{64}$/`
    - Run a minimum of 100 iterations
    - Tag comment: `// Feature: password-reset, Property 1: token generation always produces a valid 64-character hex string`
    - **Validates: Requirements 3.3**

  - [ ]* 3.4 Write property test — Property 3: reset token expiry window
    - Create `__tests__/property/resetExpiry.property.test.js`
    - **Property 3: Reset token expiry is always set to approximately one hour in the future**
    - Use `fc.record({ email: fc.emailAddress() })` with a mocked user; for each sample record `before = Date.now()`, compute `expires = new Date(Date.now() + 60 * 60 * 1000)`, record `after = Date.now()`, and assert `expires.getTime() >= before + 3_600_000` and `expires.getTime() <= after + 3_600_000 + 5000`
    - Run a minimum of 100 iterations
    - Tag comment: `// Feature: password-reset, Property 3: reset token expiry is always set to approximately one hour in the future`
    - **Validates: Requirements 3.5**

  - [ ]* 3.5 Write property test — Property 4: reset URL construction
    - Create `__tests__/property/resetUrl.property.test.js`
    - **Property 4: Reset URL always embeds the raw token under the correct path**
    - Use `fc.hexaString({ minLength: 64, maxLength: 64 })` for the raw token and `fc.webUrl()` for `FRONT_URL`; for each pair set `process.env.FRONT_URL` and construct the URL as the handler does, then assert it equals `\`${FRONT_URL}/reset-password/${rawToken}\`` and that the email text body contains that URL
    - Run a minimum of 100 iterations
    - Tag comment: `// Feature: password-reset, Property 4: reset URL always embeds the raw token under the correct path`
    - **Validates: Requirements 3.7**

  - [ ]* 3.6 Write property test — Property 5: token cleanup on email failure
    - Create `__tests__/property/tokenCleanup.property.test.js`
    - **Property 5: Email send failure always results in token fields being cleared**
    - Use `fc.string()` as the rejection reason; for each sample simulate the catch branch of `forgotPassword` (set token fields then clear them) and assert both `resetPasswordToken` and `resetPasswordExpires` are `undefined` after the cleanup
    - Run a minimum of 100 iterations
    - Tag comment: `// Feature: password-reset, Property 5: email send failure always results in token fields being cleared`
    - **Validates: Requirements 3.9**

- [x] 4. Implement `resetPassword` controller function
  - [x] 4.1 Add `resetPassword` to `controllers/authController.js`
    - Implement `resetPassword` as an `async (req, res, next)` function following the pseudocode in the design document:
      1. Compute `tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex')`
      2. `User.findOne({ resetPasswordToken: tokenHash, resetPasswordExpires: { $gt: Date.now() } })` — return 400 `"Password reset token is invalid or has expired"` if null
      3. Return 400 `"New password is required"` if `req.body.password` is missing
      4. `user.passwordHash = await bcrypt.hash(req.body.password, 10)`
      5. Set `user.resetPasswordToken = undefined` and `user.resetPasswordExpires = undefined`
      6. `await user.save()`
      7. Return 200 `"Password has been reset successfully"`
    - Wrap the entire function body in a try/catch that calls `next(err)` for unexpected errors
    - Add `resetPassword` to the `module.exports` object alongside `forgotPassword`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 4.2 Write unit tests for `resetPassword`
    - Create `__tests__/unit/resetPassword.test.js`
    - Mock `../models/user` with `jest.mock`
    - Test: returns 400 `"Password reset token is invalid or has expired"` when `User.findOne` returns null
    - Test: returns 400 `"New password is required"` when user is found but `req.body.password` is missing
    - Test: returns 200 `"Password has been reset successfully"` when user is found and password is present; assert `user.resetPasswordToken` and `user.resetPasswordExpires` are `undefined` on the saved document
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 4.3 Write property test — Property 2: SHA-256 round-trip consistency
    - Create `__tests__/property/tokenHashing.property.test.js`
    - **Property 2: Token hashing is deterministic and produces a consistent round-trip**
    - Use `fc.hexaString({ minLength: 1 })` as the raw token; for each sample compute `hash1 = sha256(rawToken)` and `hash2 = sha256(rawToken)` independently and assert `hash1 === hash2` and that both match `/^[0-9a-f]{64}$/`
    - Run a minimum of 100 iterations
    - Tag comment: `// Feature: password-reset, Property 2: token hashing is deterministic and produces a consistent round-trip`
    - **Validates: Requirements 3.4, 4.1**

  - [ ]* 4.4 Write property test — Property 6: token cleanup on successful reset
    - Add to `__tests__/property/tokenCleanup.property.test.js` (same file as Property 5)
    - **Property 6: Successful password reset always clears token fields**
    - Use `fc.hexaString({ minLength: 64, maxLength: 64 })` for token and `fc.string({ minLength: 1 })` for password; simulate the success branch of `resetPassword` (set token fields then clear them) and assert both `resetPasswordToken` and `resetPasswordExpires` are `undefined` after the save
    - Run a minimum of 100 iterations
    - Tag comment: `// Feature: password-reset, Property 6: successful password reset always clears token fields`
    - **Validates: Requirements 4.6**

  - [ ]* 4.5 Write property test — Property 7: bcrypt round-trip
    - Create `__tests__/property/bcryptRoundTrip.property.test.js`
    - **Property 7: New password hash always verifies against the original plaintext**
    - Use `fc.string({ minLength: 1, maxLength: 72 })` for the password (bcrypt max is 72 bytes); for each sample compute `hash = await bcrypt.hash(password, 10)` and assert `await bcrypt.compare(password, hash) === true`
    - Run a minimum of 100 iterations (note: bcrypt is slow — consider reducing to 10 iterations with salt rounds of 1 for the test to keep CI fast, but document the trade-off)
    - Tag comment: `// Feature: password-reset, Property 7: new password hash always verifies against the original plaintext`
    - **Validates: Requirements 4.5**

- [x] 5. Checkpoint — verify controller exports and utility before wiring routes
  - Ensure all tests pass so far, ask the user if questions arise.

- [x] 6. Register new routes in `routes/authRoutes.js`
  - Open `routes/authRoutes.js` and add the two new imports/routes:
    - `router.post('/forgot-password', authController.forgotPassword)`
    - `router.post('/reset-password/:token', authController.resetPassword)`
  - Neither route should use the `protect` middleware — they are public endpoints
  - No changes to `server.js` are needed; the router is already mounted at `/api/auth`
  - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 6.1 Write integration test for route registration
    - Create `__tests__/integration/authRoutes.test.js`
    - Use `supertest` to send requests against the Express app (import `app` from `server.js` or extract it to a separate `app.js` if needed)
    - Test: `POST /api/auth/forgot-password` with an empty body returns a non-404 status (400 is expected — proves the route is registered and reaches the handler)
    - Test: `POST /api/auth/reset-password/sometoken` with an empty body returns a non-404 status (400 is expected — proves the route is registered and reaches the handler)
    - Test: neither route requires an `Authorization` header (sending without one should not return 401)
    - Mock the MongoDB connection in the test setup to avoid needing a live database
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Add environment variable placeholders to `.env`
  - Open `.env` and append the following block (do not overwrite existing variables):
    ```
    # Password Reset — Gmail transport
    GMAIL_USER=your-email@gmail.com
    GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
    ```
  - These are placeholder values; real credentials must be supplied before the feature can send email
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Final checkpoint — full test suite green
  - Run `npm test` and ensure all unit, property, and integration tests pass.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness guarantees; unit tests cover specific scenarios and error paths
- The bcrypt property test (Property 7) is intentionally slow — reduce salt rounds to 1 inside the test only to keep CI fast
- `FRONT_URL` is already present in `.env` and used by the CORS config; reuse it for reset URL construction without adding a duplicate entry
- The `nodemailer` production dependency and `jest`, `fast-check`, `supertest` dev dependencies must be installed before running tests
