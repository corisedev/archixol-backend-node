module.exports = {
  jwtSecret: process.env.JWT_SECRET || "archixol_user_backend",
  jwtExpire: process.env.JWT_EXPIRE || "7d",
  emailVerificationExpire: "24h",
  passwordResetExpire: "1h",
  aesSecretKey: process.env.AES_SECRET_KEY || "1234567890123456",
};
