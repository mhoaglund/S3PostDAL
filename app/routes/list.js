var express = require('express');
var router = express.Router();
var UUID = require('uuid')
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

/* GET listing of bucket contents. */
router.get('/', function(req, res, next) {
    var params = {
        Bucket: _S3Bucket,
        Delimiter: '/',
        Prefix: ''
    }
    if(req.query.project){
        params.Prefix = req.query.project + '_';
    }
    s3.listObjectsV2(params, function (err, data) {
        if(err)callback(err)
        console.log(data)
        reply = data
        res.send(reply);
    })
});

module.exports = router;
