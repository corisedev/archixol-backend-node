// middleware/searchValidation.js
exports.validateSearchQuery = (req, res, next) => {
  const { query } = req.body;

  if (!query || query.trim() === "") {
    return res.status(400).json({ error: "Search query is required" });
  }

  next();
};
