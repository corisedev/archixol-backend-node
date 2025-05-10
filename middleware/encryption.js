const CryptoJS = require("crypto-js");
const config = require("../config/config");

// Get AES secret key from environment or config
const AES_SECRET_KEY = process.env.AES_SECRET_KEY || config.aesSecretKey;

// Decrypt incoming request data
exports.decryptRequest = (req, res, next) => {
  try {
    console.log("Original request body:", req.body);

    if (req.body && req.body.data) {
      // Log encrypted data
      console.log("Encrypted data:", req.body.data);

      // Decrypt the data
      const bytes = CryptoJS.AES.decrypt(req.body.data, AES_SECRET_KEY);
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

      // Log decrypted string
      console.log("Decrypted string:", decryptedData);

      // Parse the decrypted data
      const parsedData = JSON.parse(decryptedData);

      // Log parsed data
      console.log("Parsed data:", parsedData);

      // Replace req.body with the decrypted data
      req.body = parsedData;
    }

    console.log("Final request body:", req.body);
    next();
  } catch (error) {
    console.error("Decryption error:", error);
    return res.status(400).json({ error: "Invalid encrypted data" });
  }
};

// Export AES_SECRET_KEY for use in other modules
exports.AES_SECRET_KEY = AES_SECRET_KEY;

// Encrypt outgoing response data
exports.encryptResponse = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (body) {
    try {
      // Only encrypt JSON responses
      if (body && typeof body === "string" && body.startsWith("{")) {
        const encryptedData = CryptoJS.AES.encrypt(
          body,
          AES_SECRET_KEY
        ).toString();

        originalSend.call(this, JSON.stringify({ data: encryptedData }));
      } else {
        originalSend.call(this, body);
      }
    } catch (error) {
      console.error("Encryption error:", error);
      originalSend.call(this, JSON.stringify({ message: "Encryption error" }));
    }
  };

  next();
};
