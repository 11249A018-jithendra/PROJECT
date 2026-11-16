const { validationResult } = require('express-validator');

// Runs after express-validator chains: replies 400 with the first problem
// (in the same `{ message }` shape every other endpoint uses).
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const first = result.array({ onlyFirstError: true })[0];
  return res.status(400).json({ message: first.msg, field: first.path, errors: result.array() });
};

// Wraps a list of chains so a route can use `...rules(chain1, chain2)`.
const rules = (...chains) => [...chains, validate];

module.exports = { validate, rules };
