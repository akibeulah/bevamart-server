const { v2: cloudinary } = require('cloudinary');
const { defaultResponse } = require('../utils/requestHelper');
const multer = require('multer');
const { Readable } = require('stream');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dh2n1383o',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

const uploadMiddleware = upload.single('image');

/**
 * Uploads an image to Cloudinary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const uploadImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return defaultResponse(res, [400, 'No image file provided', null]);
        }

        // Extract folder and transformation options from request if provided
        const folder = req.body.folder || 'general';
        const { width, height, crop } = req.body;

        // Create a stream from buffer
        const stream = Readable.from(req.file.buffer);

        // Create upload stream to Cloudinary
        const streamUpload = cloudinary.uploader.upload_stream(
            {
                folder,
                // Optional transformations if provided
                ...(width && { width: parseInt(width) }),
                ...(height && { height: parseInt(height) }),
                ...(crop && { crop }),
            },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return defaultResponse(res, [500, 'Error uploading image to Cloudinary', error]);
                }

                // Return success with Cloudinary response
                // The most important fields are:
                // - secure_url: HTTPS URL for the uploaded image
                // - public_id: Cloudinary's public ID for the image (useful for later manipulations)
                return defaultResponse(res, [200, 'Image uploaded successfully', {
                    url: result.secure_url,
                    public_id: result.public_id,
                    original_filename: result.original_filename,
                    format: result.format,
                    resource_type: result.resource_type,
                    created_at: result.created_at,
                    bytes: result.bytes,
                    width: result.width,
                    height: result.height,
                }]);
            }
        );

        stream.pipe(streamUpload);
    } catch (error) {
        console.error('Error in upload handler:', error);
        return defaultResponse(res, [500, 'Error processing upload request', error]);
    }
};

/**
 * Deletes an image from Cloudinary by public_id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const deleteImage = async (req, res, next) => {
    try {
        const { public_id } = req.params;

        if (!public_id) {
            return defaultResponse(res, [400, 'Public ID is required', null]);
        }

        const result = await cloudinary.uploader.destroy(public_id);

        if (result.result === 'ok') {
            return defaultResponse(res, [200, 'Image deleted successfully', result]);
        } else {
            return defaultResponse(res, [404, 'Image not found or already deleted', result]);
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        return defaultResponse(res, [500, 'Error deleting image from Cloudinary', error]);
    }
};

/**
 * Generates a URL for an image with transformations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const getTransformedImageUrl = async (req, res, next) => {
    try {
        const { public_id } = req.params;
        const {
            width,
            height,
            crop,
            quality,
            format,
            effect,
            radius
        } = req.query;

        if (!public_id) {
            return defaultResponse(res, [400, 'Public ID is required', null]);
        }

        const options = {
            ...(width && { width: parseInt(width) }),
            ...(height && { height: parseInt(height) }),
            ...(crop && { crop }),
            ...(quality && { quality }),
            ...(format && { fetch_format: format }),
            ...(effect && { effect }),
            ...(radius && { radius }),
            secure: true,
        };

        const url = cloudinary.url(public_id, options);

        return defaultResponse(res, [200, 'Transformed URL generated', { url }]);
    } catch (error) {
        console.error('Error generating transformed URL:', error);
        return defaultResponse(res, [500, 'Error generating transformed URL', error]);
    }
};

module.exports = {
    uploadMiddleware,
    uploadImage,
    deleteImage,
    getTransformedImageUrl
};
