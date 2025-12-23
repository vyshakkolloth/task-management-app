import Task from '../models/Task.js';
import Category from '../models/Category.js';
import mongoose from 'mongoose';

// Helper function to build filter query
const buildFilterQuery = (user, filters) => {
  const query = { user: user._id };
  
  // Filter by status
  if (filters.status) {
    const statuses = filters.status.split(',');
    query.status = { $in: statuses };
  }
  
  // Filter by priority
  if (filters.priority) {
    query.priority = filters.priority;
  }
  
  // Filter by category
  if (filters.category) {
    query.category = filters.category;
  }
  
  // Filter by due date range
  if (filters.dueDate) {
    if (filters.dueDate.gte) {
      query.dueDate = { ...query.dueDate, $gte: new Date(filters.dueDate.gte) };
    }
    if (filters.dueDate.lte) {
      query.dueDate = { ...query.dueDate, $lte: new Date(filters.dueDate.lte) };
    }
  }
  
  // Search by title or description
  if (filters.search) {
    query.$or = [
      { title: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
      { tags: { $regex: filters.search, $options: 'i' } }
    ];
  }
  
  return query;
};

// @desc    Get all tasks for user
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req, res) => {
  try {
    const {
      status,
      priority,
      category,
      search,
      page = 1,
      limit = 10,
      sortBy = 'dueDate:asc',
      ...filters
    } = req.query;

    // Build filter query
    const filterQuery = buildFilterQuery(req.user, {
      status,
      priority,
      category,
      search,
      dueDate: filters.dueDate
    });

    // Parse sort options
    const [sortField, sortOrder] = sortBy.split(':');
    const sortOptions = {};
    sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const [tasks, total] = await Promise.all([
      Task.find(filterQuery)
        .populate('category', 'name color')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Task.countDocuments(filterQuery)
    ]);

    // Get task statistics
    const stats = await Task.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format statistics
    const statsFormatted = {
      todo: 0,
      'in-progress': 0,
      completed: 0,
      archived: 0
    };

    stats.forEach(stat => {
      statsFormatted[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        },
        stats: statsFormatted
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
export const getTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('category', 'name color');

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        task
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
};

// @desc    Create task
// @route   POST /api/tasks
// @access  Private
export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      dueDate,
      category,
      tags,
      estimatedHours
    } = req.body;

    // Check if category exists and belongs to user
    if (category) {
      const categoryExists = await Category.findOne({
        _id: category,
        user: req.user.id
      });
      
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Category not found'
          }
        });
      }
    }

    // Create task
    const task = await Task.create({
      title,
      description,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      category,
      tags,
      estimatedHours,
      user: req.user.id
    });

    // Update category task count if category is provided
    if (category) {
      await Category.findByIdAndUpdate(category, {
        $inc: { taskCount: 1 }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: {
        task: {
          id: task._id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          user: task.user,
          createdAt: task.createdAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found'
        }
      });
    }

    // Handle category change
    const oldCategory = task.category;
    const newCategory = req.body.category;

    if (oldCategory && oldCategory.toString() !== newCategory) {
      // Decrement old category task count
      await Category.findByIdAndUpdate(oldCategory, {
        $inc: { taskCount: -1 }
      });
    }

    if (newCategory && oldCategory?.toString() !== newCategory) {
      // Check if new category exists and belongs to user
      const categoryExists = await Category.findOne({
        _id: newCategory,
        user: req.user.id
      });
      
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Category not found'
          }
        });
      }
      
      // Increment new category task count
      await Category.findByIdAndUpdate(newCategory, {
        $inc: { taskCount: 1 }
      });
    }

    // Update task
    Object.keys(req.body).forEach(key => {
      if (key !== 'user' && key !== '_id') {
        task[key] = req.body[key];
      }
    });

    await task.save();

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: {
        task
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found'
        }
      });
    }

    // Decrement category task count if task had a category
    if (task.category) {
      await Category.findByIdAndUpdate(task.category, {
        $inc: { taskCount: -1 }
      });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
};

// @desc    Update task status
// @route   PUT /api/tasks/:id/status
// @access  Private
export const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status transition
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found'
        }
      });
    }

    // Validate status transition rules
    if (task.status === 'archived' && status !== 'archived') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: 'Cannot change status from archived'
        }
      });
    }

    // Update status
    task.status = status;
    await task.save();

    res.json({
      success: true,
      message: 'Task status updated',
      data: {
        task: {
          id: task._id,
          status: task.status,
          updatedAt: task.updatedAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
};

// @desc    Update task priority
// @route   PUT /api/tasks/:id/priority
// @access  Private
export const updateTaskPriority = async (req, res) => {
  try {
    const { priority } = req.body;

    const task = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user.id
      },
      { priority },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found'
        }
      });
    }

    res.json({
      success: true,
      message: 'Task priority updated',
      data: {
        task: {
          id: task._id,
          priority: task.priority,
          updatedAt: task.updatedAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
};

// @desc    Share task with another user (Bonus)
// @route   POST /api/tasks/:id/share
// @access  Private
export const shareTask = async (req, res) => {
  try {
    const { userId } = req.body;

    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found'
        }
      });
    }

    // Check if user exists
    const userToShare = await User.findById(userId);
    if (!userToShare) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Check if already shared
    if (task.sharedWith.includes(userId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_SHARED',
          message: 'Task already shared with this user'
        }
      });
    }

    // Add user to sharedWith array
    task.sharedWith.push(userId);
    await task.save();

    res.json({
      success: true,
      message: 'Task shared successfully',
      data: {
        task: {
          id: task._id,
          sharedWith: task.sharedWith
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
};

// @desc    Get tasks shared with me (Bonus)
// @route   GET /api/tasks/shared
// @access  Private
export const getSharedTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      sharedWith: req.user.id
    })
      .populate('user', 'username email')
      .populate('category', 'name color');

    res.json({
      success: true,
      data: {
        tasks
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message
      }
    });
  }
};