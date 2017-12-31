var UUID = require('uuid')
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var _ = require('underscore')

//Manages an item filter implemented in a JSON file in S3.
class ItemFilter{
    constructor(_key, _bucket){
        this.key = _key;
        this.filter_buffer = []
        this.is_in_sync = false;
        var _myparams = {
            Bucket: _bucket,
            Key: _key
        };
        
    }
    _refresh_my_copy(){
        var self = this;
        s3.getObject(_myparams, function(err, _filterfile){
            if (err){
                console.log(err, err.stack);
                self.filter_buffer = []
            }
            else{
                var _str = _filterfile.Body.toString('utf-8');
                var _jsobj = JSON.parse(_str);
                self.filter_buffer = _jsobj['items'];
                self.is_in_sync = true;
            }
        })
    }
    _write_my_copy(cb){
        if(!is_in_sync) return;
        var packet = JSON.stringify(this.filter_buffer, null, 4)
        var params = {Bucket: _bucket, Key: this.key, Body: packet, ACL: 'public-read'};
        s3.putObject(params, function(err){
            if(!err) {
                cb("Filter updated.")
            }
            else{
                cb("Filter failed to update.")
            } 
        });
    }
    _add_item(itemid, recompose, cb){
        if(itemid == null) {
            _write_my_copy(function(msg){
                console.log(msg);
                cb("Recompiling filter...")
                return;
            })
        }
        if(_.find(this.filter_buffer, {id:itemid})){
            cb("Item already appears in filter.")
            return;
        }
        this.filter_buffer.push({'id':itemid})
        if(recompose) _write_my_copy(function(msg){
            console.log(msg);
            cb("Item added to filter. Recompiling filter...")
            return;
        })
        cb("Item added to filter.")
    }
}

module.exports.ItemFilter = ItemFilter;