import path from 'path';
import express from 'express';
import multer from 'multer';
import fs from 'fs'; // On importe le module pour gérer les fichiers

const router = express.Router();
const uploadDir = 'uploads/';

// On vérifie si le dossier 'uploads' existe, sinon on le crée
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Uniquement les images (jpg, jpeg, png)!'), false);
  }
}

const upload = multer({
  storage,
  fileFilter: checkFileType,
});

router.post('/', upload.single('image'), (req, res) => {
  if (req.file) {
    res.status(200).send({
      message: 'Image téléversée avec succès',
      image: `/${req.file.path}`,
    });
  } else {
    res.status(400).send({ message: 'Aucun fichier fourni ou type de fichier invalide' });
  }
});

export default router;