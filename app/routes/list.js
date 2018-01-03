var express = require('express');
var router = express.Router();
var UUID = require('uuid')
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

/* GET listing of bucket contents. */
router.get('/', require('connect-ensure-login').ensureLoggedIn(), function(req, res, next) {
    //TODO create a method on the dp that returns a listing. figure out what that should mean for sql.
    res.send('Not yet implemented.')
});

module.exports = router;
