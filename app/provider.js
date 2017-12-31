//TODO: flesh out data provider module so we can switch out S3 and MySQL and retain the same simple grouping logic.
var _ = require('underscore')

class DataProvider{
    constructor(_configdata){
        //TODO: move itemfilter into dataprovider.
        var validsource = false
        this.datahandler = null
        this.stype = _configdata.sourcetype
        this.isconnected = false
        this.location = null
        if(_configdata.sourcetype == 'mysql'){
            validsource = true
            var mysql = require('mysql');
            this.datahandler = mysql.createConnection({
                host     : _configdata.dbhost,
                port: _configdata.port,
                user     : _configdata.dbuser,
                password : _configdata.dbpw,
                database : _configdata.dbname
            });
            this.datahandler.connect(function(err){
                if (err) {
                    console.log('error connecting: ' + err.stack)
                }
                console.log('mysql connection open')
                this.isconnected = true
            })
            this.keyfield = _configdata.keyfield
            this.orgfield = _configdata.orgfield
            this.location = _configdata.defaulttable
        }
        if(_configdata.sourcetype == 's3'){
            validsource = true
            var AWS = require('aws-sdk');
            this.datahandler = new AWS.S3();
            this.location = _configdata.bucket
            this.imageprefix = _configdata.imageprefix
            this.mainfile = _configdata.mainfile
            this.all_data = _configdata.all_data
            this.diff = _configdata.difffile //For mysql we could just have a second table with blacklisted ids
            this.keyfield = _configdata.keyfield
            this.orgfield = _configdata.orgfield //Another separate table here.
            this.isconnected = true //TODO verify s3 connection by checking whether our bucket exists
        }
        if(!validsource){
            console.log('Bad config file, check data source type. Should be mysql or s3!')
        }else{
            this.maxkeys = 1000
            this.mode = _configdata.sourcetype
        }   
        this.itemfilter = {
            _parent: this,
            _self_type: this.stype,
            _filter_key: this.diff, //gotta make sure the score is right here
            _is_in_sync: true,
            _filter_buffer: [],
            _refresh_my_copy: function(){
                var self = this;
                if(self._self_type == 's3'){
                    self._parent.datahandler.getObject({Bucket: self._parent.location, Key: self._parent.diff+'.json'}, function(err, _filterfile){
                        if (err){
                            console.log(err, err.stack);
                            self._filter_buffer = []
                        }
                        else{
                            var _str = _filterfile.Body.toString('utf-8');
                            var _jsobj = JSON.parse(_str);
                            self._filter_buffer = _jsobj['items'];
                            self._is_in_sync = true;
                        }
                    })
                }
                if(self._self_type == 'mysql'){
                    //TODO: figure out the implementation here.
                    return;
                }
            },
            _write_my_copy: function(cb){
                var self = this;
                if(!this._is_in_sync) return;
                if(self._self_type == 's3'){
                    var packet = JSON.stringify(self._filter_buffer, null, 4)
                    var params = {Bucket: self._parent.location, Key: self._parent.diff+'.json', Body: packet, ACL: 'public-read'};
                    self._parent.datahandler.putObject(params, function(err){
                        if(!err) {
                            cb("Filter updated.")
                        }
                        else{
                            cb("Filter failed to update.")
                        } 
                    });
                }
                if(self._self_type == 'mysql'){
                    //TODO: figure out the implementation here.
                    return;
                }
            },
            _add_item: function(itemid, recompose, cb){
                var self = this;
                if(itemid == null) {
                    self._write_my_copy(function(msg){
                        console.log(msg);
                        cb("Recompiling filter...")
                        return;
                    })
                }
                else{
                    if(_.find(this._filter_buffer, {id:itemid})){
                        console.log("Item already appears in filter.")
                        cb("Item already appears in filter.")
                        return;
                    }
                    this._filter_buffer.push({'id':itemid})
                    if(recompose) {self._write_my_copy(function(msg){ //can we scope to that?
                        console.log(msg);
                        cb("Item added to filter. Recompiling filter...")
                        return;
                    })
                }
                    else cb("Item added to filter.")
                }
            },
            _remove_item: function(itemid, recompose, cb){
                var self = this;
                if(itemid == null) {
                    self._write_my_copy(function(msg){
                        console.log(msg);
                        cb("Recompiling filter...")
                        return;
                    })
                }
                else{
                    if(!_.find(this._filter_buffer, {id:itemid})){
                        console.log("Item does not appear in filter.")
                        cb("Item does not appear in filter.")
                        return;
                    }
                    this._filter_buffer = _.reject(this._filter_buffer, {id:itemid})
                    if(recompose) {self._write_my_copy(function(msg){ //can we scope to that?
                        console.log(msg);
                        cb("Item added to filter. Recompiling filter...")
                        return;
                    })
                }
                    else cb("Item added to filter.")
                }

            }
        }
        this.itemfilter._refresh_my_copy();
    }

    _set_max(_max){

    }

    //Getobject if we're using s3, select a row if we're using mysql
    _get_item(_item, cb){
        if(this.stype == 'mysql'){
            var query = this.datahandler.query('SELECT * FROM' + target_location + ' WHERE ' + this.keyfield + '=' + _item.key,
            function(err, result) {
                if(!err) {
                    console.log(err.stack)
                    cb('Unable to find item. ' + err.stack)
                }
                else {
                    console.log(result)
                    cb(JSON.stringify(result))
                }
            });
        }
        if(this.stype == 's3'){
            var params = {
                Bucket: ((_item.bucket) ? _item.bucket : this.location), 
                Key: _item.key, 
            }
            this.datahandler.getObject(params, function(err){
                if (err){
                    cb('Item not found.')
                }
                else{
                    cb(JSON.stringify(data))
                }
            })
        }
    }

    //If we're mysql, insert a row. If we're s3, putobject.
    //Returns a string.
    //Item: {location: '', key: '', body: {}, policy: '' (maybe just null for mysql?)}
    _write_item(_item, cb){
        if(this.stype == 'mysql'){
            body.id = _item.key
            var target_location = (_item.location) ? _item.location : this.defaulttable
            var query = this.datahandler.query('INSERT INTO' + target_location + ' SET ?', body,
                function(err, result) {
                    if(!err) {
                        console.log(err.stack)
                        cb('Unable to insert item. ' + result) //is result any good?
                    }
                    else {
                        console.log(result)
                        cb('Successfully inserted item.')
                    }
            });
        }
        if(this.stype == 's3'){
            var params = {
                Bucket: ((_item.bucket) ? _item.bucket : this.location), 
                Key: _item.key, 
                Body: _item.body, 
                ACL: _item.policy,
                ContentType: _item.content_type
            }
            this.datahandler.putObject(params, function(err){
                if(!err) {
                    cb("Successfully added item to bucket.")
                }
                else{
                    console.log(err.stack)
                    cb("Filter failed to update. " + err.stack)
                } 
            });
        }
    }

    _update_item(_item, cb){
        if(this.stype == 'mysql'){
            var values = []
            var qitems = _unzip(_item.body, ' = ?, ')
            var target_location = (_item.location) ? _item.location : this.defaulttable
            var query = this.datahandler.query('UPDATE ' + target_location + ' SET ' + qitems['props'] + ' WHERE id=' + _item.key, qitems['vals'],
                function(err, result) {
                    if(!err) {
                        console.log(err.stack)
                        cb('Unable to insert item. ' + err.stack)
                    }
                    else {
                        console.log(result)
                        cb('Successfully inserted item.')
                    }
            });
        }
        if(this.stype == 's3'){
            var params = {
                Bucket: ((_item.bucket) ? _item.bucket : this.location), 
                Key: _item.key, 
                Body: _item.body, 
                ACL: _item.policy
            }
            this.datahandler.putObject(params, function(err){
                if(!err) {
                    cb("Successfully updated item in bucket.")
                }
                else{
                    console.log(err.stack)
                    cb("Failed to update. " + err.stack)
                } 
            });
        }
    }

    //Semi-generalized query cleanup helper for unzipping objects into easy queries.
    _unzip(_input_obj, _strjoin, _should_trim){
        var concated_property_names = ''
        var array_of_values = ''
        for (var key in _input_obj) {
            // skip loop if the property is from prototype
            if (!_input_obj.hasOwnProperty(key)) continue;
        
            var obj = _input_obj[key];
            for (var prop in obj) {
                // skip loop if the property is from prototype
                if(!obj.hasOwnProperty(prop)) continue;

                concated_property_names += prop
                concated_property_names += _strjoin
                array_of_values.push(obj[prop])
            }
        }
        if(_should_trim) concated_property_names = concated_property_names.replace(/(^[,\s]+)|([,\s]+$)/g, '');
        return {'props': concated_property_names, 'vals': array_of_values}
    }

}

module.exports.DataProvider = DataProvider