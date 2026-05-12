'use strict';

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
// getAllUsers — error path (Task 1.5)
// ---------------------------------------------------------------------------

describe('getAllUsers — error path', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls next(err) when User.find() rejects', async () => {
    const dbError = new Error('DB connection failed');
    User.find.mockReturnValue({
      select: jest.fn().mockRejectedValue(dbError),
    });

    const req = mockReq({ query: {} });
    const res = mockRes();
    const next = mockNext();

    await getAllUsers(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateUserRole — error paths (Task 1.10)
// ---------------------------------------------------------------------------

describe('updateUserRole — error paths', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when findByIdAndUpdate returns null', async () => {
    User.findByIdAndUpdate.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const req = mockReq({
      body: { role: 'user' },
      params: { id: 'nonExistentId' },
      user: { _id: 'adminId' },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserRole(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    const [body] = res.json.mock.calls[0];
    expect(body).toEqual({ message: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next(err) when findByIdAndUpdate rejects', async () => {
    const dbError = new Error('DB update failed');
    User.findByIdAndUpdate.mockReturnValue({
      select: jest.fn().mockRejectedValue(dbError),
    });

    const req = mockReq({
      body: { role: 'admin' },
      params: { id: 'someUserId' },
      user: { _id: 'adminId' },
    });
    const res = mockRes();
    const next = mockNext();

    await updateUserRole(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalledWith(200);
  });
});

// ---------------------------------------------------------------------------
// deleteUser — error paths (Task 1.14)
// ---------------------------------------------------------------------------

describe('deleteUser — error paths', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 404 when findByIdAndDelete returns null', async () => {
    User.findByIdAndDelete.mockResolvedValue(null);

    const req = mockReq({
      params: { id: 'nonExistentId' },
      user: { _id: 'adminId' },
    });
    const res = mockRes();
    const next = mockNext();

    await deleteUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    const [body] = res.json.mock.calls[0];
    expect(body).toEqual({ message: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next(err) when findByIdAndDelete rejects', async () => {
    const dbError = new Error('DB delete failed');
    User.findByIdAndDelete.mockRejectedValue(dbError);

    const req = mockReq({
      params: { id: 'someUserId' },
      user: { _id: 'adminId' },
    });
    const res = mockRes();
    const next = mockNext();

    await deleteUser(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalledWith(200);
  });
});
