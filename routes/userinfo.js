/* eslint-disable no-unused-vars */
/* eslint-disable func-names */
const express = require('express');

const router = express.Router();
const asyncMiddleware = require('../middlewares/async');
const userInfoController = require('../controllers/userinfo');

router.post('/get-user-info', asyncMiddleware(userInfoController.getUserInfo));
router.post(
  '/get-list-accounts',
  asyncMiddleware(userInfoController.getListAccounts),
);

module.exports = router;
