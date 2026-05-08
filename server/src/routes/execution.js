const express = require('express');
const router = express.Router();
const executionController = require('../controllers/executionController');

router.post('/', executionController.executeCode);
router.get('/:id', executionController.getExecution);

module.exports = router;
