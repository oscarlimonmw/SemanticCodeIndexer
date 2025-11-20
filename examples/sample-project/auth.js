// Example: User authentication service
class AuthService {
  constructor(config) {
    this.config = config;
    this.users = new Map();
  }

  async login(username, password) {
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }
    return this.validatePassword(password, user.hash);
  }

  async register(username, email, password) {
    if (this.users.has(username)) {
      throw new Error('User already exists');
    }
    const hash = await this.hashPassword(password);
    this.users.set(username, { email, hash });
    return { username, email };
  }

  validatePassword(password, hash) {
    // Simplified validation
    return password === hash;
  }

  async hashPassword(password) {
    // Simplified hashing
    return password + '_hashed';
  }
}

const createAuthService = (config) => {
  return new AuthService(config);
};

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

module.exports = { AuthService, createAuthService, validateEmail };
