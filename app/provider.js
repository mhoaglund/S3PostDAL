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
            this.mainrecord = _configdata.mainrecord
            this.location = _configdata.defaulttable
            this.timestamp_field = _configdata.timestampfield
            this.settingstable = _configdata.auxtable
            this.itemcache = [] //should be more generalized, but right now is implemented spec. with regard to The Shallows
            var _self = this;
            setInterval(function () {
                var query = _self.datahandler.query('SELECT 1',
                    function(err, result) {
                        if(err) {
                            console.log(err.stack)
                            cb('Keepalive error: ', err.stack)
                        } else{
                            console.log('kept alive')
                        }
                    });
            }, 5000);
        }
        if(_configdata.sourcetype == 's3'){
            validsource = true
            var AWS = require('aws-sdk');
            this.datahandler = new AWS.S3();
            this.location = _configdata.bucket
            this.imageprefix = _configdata.imageprefix
            this.mainfile = _configdata.mainfile
            this.all_data = _configdata.all_data
            this.diff = _configdata.difffile
            this.keyfield = _configdata.keyfield
            this.orgfield = _configdata.orgfield
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
                    self._parent.datahandler.getObject({Bucket: self._parent.location, Key: self._parent.diff}, function(err, _filterfile){
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
                    var packet = JSON.stringify({"items":self._filter_buffer}, null, 4)
                    var params = {Bucket: self._parent.location, Key: self._parent.diff, Body: packet, ACL: 'public-read'};
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
                    if(_.contains(this._filter_buffer, itemid)){
                        console.log("Item already appears in filter.")
                        cb("Item already appears in filter.")
                        return;
                    }
                    this._filter_buffer.push(itemid)
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
                    if(!_.contains(this._filter_buffer, itemid)){
                        console.log("Item does not appear in filter.")
                        cb("Item does not appear in filter.")
                        return;
                    }
                    this._filter_buffer = _.without(this._filter_buffer, itemid)
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
        this.currentsn = 0
        //this._refresh_serial_number_count();
    }

    _set_max(_max){

    }

    _refresh_serial_number_count(){
        this._get_newest_serial(function(record){
            this.currentsn = record.sn
            return this.currentsn;
        })
    }

    //Getobject if we're using s3, select a row if we're using mysql
    _get_item(_item, cb){
        if(this.stype == 'mysql'){
            var target_location = (_item.location) ? _item.location : this.location
            var query = this.datahandler.query('SELECT * FROM' + target_location + ' WHERE ' + this.keyfield + '=' + _item.key,
            function(err, result) {
                if(err) {
                    console.log(err.stack)
                    cb(null, err.stack)
                }
                else {
                    console.log(result)
                    cb(result, null)
                }
            });
        }
        if(this.stype == 's3'){
            var params = {
                Bucket: ((_item.bucket) ? _item.bucket : this.location), 
                Key: _item.key, 
            }
            this.datahandler.getObject(params, function(err, data){
                if (err){
                    cb('Item not found.', err.stack)
                }
                else{
                    cb(JSON.stringify(data.Body.toString()), null)
                }
            })
        }
    }

    _get_table_as_list(_table, cb, cache = false){
        var self = this;
        if(this.stype == 'mysql'){
            var _sqlstr = 'SELECT * FROM ' + _table;
            console.log(_sqlstr);
            var query = this.datahandler.query(_sqlstr,
            function(err, result) {
                if(err) {
                    console.log(err.stack)
                    cb('Unable to find item. ', err.stack)
                }
                else {
                    if(cache){
                        self.itemcache._table = result;
                    }
                    cb(JSON.stringify(result), null)
                }
            });
            console.log(query.sql)
        }
        if(this.stype == 's3'){
            return;
        }
    }

    ///Pass in a property to compare, an operation, and a comparator value.
    _get_items_prop(_prop, _operation, _comp, cb){
        if(this.stype == 'mysql'){
            var target_location = (_item.location) ? _item.location : this.location
            var _sqlstr = 'SELECT * FROM ' + target_location + ' WHERE ' + _prop + ' '+ _operation + ' '+ _comp;
            console.log(_sqlstr);
            var query = this.datahandler.query(_sqlstr,
            function(err, result) {
                if(err) {
                    console.log(err.stack)
                    cb('Unable to find item. ', err.stack)
                }
                else {
                    console.log(result)
                    cb(JSON.stringify(result), null)
                }
            });
            console.log(query.sql)
        }
        if(this.stype == 's3'){
            return;
        }
    }

        _get_latest(recent, cb){
            if(this.stype == 'mysql'){
                var target_location = this.location
                var sqlstring = (recent) ? 'SELECT * FROM ' + target_location + ' WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 WEEK) ORDER BY timestamp DESC LIMIT 1' : 'SELECT * FROM' + target_location + ' ORDER BY timestamp DESC LIMIT 1'
                var query = this.datahandler.query(sqlstring,
                function(err, result) {
                    if(err) {
                        console.log(err.stack)
                        cb('Unable to find item. ', err.stack)
                    }
                    else {
                        console.log(result)
                        cb(result, null)
                    }
                });
            }
            if(this.stype == 's3'){ return; }
        }

        _get_newest_serial(cb){
            if(this.stype == 'mysql'){
                var sqlstring = 'SELECT * FROM' + this.location + ' ORDER BY sn DESC LIMIT 1'
                var query = this.datahandler.query(sqlstring,
                function(err, result) {
                    if(err) {
                        console.log(err.stack)
                        cb('Unable to find item. ', err.stack)
                    }
                    else {
                        console.log(result)
                        cb(result, null)
                    }
                });
            }
            if(this.stype == 's3'){ return; }
        }

        _get_newer_than(_item, _period, cb){
            if(this.stype == 'mysql'){
                if(!_item.timestamp){
                    _get_item({'key':_item.key}, function(record, err){
                        var target_location = this.location
                        var sqlstring = 'SELECT * FROM ' + target_location + ' WHERE timestamp > DATE_SUB('+record.timestamp+', INTERVAL 1 '+_period+') ORDER BY timestamp DESC';
                        var query = this.datahandler.query(sqlstring,
                            function(err, result) {
                                if(err) {
                                    console.log(err.stack)
                                    cb('Unable to find item. ', err.stack)
                                }
                                else {
                                    console.log(result)
                                    cb(JSON.stringify(result), null)
                                }
                            });
                        console.log(query.sql)
                    })
                }
                
            }
            if(this.stype == 's3'){ return; }
        }

        _get_older_than(_id, _period, cb){
            if(this.stype == 'mysql'){
                if(!_item.timestamp){
                    _get_item({'key':_id}, function(record, err){
                        var target_location = this.location
                        var sqlstring = 'SELECT * FROM ' + target_location + ' WHERE timestamp < DATE_SUB('+record.timestamp+', INTERVAL 1 '+_period+') ORDER BY timestamp DESC';
                        var query = this.datahandler.query(sqlstring,
                            function(err, result) {
                                if(err) {
                                    console.log(err.stack)
                                    cb('Unable to find item. ', err.stack)
                                }
                                else {
                                    console.log(result)
                                    cb(JSON.stringify(result), null)
                                }
                            });
                        console.log(query.sql)
                    })
                }
                console.log(query.sql)
            }
            if(this.stype == 's3'){ return; }
        }

    //If we're mysql, insert a row. If we're s3, putobject.
    //Returns a string.
    //Item: {location: '', key: '', body: {}, policy: '' (maybe just null for mysql?)}
    _write_item(_item, cb){
        if(this.stype == 'mysql'){
            _item.body.id = _item.key
            var target_location = (_item.location) ? _item.location : this.location;
            var query = this.datahandler.query('INSERT INTO ' + target_location + ' SET '+this.timestamp_field+' = NOW(), ?', _item.body,
                function(err, result) {
                    if(!err) {
                        console.log(result)
                        cb(null, 'Successfully inserted item.')
                    }
                    else {
                        console.log(err)
                        cb(err, 'Unable to insert item. ' + result) //is result any good?
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
                    cb("Failed to put item in bucket. " + err.stack)
                } 
            });
        }
    }

    _update_item(_item, cb, verify = false){
        if(this.stype == 'mysql'){
            var values = []
            var qitems = this._unzip(_item.body, ' = ?, ')
            var target_location = (_item.location) ? _item.location : this.location
            if(verify){
                this._get_item(_item, function(record, err){
                    if(!record){
                        //write instead
                        this._write_item(_item, function(newrecord, err){
                            if(newrecord) cb("Item was not found. New record written.", null); //does this return all the way out?
                        })
                    } else{
                        var query = this.datahandler.query('UPDATE ' + target_location + ' SET ' + qitems['props'] + ' WHERE id=' + _item.key, qitems['vals'],
                        function(err, result) {
                            if(!err) {
                                console.log(err.stack)
                                cb('Unable to insert item. ', err.stack)
                            }
                            else {
                                console.log(result)
                                cb('Successfully inserted item.', null)
                            }
                        });
                    }
                })
                //TODO flow cleanup
            } else{
                var query = this.datahandler.query('UPDATE ' + target_location + ' SET ' + qitems['props'] + ' WHERE id=' + _item.key, qitems['vals'],
                function(err, result) {
                    if(!err) {
                        console.log(err.stack)
                        cb('Unable to insert item. ', err.stack)
                    }
                    else {
                        console.log(result)
                        cb('Successfully inserted item.', null)
                    }
                });
            }
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