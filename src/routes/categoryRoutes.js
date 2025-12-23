import express from 'express';
import { body } from 'express-validator';
import { 
  getCategories, 
  createCategory, 
  deleteCategory 
} from '../controllers/categoryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Validation rules
const categoryValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Category name is required')
    .isLength({ max: 50 }).withMessage('Category name cannot exceed 50 characters'),
  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6})$/)
    .withMessage('Color must be a valid hex code')
];

// Routes
router.route('/')
  .get(getCategories)
  .post(validate(categoryValidation), createCategory);

router.route('/:id')
  .delete(deleteCategory);

export default router;