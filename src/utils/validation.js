const { check } = require('express-validator');

exports.registerValidation = [check('name').notEmpty(), check('email').isEmail(), check('password').isLength({ min: 6 })];
exports.loginValidation = [check('email').isEmail(), check('password').exists()];
