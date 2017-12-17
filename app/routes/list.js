var express = require('express');
var router = express.Router();
var UUID = require('uuid')
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

/* GET users listing. */
router.get('/', function(req, res, next) {
    var prefix = '';
    if(req.query.project){
        prefix = req.query.project + '_'
    }
    var params = {
        Bucket: _S3Bucket,
        Delimiter: '/',
        Prefix: prefix
    }
    s3.listObjects(params, function (err, data) {
        if(err)callback(err)
        console.log(data)
        reply = data
        res.send(reply);
    })
});

module.exports = router;
