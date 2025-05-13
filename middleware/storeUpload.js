// Custom middleware to process store details data
const processStoreDetailsData = (req, res, next) => {
  try {
    console.log("Raw request for store details update:", req.body);

    if (req.body && req.body.data) {
      // Decrypt the data field
      const bytes = CryptoJS.AES.decrypt(
        req.body.data,
        process.env.AES_SECRET_KEY
      );
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);

      console.log("Decrypted data for store details update:", decryptedData);

      // Parse the decrypted data
      const parsedData = JSON.parse(decryptedData);

      // Process logo if it's coming from a file upload
      if (req.file && req.file.filename) {
        parsedData.logo = `/uploads/store/${req.file.filename}`;
      }

      // Replace req.body with the parsed data
      req.body = parsedData;
    }

    console.log("Final request body for store details update:", req.body);
    next();
  } catch (error) {
    console.error("Processing error:", error);
    return res
      .status(400)
      .json({ error: "Failed to process request: " + error.message });
  }
};
