var express = require('express');
var router = express.Router();
var UUID = require('uuid')
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var async = require('async');
var _ = require('underscore')
var _concated = {Groups:[]};
var _allconcat = {Groups:[]};
var persistence = require('../persistence.js');

/* Compose project data doc */
router.get('/', function(req, res, next) {
    retrieveOrgMap(function(msg, orgmap){
        if(msg){
             res.send(msg)
        } else{
            composeData(orgmap, function(reply){
                res.send(reply)
            })
        }
    })
});

router.get('/remove', function(req, res, next) {
    _dp.itemfilter._add_item(req.query.itemid, true, function(msg){
        res.send(req.query.itemid + ": " + msg);
    })
});

router.get('/reinstate', function(req, res, next) {
    _dp.itemfilter._remove_item(req.query.itemid, true, function(msg){
        res.send(req.query.itemid + ": " + msg);
    })
});

function retrieveOrgMap(cb){
    var _myparams = {
        Bucket: _dp.location,
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
function composeData(_map, _cb){
    async.filterSeries(_map, function(_group, callback){
        getKeysForProject(_dp.location, _group, function(_data){
            if(_data == null){
                console.log('skipping empty project: ' + _group);
                return callback(null, null);
            } 
            var _composed = {Group:_group, Items:[]}
            var _allitems = {Group:_group, Items:[]}
            async.filter(_data, function(_obj, cb){
                var _myparams = {
                    Bucket: _dp.location,
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
                            if(!_.find(_dp.itemfilter._filter_buffer, {id:_obj.Key})){
                                _composed.Items.push(_jsobj);
                            }
                            _allitems.Items.push(_jsobj);
                            return cb(null, _composed, _allitems);
                        }
                    });
            }, function(err, results){
                //Without these ifs, we end up with strange copies all over the place. TODO fix.
                if(!_.find(_concated.Groups, {Group:_composed.Group})){
                    _concated.Groups.push(_composed);
                }
                if(!_.find(_allconcat.Groups, {Group:_allitems.Group})){
                    _allconcat.Groups.push(_allitems);
                }
                return callback(null, _concated, _allconcat);
            });
        });
        
    }, function(err, results){
        //Write working subset of items
        _dp._write_item(
            {   key: _dp.mainfile + '.json', 
                body: JSON.stringify(_concated), 
                policy: 'public-read',
                content_type: 'application/json'
            }, function(err, result){
                //Write all data file
                _dp._write_item(
                    {   key: _dp.all_data + '.json', 
                        body: JSON.stringify(_allconcat), 
                        policy: 'public-read',
                        content_type: 'application/json'
                    }, function(err, result){
                        _cb('Project data has been composed and saved.')
                    })  
            })

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
