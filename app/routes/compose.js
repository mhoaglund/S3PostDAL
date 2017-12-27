var express = require('express');
var router = express.Router();
var UUID = require('uuid')
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var async = require('async');
var _concated = {Groups:[]};
var _allconcat = {Groups:[]};
var persistence = require('../persistence.js');
var item_filter = new persistence.ItemFilter(_DiffKey)

/* Compose project data doc */
router.get('/', function(req, res, next) {
    retrieveOrgMap(function(msg, orgmap){
        if(msg){
             res.send(msg)
        } else{
            composeData(orgmap)
        }
    })
});

router.get('/remove', function(req, res, next) {
    item_filter._add_item(req.query.itemid, false, function(msg){
        res.send(req.query.itemid + ": " + msg);
    })
});

function retrieveOrgMap(cb){
    var _myparams = {
        Bucket: _S3Bucket,
        Key: _OrgMapKey
    };
    s3.getObject(_myparams, function(err, _mapfile){
        if (err){
            console.log(err, err.stack);
            return cb("Couldn't find group map file.", null)
        }
        else{
            var _str = _mapfile.Body.toString('utf-8');
            var _jsobj = JSON.parse(_str);
            return cb(null, _jsobj['groups']);
        }
    })
}
function composeData(_map){
    async.filterSeries(_map, function(_group, callback){
        getKeysForProject(_S3Bucket, _group, function(_data){
            if(_data == null){
                console.log('skipping empty project: ' + _group);
                return callback(null, null);
            } 
            var _composed = {Group:_group, Items:[]}
            var _allitems = {Group:_group, Items:[]}
            async.filter(_data, function(_obj, cb){
                var _myparams = {
                    Bucket: _S3Bucket,
                    Key: _obj.Key
                };
                    s3.getObject(_myparams, function(err, _item) {
                        if (err) console.log(err, err.stack); // an error occurred
                        else{
                            var _str = _item.Body.toString('utf-8'); //content-type in s3 doesnt seem to matter
                            var _jsobj = JSON.parse(_str);
                            _jsobj.momentkey = _myparams.Key.toString();
                            for (var property in _jsobj) {
                                if (_jsobj.hasOwnProperty(property)) {
                                    if(typeof(_jsobj[property]) == 'string'){
                                        if(_jsobj[property] == ""){
                                             _jsobj[property] = null;
                                             console.log('cleared an empty string');
                                        }
                                    }
                                    else{
                                        if(_jsobj[property][0] == ""){
                                             _jsobj[property] = null;
                                            console.log('cleared an empty array');
                                        }
                                    }
                                }
                            }
                            if(!_.find(item_filter.filter_buffer, {id:_obj.Key})){
                                _composed.Items.push(_jsobj);
                            }
                            _allitems.Items.push(_jsobj);
                            return cb(null, _composed, _allitems);
                        }
                    });
            }, function(err, results){
                _concated.Groups.push(_composed);
                _allconcat.Groups.push(_allitems);
                return callback(null, _concated, _allconcat);
            });
        });
        
    }, function(err, results){
        console.log(_concated);
        var params = {
            Bucket: _S3Bucket, 
            Key: _MainKey + '.json', 
            ACL: 'public-read',
            Body: JSON.stringify(_concated),
            ContentType: 'application/json'
        };
        s3.putObject(params, function(err){
            if(!err) {
                var responseBody = "Entry created.";
                var response = {
                    statusCode: 200,
                    headers: {
                        "Content-Type" : "application/javascript"
                    },
                    body: JSON.stringify(responseBody)
                };
                console.log('Good to go!');
            }
            else{
                var responseBody = "Couldn't create entry. Something went wrong.";
                var response = {
                    statusCode: 200,
                    headers: {
                        "Content-Type" : "application/javascript"
                    },
                    body: JSON.stringify(responseBody)
                };
                console.log('Error occurred: ' + err);
            } 
        });
        var params_all = {
            Bucket: _S3Bucket, 
            Key: _MainKey + '.json', 
            ACL: 'public-read',
            Body: JSON.stringify(_allconcat),
            ContentType: 'application/json'
        };
        s3.putObject(params_all, function(err){
            if(!err) {
                var responseBody = "Entry created.";
                var response = {
                    statusCode: 200,
                    headers: {
                        "Content-Type" : "application/javascript"
                    },
                    body: JSON.stringify(responseBody)
                };
                console.log('Good to go!');
            }
            else{
                var responseBody = "Couldn't create entry. Something went wrong.";
                var response = {
                    statusCode: 200,
                    headers: {
                        "Content-Type" : "application/javascript"
                    },
                    body: JSON.stringify(responseBody)
                };
                console.log('Error occurred: ' + err);
            } 
        });
    });
}

function getKeysForProject(_bucket, _project, cb){
    var _keys = [];
    s3.listObjectsV2({Bucket: _bucket, Delimiter: '/', Prefix: _project}, function(err, data){
        if(!err){
            if(data.Contents.length > 0){
                _keys.push(data.Contents);
                cb(_keys[0]);
            }
            else cb(null);
        }
        else console.log(err);
    });
};

module.exports = router;
