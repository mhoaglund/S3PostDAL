var express = require('express');
var router = express.Router();
var UUID = require('uuid')
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

/* GET listing of bucket contents. */
// router.get('/', require('connect-ensure-login').ensureLoggedIn(), function(req, res, next) {
//     if(req.query.itemid){
//         var params = {
//             Bucket: _dp.location,
//             Kwy: req.query.itemid
//         }
//         s3.getObject(params, function(err, data){
//             if(err){
//                 console.log(err)
//                 res.send('Item not found.')
//             }
//             else{
//                 res.send(JSON.stringify(data))
//             }
//         })
//     }
// });

router.get('/', function(req, res, next) {
    _dp._get_items(req.targetprop, '>', req.compval, function(){
        //TODO zip up and send json back
    })
})

module.exports = router;
