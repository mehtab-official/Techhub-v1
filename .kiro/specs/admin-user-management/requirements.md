# Requirements Document

## Introduction

This feature adds admin-only user management capabilities to the Techhub backend. It exposes three protected endpoints that allow administrators to list all registered users, change a user's role, and delete a user account. All endpoints are guarded by the existing `protect` and `isAdmin` middleware chain, ensuring only authenticated admins can access them. Admins are prevented from modifying or deleting their own account to avoid accidental privilege loss.

## Glossary

- **Admin**: A user whose `role` field equals `'admin'` in the database.
- **User**: A registered account in the system with a `role` of either `'user'` or `'admin'`.
- **UserController**: The Express controller module (`controllers/userController.js`) that implements the admin user management handler functions.
- **UserRoutes**: The Express router module (`routes/userRoutes.js`) that maps HTTP methods and paths to UserController handlers.
- **Server**: The Express application entry point (`server.js`) that mounts all route modules.
- **protect**: Existing middleware that verifies the Bearer JWT and attaches the authenticated user document (excluding `passwordHash`) to `req.user`.
- **isAdmin**: Existing middleware that checks `req.user.role === 'admin'` and returns HTTP 403 if the check fails.
- **Public_Profile**: A user document with the `passwordHash` field omitted, containing: `_id`, `fullName`, `username`, `email`, `phone`, `address`, `city`, `postalCode`, `role`, `createdAt`, `updatedAt`.
- **Self-modification**: Any request where the target user `_id` matches `req.user._id` (the authenticated admin's own account).

---

## Requirements

### Requirement 1: List All Users

**User Story:** As an admin, I want to retrieve a list of all registered users, so that I can monitor and manage the user base.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/users`, THE UserController SHALL return an HTTP 200 response containing an array of Public_Profile objects for every user in the database.
2. WHEN a GET request to `/api/users` includes a `search` query parameter, THE UserController SHALL return only users whose `fullName` or `email` contains the search string (case-insensitive).
3. WHEN a GET request to `/api/users` includes a `search` query parameter that matches no users, THE UserController SHALL return an HTTP 200 response with an empty array.
4. THE UserController SHALL exclude the `passwordHash` field from every user object in the response.
5. IF a database error occurs during the list operation, THEN THE UserController SHALL pass the error to the Express error handler via `next(err)`.

---

### Requirement 2: Update User Role

**User Story:** As an admin, I want to change a user's role to either `'user'` or `'admin'`, so that I can grant or revoke administrative privileges.

#### Acceptance Criteria

1. WHEN a PUT request is made to `/api/users/:id/role` with a valid `role` value in the request body, THE UserController SHALL update the target user's `role` field and return an HTTP 200 response containing the updated Public_Profile.
2. THE UserController SHALL accept only `'user'` or `'admin'` as valid values for the `role` field.
3. IF the `role` field in the request body is missing or is not `'user'` or `'admin'`, THEN THE UserController SHALL return an HTTP 400 response with a descriptive error message.
4. IF the request targets the authenticated admin's own account (Self-modification), THEN THE UserController SHALL return an HTTP 403 response with the message `'You cannot modify your own role'`.
5. IF the `:id` parameter does not correspond to an existing user, THEN THE UserController SHALL return an HTTP 404 response with the message `'User not found'`.
6. IF a database error occurs during the update operation, THEN THE UserController SHALL pass the error to the Express error handler via `next(err)`.

---

### Requirement 3: Delete User

**User Story:** As an admin, I want to delete a user account by ID, so that I can remove accounts that violate policies or are no longer needed.

#### Acceptance Criteria

1. WHEN a DELETE request is made to `/api/users/:id` for an existing user, THE UserController SHALL delete the user from the database and return an HTTP 200 response with the message `'User deleted successfully'`.
2. IF the request targets the authenticated admin's own account (Self-modification), THEN THE UserController SHALL return an HTTP 403 response with the message `'You cannot delete your own account'`.
3. IF the `:id` parameter does not correspond to an existing user, THEN THE UserController SHALL return an HTTP 404 response with the message `'User not found'`.
4. IF a database error occurs during the delete operation, THEN THE UserController SHALL pass the error to the Express error handler via `next(err)`.

---

### Requirement 4: Route Protection

**User Story:** As a system operator, I want all user management endpoints to be accessible only to authenticated admins, so that user data is protected from unauthorized access.

#### Acceptance Criteria

1. THE UserRoutes SHALL apply the `protect` middleware to every route before invoking any UserController handler.
2. THE UserRoutes SHALL apply the `isAdmin` middleware to every route after `protect` and before invoking any UserController handler.
3. IF a request to any user management endpoint does not include a valid Bearer token, THEN THE protect middleware SHALL return an HTTP 401 response before the UserController handler is invoked.
4. IF a request to any user management endpoint is made by an authenticated user whose `role` is not `'admin'`, THEN THE isAdmin middleware SHALL return an HTTP 403 response before the UserController handler is invoked.

---

### Requirement 5: Route Registration

**User Story:** As a developer, I want the user management routes mounted on the Express application, so that the endpoints are reachable at the correct paths.

#### Acceptance Criteria

1. THE Server SHALL mount UserRoutes at the `/api/users` path so that the three endpoints are accessible at `GET /api/users`, `PUT /api/users/:id/role`, and `DELETE /api/users/:id`.
