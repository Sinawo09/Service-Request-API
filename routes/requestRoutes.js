const express = require('express');
const requestController = require('../controllers/requestController');

const router = express.Router();

router.get('/', requestController.getAllRequests);
router.get('/:id', requestController.getRequestById);
router.post('/', requestController.createRequest);
router.put('/:id', requestController.replaceRequest);
router.patch('/:id', requestController.updateRequest);
router.delete('/:id', requestController.deleteRequest);

module.exports = router;