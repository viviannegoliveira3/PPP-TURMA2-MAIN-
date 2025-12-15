const express = require('express');
const router = express.Router();
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const yaml = require('js-yaml');

const swaggerDocument = yaml.load(fs.readFileSync('./resources/swagger.yaml', 'utf8'));

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerDocument));

module.exports = router;