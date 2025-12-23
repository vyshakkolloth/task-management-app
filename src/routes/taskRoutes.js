import express from 'express';
import { body } from 'express-validator';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskPriority,
  shareTask,
  getSharedTasks
} from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = express.Router();


router.use(protect);


const taskValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('status')
    .optional()
    .isIn(['todo', 'in-progress', 'completed', 'archived']).withMessage('Invalid status'),
  body('dueDate')
    .optional()
    .isISO8601().withMessage('Due date must be a valid date')
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error('Due date must be in the future');
      }
      return true;
    }),
  body('estimatedHours')
    .optional()
    .isFloat({ min: 0 }).withMessage('Estimated hours must be a positive number')
];


router.route('/')
  .get(getTasks)
  .post(validate(taskValidation), createTask);

router.route('/:id')
  .get(getTask)
  .put(validate(taskValidation), updateTask)
  .delete(deleteTask);

router.put('/:id/status',
  validate([body('status').isIn(['todo', 'in-progress', 'completed', 'archived'])]),
  updateTaskStatus
);

router.put('/:id/priority',
  validate([body('priority').isIn(['low', 'medium', 'high'])]),
  updateTaskPriority
);


router.post('/:id/share',
  validate([body('userId').notEmpty().withMessage('User ID is required')]),
  shareTask
);

router.get('/shared/me', getSharedTasks);

export default router;