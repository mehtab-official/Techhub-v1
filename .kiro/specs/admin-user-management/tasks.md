# Implementation Plan: Admin User Management

## Overview

Implement three admin-only REST endpoints (`GET /api/users`, `PUT /api/users/:id/role`, `DELETE /api/users/:id`) by creating `controllers/userController.js` and `routes/userRoutes.js`, then mounting the router in `server.js`. All endpoints are protected by the existing `protect` + `isAdmin` middleware chain.

## Tasks

- [x] 1. Create `controllers/userController.js` with core helpers and handlers
  - [x] 1.1 Implement `buildPublicProfile` helper and `getAllUsers` handler
    - Create `controllers/userController.js`
    - Define the private `buildPublicProfile(user)` helper that maps a Mongoose User document to the Public_Profile shape (omitting `passwordHash` and reset-token fields)
    - Implement `getAllUsers`: build an optional case-insensitive regex filter from `req.query.search` (escape special regex characters for ReDoS prevention), call `User.find(filter).select('-passwordHash')`, return HTTP 200 with `users.map(buildPublicProfile)`, forward DB errors via `next(err)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Write property test for `getAllUsers` — Property 1: returns all users as Public_Profile objects
    - **Property 1: getAllUsers returns all users as Public_Profile objects**
    - **Validates: Requirements 1.1, 1.4**
    - Create `__tests__/userController.property.test.js`
    - Use `fc.array(fc.record({ fullName, email, ... }))` to generate user sets; mock `User.find`; assert response length equals input length and no element contains `passwordHash`
    - Tag: `// Feature: admin-user-management, Property 1: getAllUsers returns all users as Public_Profile objects`

  - [x] 1.3 Write property test for `getAllUsers` — Property 2: search filter is correct and complete
    - **Property 2: Search filter is correct and complete**
    - **Validates: Requirements 1.2, 1.3**
    - Use `fc.tuple(fc.array(userArb), fc.string())` to generate user sets and search strings; assert response contains exactly the matching subset (case-insensitive on `fullName` or `email`)
    - Tag: `// Feature: admin-user-management, Property 2: search filter is correct and complete`

  - [x] 1.4 Write property test for `getAllUsers` — Property 3: passwordHash is never present in any response
    - **Property 3: passwordHash is never present in any response**
    - **Validates: Requirements 1.4**
    - Use `fc.array(userArb)` with `passwordHash` included in generated documents; assert no response element contains `passwordHash` at any nesting level
    - Tag: `// Feature: admin-user-management, Property 3: passwordHash is never present in any response`

  - [x] 1.5 Write unit tests for `getAllUsers` error path
    - Test that `getAllUsers` calls `next(err)` when `User.find()` rejects
    - Create `__tests__/userController.unit.test.js`
    - _Requirements: 1.5_

  - [x] 1.6 Implement `updateUserRole` handler
    - Add `updateUserRole` to `controllers/userController.js`
    - Self-modification guard: if `req.user._id.toString() === req.params.id`, return HTTP 403 `{ message: 'You cannot modify your own role' }`
    - Role validation: if `role` is not `'user'` or `'admin'`, return HTTP 400 with descriptive message
    - Call `User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true }).select('-passwordHash')`; return HTTP 404 if `null`, else HTTP 200 with `buildPublicProfile(user)`; forward DB errors via `next(err)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.7 Write property test for `updateUserRole` — Property 4: role validation rejects all non-enum values
    - **Property 4: Role validation rejects all non-enum values**
    - **Validates: Requirements 2.2, 2.3**
    - Use `fc.string().filter(s => s !== 'user' && s !== 'admin')` to generate invalid role values; assert HTTP 400 and that the DB update is never called
    - Tag: `// Feature: admin-user-management, Property 4: role validation rejects all non-enum values`

  - [x] 1.8 Write property test for `updateUserRole` — Property 5: self-modification guard fires for any admin identity
    - **Property 5: Self-modification guard fires for any admin identity**
    - **Validates: Requirements 2.4, 3.2**
    - Use `fc.record({ _id: fc.uuid() })` for admin identity; assert PUT with own ID returns HTTP 403 `'You cannot modify your own role'`
    - Tag: `// Feature: admin-user-management, Property 5: self-modification guard fires for any admin identity`

  - [x] 1.9 Write property test for `updateUserRole` — Property 6: successful role update returns updated Public_Profile
    - **Property 6: Successful role update returns updated Public_Profile**
    - **Validates: Requirements 2.1, 1.4**
    - Use `fc.tuple(userIdArb, fc.constantFrom('user', 'admin'))` to generate valid update scenarios; assert HTTP 200, `role` field equals submitted value, and `passwordHash` is absent
    - Tag: `// Feature: admin-user-management, Property 6: successful role update returns updated Public_Profile`

  - [x] 1.10 Write unit tests for `updateUserRole` error paths
    - Test 404 when `findByIdAndUpdate` returns `null`
    - Test `next(err)` when `findByIdAndUpdate` rejects
    - _Requirements: 2.5, 2.6_

  - [x] 1.11 Implement `deleteUser` handler
    - Add `deleteUser` to `controllers/userController.js`
    - Self-deletion guard: if `req.user._id.toString() === req.params.id`, return HTTP 403 `{ message: 'You cannot delete your own account' }`
    - Call `User.findByIdAndDelete(id)`; return HTTP 404 if `null`, else HTTP 200 `{ message: 'User deleted successfully' }`; forward DB errors via `next(err)`
    - Export `getAllUsers`, `updateUserRole`, `deleteUser`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.12 Write property test for `deleteUser` — Property 5 (delete branch): self-modification guard fires for any admin identity
    - **Property 5 (delete branch): Self-modification guard fires for any admin identity**
    - **Validates: Requirements 3.2**
    - Use `fc.record({ _id: fc.uuid() })` for admin identity; assert DELETE with own ID returns HTTP 403 `'You cannot delete your own account'`
    - Tag: `// Feature: admin-user-management, Property 5: self-modification guard fires for any admin identity`

  - [x] 1.13 Write property test for `deleteUser` — Property 7: successful delete returns success message
    - **Property 7: Successful delete returns success message**
    - **Validates: Requirements 3.1**
    - Use `fc.string()` for user ID (mocked DB); assert HTTP 200 `{ message: 'User deleted successfully' }` and that the user no longer exists in the mocked store
    - Tag: `// Feature: admin-user-management, Property 7: successful delete returns success message`

  - [x] 1.14 Write unit tests for `deleteUser` error paths
    - Test 404 when `findByIdAndDelete` returns `null`
    - Test `next(err)` when `findByIdAndDelete` rejects
    - _Requirements: 3.3, 3.4_

- [ ] 2. Checkpoint — Ensure all controller tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Create `routes/userRoutes.js` and mount in `server.js`
  - [x] 3.1 Create `routes/userRoutes.js`
    - Create `routes/userRoutes.js`
    - Import `protect` and `isAdmin` from `../middleware/authMiddleware`
    - Import `getAllUsers`, `updateUserRole`, `deleteUser` from `../controllers/userController`
    - Register routes with per-route middleware: `router.get('/', protect, isAdmin, getAllUsers)`, `router.put('/:id/role', protect, isAdmin, updateUserRole)`, `router.delete('/:id', protect, isAdmin, deleteUser)`
    - Export the router
    - _Requirements: 4.1, 4.2_

  - [ ] 3.2 Write unit tests for route protection
    - Test that an unauthenticated request to each endpoint returns HTTP 401 (protect middleware fires)
    - Test that a non-admin authenticated request to each endpoint returns HTTP 403 (isAdmin middleware fires)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 3.3 Mount `userRoutes` in `server.js`
    - Add `const userRoutes = require('./routes/userRoutes');` with the other route imports
    - Add `app.use('/api/users', userRoutes);` after the existing `app.use('/api/orders', ...)` line
    - _Requirements: 5.1_

  - [ ] 3.4 Write smoke test for route registration
    - Test that `GET /api/users`, `PUT /api/users/:id/role`, and `DELETE /api/users/:id` are reachable (not 404) in the mounted app
    - _Requirements: 5.1_

- [ ] 4. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use `fast-check` with a minimum of 100 iterations per property (`{ numRuns: 100 }`)
- Unit tests and property tests live in `__tests__/userController.unit.test.js` and `__tests__/userController.property.test.js` respectively
- The design's pseudocode in `design.md` provides the exact logic for each handler — refer to it during implementation
