const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const cleanName = file.originalname.split('.').slice(0, -1).join('_').replace(/[^a-zA-Z0-9]/g, '');

    const isRaw = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'rar', '7z', 'txt', 'csv'].includes(ext);

    return {
      folder: 'fyp_submissions',
      resource_type: isRaw ? 'raw' : 'auto',
      public_id: isRaw ? `${cleanName}_${Date.now()}.${ext}` : `${cleanName}_${Date.now()}`
    };
  },
});

module.exports = { cloudinary, storage };

// https://api.cloudinary.com/v1_1/fypms/auto/upload