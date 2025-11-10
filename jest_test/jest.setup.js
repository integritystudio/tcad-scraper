// Jest setup for client-side tests

// Mock React for the DataController hook
global.React = {
  useState: jest.fn((initial) => [initial, jest.fn()]),
  useEffect: jest.fn((effect) => effect()),
};

// Add any global test setup here
