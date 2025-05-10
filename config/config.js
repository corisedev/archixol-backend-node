module.exports = {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpire: process.env.JWT_EXPIRE,
    emailVerificationExpire: '24h',
    passwordResetExpire: '1h',
    aesSecretKey: process.env.AES_SECRET_KEY
  };
  