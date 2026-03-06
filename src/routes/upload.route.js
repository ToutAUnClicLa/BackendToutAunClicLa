import express from 'express';
import multer from 'multer';
import { uploadImage } from '../controllers/uploadController.js';
import { restaurantAuthMiddleware } from '../middlewares/restaurantAuth.middleware.js';

const router = express.Router();

// Configuración de multer en memoria
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes.'));
        }
    }
});

// Ruta protegida para subir imágenes (usada por dueños de restaurante)
router.post('/image', restaurantAuthMiddleware, upload.single('file'), uploadImage);

export default router;
