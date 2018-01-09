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
var passport = require('passport')

/* Compose project data doc */
router.get('/', require('connect-ensure-login').ensureLoggedIn(), function(req, res, next) {
    retrieveOrgMap(function(msg, orgmap){
        if(msg){
             res.send(msg)
        } else{
            compose_alt(orgmap, function(reply){
                res.send(reply)
            })
        }
    })
});

function prepareId(_id){
    var components = _id.split('_');
    return components[0].replace(/-/g, ' ') + '_' + components[1]
}

router.get('/remove', require('connect-ensure-login').ensureLoggedIn(), function(req, res, next) {
    _dp.itemfilter._add_item(prepareId(req.query.itemid), true, function(msg){
        res.send(req.query.itemid + ": " + msg);
    })
});

router.get('/reinstate', require('connect-ensure-login').ensureLoggedIn(), function(req, res, next) {
    _dp.itemfilter._remove_item(prepareId(req.query.itemid), true, function(msg){
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

var testmain = {}
var testall = {}
var manifest = []
function compose_alt(_map, _cb){
    var i =_map.length;
    _map.forEach(function(_group){
        getKeysForProject(_dp.location, _group, function(_data){
            getObjects(_dp.location, _group, _data, function(projectdata){
                i--;
                console.log(i)
                if(projectdata.main.Items.length > 0) testmain[_group] = {Group:_group, Items:projectdata.main.Items}
                if(projectdata.all.Items.length > 0) testall[_group] = {Group:_group, Items:projectdata.all.Items}
                if(i==0) {
                    //console.dir(testmain)
                    var payload = {'Groups':_.values(testmain)};
                    _dp._write_item(
                        {   key: _dp.mainfile + '.json', 
                            body: JSON.stringify(payload), 
                            policy: 'public-read',
                            content_type: 'application/json'
                        }, function(result){
                            _cb('Project data has been composed and saved.')
                    }) 
                    var payload_all = {'Groups':_.values(testall)};
                    _dp._write_item(
                        {   key: _dp.all_data + '.json', 
                            body: JSON.stringify(payload_all), 
                            policy: 'public-read',
                            content_type: 'application/json'
                        }, function(result){
                            console.log('saved alldata')
                    })   
                }
            })    
        });
    })

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

function getObjects(_bucket, _group, _data, cb){
    var _composed = {Group:_group, Items:[]}
    var _allitems = {Group:_group, Items:[]}
    async.each(_data, function(_obj, callback){
        //console.log('getting '+_obj.Key);
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
                //Clearing empties
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
                if(!_.contains(_dp.itemfilter._filter_buffer, _obj.Key)){
                    _composed.Items.push(_jsobj);
                }
                _allitems.Items.push(_jsobj);
                callback();
            }
        });
    }, function(err){
        if(!err) cb({'main':_composed, 'all':_allitems});
        else cb({'main':null, 'all':null})
    });
}

module.exports = router;
