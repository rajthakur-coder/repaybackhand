const multer = require('multer');
const path = require('path');

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // upload folder
  },
  filename: function (req, file, cb) {
    let ext = path.extname(file.originalname).toLowerCase(); // .png, .jpg etc.

    // Original name without extension, spaces and extra dots replaced
    let basename = path.basename(file.originalname, ext)
                     .replace(/\s+/g, '_')      // spaces to _
                     .replace(/\.+/g, '_');    // multiple dots to _

    // Prevent double extension
    if (basename.toLowerCase().endsWith(ext)) {
      ext = ''; // remove duplicate extension
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

    // Final filename: unique-timestamp + sanitized basename + single extension
    cb(null, `${uniqueSuffix}-${basename}${ext}`);
  }
});

// File filter for images only
const fileFilter = function (req, file, cb) {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed'));
  }
};

// Multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

module.exports = upload;
