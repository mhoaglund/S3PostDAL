var express = require('express');
var router = express.Router();
var UUID = require('uuid')
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

//TODO cache stuff, cache newest timestamp etc.
router.get('/', function(req, res, next) {
    if(req.query.latest){
        _dp._get_latest(true, function(data){
            res.send(JSON.stringify(data))
        })
    if(req.query.newer){
        _dp._get_latest(req.itemid, '1 DAY', function(data){
            res.send(JSON.stringify(data))
        })
    }
    if(req.query.older){
        _dp._get_latest(req.itemid, '1 DAY', function(data){
            res.send(JSON.stringify(data))
        })
    }
    } else{
        _dp._get_items(req.targetprop, '>', req.compval, function(data){
            res.send(JSON.stringify(data))
        })
    }
})

module.exports = router;
