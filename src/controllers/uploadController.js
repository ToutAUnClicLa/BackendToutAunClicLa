import { supabaseAdmin } from '../config/supabase.js';
import crypto from 'crypto';

export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se proporcionó ninguna imagen.' });
        }

        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
             return res.status(400).json({ success: false, message: 'Formato de archivo no válido. Solo se permite JPEG, PNG o WEBP.' });
        }

        const BUCKET_NAME = 'restaurantes-assets';
        const ext = req.file.mimetype.split('/')[1]; // Safer than originalname
        const fileName = `${req.restauranteId ? `restaurante-${req.restauranteId}` : 'admin'}/${crypto.randomUUID()}.${ext}`;

        let uploadResult = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        // Si el bucket no existe, atrapar el error e intentar crearlo (requiere permisos de Service Role, lo cual tenemos)
        if (uploadResult.error && (uploadResult.error.message.includes('Bucket not found') || uploadResult.error.message.includes('does not exist') || uploadResult.error.name === 'NotFoundError')) {
            console.log(`El bucket '${BUCKET_NAME}' no existe. Intentando crearlo automáticamente...`);
            const { error: createBucketError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
                public: true, // Importante para que las imágenes se puedan ver en la web
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
                fileSizeLimit: 10485760 // 10MB
            });

            if (createBucketError) {
                console.error("Error al crear el bucket:", createBucketError);
                return res.status(500).json({ success: false, message: 'Error de configuración de almacenamiento en la nube.', detail: createBucketError.message });
            }

            // Reintento de subida
            uploadResult = await supabaseAdmin.storage
                .from(BUCKET_NAME)
                .upload(fileName, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: true
                });
        }

        if (uploadResult.error) {
            console.error('Error subiendo imagen a Supabase:', uploadResult.error);
            return res.status(500).json({ success: false, message: 'Error al subir la imagen al servidor.', detail: uploadResult.error.message });
        }

        // Extraer URL pública
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uploadResult.data.path);

        return res.status(200).json({
            success: true,
            url: publicUrl,
            path: uploadResult.data.path
        });

    } catch (error) {
        console.error('Error inesperado en uploadImage:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
};
