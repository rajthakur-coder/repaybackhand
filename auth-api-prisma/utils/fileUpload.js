const multer = require('multer');
const path = require('path');
const fs = require('fs');


function uploadImage(file, req) {
    if (!file || (!file.buffer && !file.path)) return "";

    const uploadDir = path.join(__dirname, "..", "uploads/products");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname || file.path).toLowerCase();
    const basename = path.basename(file.originalname || file.path, ext)
        .replace(/\s+/g, "-")
        .replace(/\.+/g, "_");

    const filename = `${Date.now()}-${basename}${ext}`;
    const filepath = path.join(uploadDir, filename);

    if (file.buffer) {
        fs.writeFileSync(filepath, file.buffer);
    } else if (file.path) {
        fs.copyFileSync(file.path, filepath);
    }

    return `${req.protocol}://${req.get("host")}/uploads/products/${filename}`;
}

function deleteImageIfExists(filePath) {
    try {
        if (!filePath) return;

        const fullPath = path.join(__dirname, '..', filePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    } catch (err) {
        console.error('Error deleting image:', err.message);
    }
}

module.exports = { uploadImage, deleteImageIfExists };
