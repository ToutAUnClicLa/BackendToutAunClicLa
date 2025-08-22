import express from 'express';
import { 
  getAllProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getCategories,
  getSubcategories,
  getSubcategoryById,
  getRestaurants
} from '../controllers/productController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import { validateRequest, productSchema } from '../middlewares/validation.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/categories', getCategories);
router.get('/subcategories', getSubcategories);
router.get('/subcategories/:id', getSubcategoryById);
router.get('/restaurants', getRestaurants);
router.get('/:id', getProductById);

// Admin routes
router.post('/', authMiddleware, adminMiddleware, validateRequest(productSchema), createProduct);
router.put('/:id', authMiddleware, adminMiddleware, updateProduct);
router.delete('/:id', authMiddleware, adminMiddleware, deleteProduct);

export default router;
