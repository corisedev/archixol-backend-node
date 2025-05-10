const CryptoJS = require("crypto-js");
exports.encryptData = (data) => {
  const ciphertext = CryptoJS.AES.encrypt(
    JSON.stringify(data),
    process.env.AES_SECRET_KEY
  ).toString();
  return ciphertext;
};
