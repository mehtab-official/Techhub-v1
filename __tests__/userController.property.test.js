'use strict';

const fc = require('fast-check');

// Mock the User model before requiring the controller
jest.mock('../models/user');

const User = require('../models/user');
const { getAllUsers, updateUserRole, deleteUser } = require('../controllers/userController');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = () => jest.fn();

const mockReq = (overrides = {}) => ({
  query: {},
  body: {},
  params: {},
  user: { _id: 'adminId' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const userArb = fc.record({
  _id:          fc.uuid(),
  fullName:     fc.string({ minLength: 1, maxLength: 50 }),
  username:     fc.string({ minLength: 1, maxLength: 30 }),
  email:        fc.emailAddress(),
  passwordHash: fc.string({ minLength: 10, maxLength: 60 }),
  phone:        fc.string({ minLength: 5, maxLength: 20 }),
  address:      fc.string({ minLength: 1, maxLength: 100 }),
  city:         fc.string({ minLength: 1, maxLength: 50 }),
  postalCode:   fc.string({ minLength: 3, maxLength: 10 }),
  role:         fc.constantFrom('user', 'admin'),
  createdAt:    fc.date(),
  updatedAt:    fc.date(),
});

const userIdArb = fc.uuid();

// ---------------------------------------------------------------------------
// Helper: escape regex special chars (mirrors controller logic)
// ---------------------------------------------------------------------------
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, (char) => '\\' + char);

// ---------------------------------------------------------------------------
// Property 1: getAllUsers returns all users as Public_Profile objects
// ---------------------------------------------------------------------------

describe('Property 1: getAllUsers returns all users as Public_Profile objects', () => {
  // Feature: admin-user-management, Property 1: getAllUsers returns all users as Public_Profile objects

  beforeEach(() => jest.clearAllMocks());

  test('response length equals input length and no element contains passwordHash', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(userArb), async (users) => {
        // Mock User.find to return a chainable .select() that returns the users
        User.find.mockReturnValue({
          select: jest.fn().mockResolvedValue(users),
        });

        const req = mockReq({ query: {} });
        const res = mockRes();
        const next = mockNext();

        await getAllUsers(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        const [responseBody] = res.json.mock.calls[0];

        // Length must equal input length
        expect(responseBody).toHaveLength(users.length);

        // No element should contain passwordHash
        for (const profile of responseBody) {
          expect(profile).not.toHaveProperty('passwordHash');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: search filter is correct and complete
// ---------------------------------------------------------------------------

describe('Property 2: search filter is correct and complete', () => {
  // Feature: admin-user-management, Property 2: search filter is correct and complete

  beforeEach(() => jest.clearAllMocks());

  test('response contains exactly the matching subset (case-insensitive on fullName or email)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(userArb), fc.string(), async (users, search) => {
        // Mock User.find to simulate the actual filtering logic
        User.find.mockImplementation((filter) => {
          let filtered;
          if (filter && filter.$or) {
            // Extract the regex from the filter (it's the same regex the controller builds)
            const regex = filter.$or[0].fullName;
            filtered = users.filter(
              (u) => regex.test(u.fullName) || regex.test(u.email)
            );
          } else {
            filtered = users;
          }
          return {
            select: jest.fn().mockResolvedValue(filtered),
          };
        });

        const req = mockReq({ query: { search } });
        const res = mockRes();
        const next = mockNext();

        await getAllUsers(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        const [responseBody] = res.json.mock.calls[0];

        // Compute expected subset using the same logic as the controller
        let expected;
        if (search && search.trim() !== '') {
          const regex = new RegExp(escapeRegex(search), 'i');
          expected = users.filter(
            (u) => regex.test(u.fullName) || regex.test(u.email)
          );
        } else {
          expected = users;
        }

        expect(responseBody).toHaveLength(expected.length);

        // Every returned profile's _id should be in the expected set
        const expectedIds = new Set(expected.map((u) => u._id));
        for (const profile of responseBody) {
          expect(expectedIds.has(profile._id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: passwordHash is never present in any response
// ---------------------------------------------------------------------------

describe('Property 3: passwordHash is never present in any response', () => {
  // Feature: admin-user-management, Property 3: passwordHash is never present in any response

  beforeEach(() => jest.clearAllMocks());

  test('no response element contains passwordHash at any nesting level', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(userArb), async (users) => {
        User.find.mockReturnValue({
          select: jest.fn().mockResolvedValue(users),
        });

        const req = mockReq({ query: {} });
        const res = mockRes();
        const next = mockNext();

        await getAllUsers(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        const [responseBody] = res.json.mock.calls[0];

        const hasPasswordHash = (obj) => {
          if (obj === null || typeof obj !== 'object') return false;
          if ('passwordHash' in obj) return true;
          return Object.values(obj).some(hasPasswordHash);
        };

        for (const profile of responseBody) {
          expect(hasPasswordHash(profile)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: role validation rejects all non-enum values
// ---------------------------------------------------------------------------

describe('Property 4: role validation rejects all non-enum values', () => {
  // Feature: admin-user-management, Property 4: role validation rejects all non-enum values

  beforeEach(() => jest.clearAllMocks());

  test('HTTP 400 for any role value that is not "user" or "admin", DB update never called', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter((s) => s !== 'user' && s !== 'admin'),
        async (invalidRole) => {
          const req = mockReq({
            body: { role: invalidRole },
            params: { id: 'someOtherId' },
            user: { _id: 'adminId' },
          });
          const res = mockRes();
          const next = mockNext();

          await updateUserRole(req, res, next);

          expect(res.status).toHaveBeenCalledWith(400);
          expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5 (updateUserRole): self-modification guard fires for any admin identity
// ---------------------------------------------------------------------------

describe('Property 5 (updateUserRole): self-modification guard fires for any admin identity', () => {
  // Feature: admin-user-management, Property 5: self-modification guard fires for any admin identity

  beforeEach(() => jest.clearAllMocks());

  test('PUT with own ID returns HTTP 403 with correct message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ _id: fc.uuid() }),
        async (admin) => {
          const req = mockReq({
            body: { role: 'user' },
            params: { id: admin._id },
            user: { _id: admin._id },
          });
          const res = mockRes();
          const next = mockNext();

          await updateUserRole(req, res, next);

          expect(res.status).toHaveBeenCalledWith(403);
          const [body] = res.json.mock.calls[0];
          expect(body).toEqual({ message: 'You cannot modify your own role' });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: successful role update returns updated Public_Profile
// ---------------------------------------------------------------------------

describe('Property 6: successful role update returns updated Public_Profile', () => {
  // Feature: admin-user-management, Property 6: successful role update returns updated Public_Profile

  beforeEach(() => jest.clearAllMocks());

  test('HTTP 200 with updated role and no passwordHash', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(userIdArb, fc.constantFrom('user', 'admin')),
        async ([userId, role]) => {
          // Build a mock updated user document (without passwordHash, as .select('-passwordHash') would do)
          const updatedUser = {
            _id:        userId,
            fullName:   'Test User',
            username:   'testuser',
            email:      'test@example.com',
            phone:      '1234567890',
            address:    '123 Main St',
            city:       'Testville',
            postalCode: '12345',
            role,
            createdAt:  new Date(),
            updatedAt:  new Date(),
          };

          User.findByIdAndUpdate.mockReturnValue({
            select: jest.fn().mockResolvedValue(updatedUser),
          });

          const req = mockReq({
            body: { role },
            params: { id: userId },
            user: { _id: 'differentAdminId' },
          });
          const res = mockRes();
          const next = mockNext();

          await updateUserRole(req, res, next);

          expect(res.status).toHaveBeenCalledWith(200);
          const [body] = res.json.mock.calls[0];
          expect(body.role).toBe(role);
          expect(body).not.toHaveProperty('passwordHash');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5 (deleteUser): self-modification guard fires for any admin identity
// ---------------------------------------------------------------------------

describe('Property 5 (deleteUser): self-modification guard fires for any admin identity', () => {
  // Feature: admin-user-management, Property 5: self-modification guard fires for any admin identity

  beforeEach(() => jest.clearAllMocks());

  test('DELETE with own ID returns HTTP 403 with correct message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({ _id: fc.uuid() }),
        async (admin) => {
          const req = mockReq({
            params: { id: admin._id },
            user: { _id: admin._id },
          });
          const res = mockRes();
          const next = mockNext();

          await deleteUser(req, res, next);

          expect(res.status).toHaveBeenCalledWith(403);
          const [body] = res.json.mock.calls[0];
          expect(body).toEqual({ message: 'You cannot delete your own account' });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: successful delete returns success message
// ---------------------------------------------------------------------------

describe('Property 7: successful delete returns success message', () => {
  // Feature: admin-user-management, Property 7: successful delete returns success message

  beforeEach(() => jest.clearAllMocks());

  test('HTTP 200 with { message: "User deleted successfully" }', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        async (userId) => {
          // Mock findByIdAndDelete to return a non-null user (user exists)
          User.findByIdAndDelete.mockResolvedValue({ _id: userId, fullName: 'Some User' });

          const req = mockReq({
            params: { id: userId },
            user: { _id: 'differentAdminId' },
          });
          const res = mockRes();
          const next = mockNext();

          await deleteUser(req, res, next);

          expect(res.status).toHaveBeenCalledWith(200);
          const [body] = res.json.mock.calls[0];
          expect(body).toEqual({ message: 'User deleted successfully' });
        }
      ),
      { numRuns: 100 }
    );
  });
});
