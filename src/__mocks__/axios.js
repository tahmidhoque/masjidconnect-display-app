// Mock axios for Jest tests
const mockAxiosInstance = {
  request: jest.fn(() => Promise.resolve({ data: {} })),
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  patch: jest.fn(() => Promise.resolve({ data: {} })),
  head: jest.fn(() => Promise.resolve({ data: {} })),
  options: jest.fn(() => Promise.resolve({ data: {} })),
  interceptors: {
    request: {
      use: jest.fn(),
      eject: jest.fn(),
      handlers: [],
    },
    response: {
      use: jest.fn(),
      eject: jest.fn(),
      handlers: [],
    },
  },
  defaults: {
    headers: {
      common: {},
      get: {},
      post: {},
      put: {},
      patch: {},
      delete: {},
    },
  },
};

const axiosMock = jest.fn(() => Promise.resolve({ data: {} }));
axiosMock.create = jest.fn(() => mockAxiosInstance);
axiosMock.isAxiosError = jest.fn((error) => {
  return error && error.isAxiosError === true;
});
axiosMock.Cancel = jest.fn();
axiosMock.CancelToken = jest.fn();
axiosMock.isCancel = jest.fn();
axiosMock.all = jest.fn();
axiosMock.spread = jest.fn();

// Ensure create always returns the mock instance
axiosMock.create.mockImplementation(() => mockAxiosInstance);

module.exports = axiosMock;
module.exports.default = axiosMock;
module.exports.create = axiosMock.create;
module.exports.isAxiosError = axiosMock.isAxiosError;
