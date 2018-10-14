var Particle = require('particle-api-js');
var _ = require('underscore')

class DeviceManager{
    constructor(configinfo, cb){
        this.particle = new Particle();
        this.config = configinfo;
        this.isloggedin = false;
        this.token = null;
        this.alldevices = {};
        this.latestevent = null;
        this.trackedevent = null;
        this.canSend = true;
        this._init(cb)
    }
    _login(cb){
        var self = this;
        this.particle.login({username: this.config['particle-email'], password: this.config['particle-pw']}).then(
            function(data) {
                self.token = data.body.access_token;
                self.isloggedin = true;
                self._findAll
               cb();
            },
            function (err) {
              console.log('Could not log in.', err);
               cb();
            }
          );
    }
    _findAll(){
        var self = this;
        this.particle.listDevices({ auth: self.token }).then(
            function(devices){
                self.alldevices = devices;
            },
            function(err) {
                console.log('List devices call failed: ', err);
            }
        );
    }
    /**
     * 
     * @param {*} cb 
     */
    _init(cb){
        var self = this;
        this.particle.login({username: this.config['particle-email'], password: this.config['particle-pw']}).then(
            function(data) {
                self.token = data.body.access_token;
                self.isloggedin = true;
                self._findAll
                self.particle.listDevices({ auth: self.token }).then(
                    function(devices){
                        self.alldevices = devices.body;
                        //Assuming we want a few devices by name, break them out here.
                        if(self.config["targets"]){
                            self.targets = _.map(self.config["targets"], function(name){ return _.find(self.alldevices, function(device){
                                return device.name == name;
                            }); });
                        }
                        self._listenfor(self.config["listenfor"])
                        cb(true);
                    },
                    function(err) {
                        console.log('List devices call failed: ', err);
                        cb(false);
                    }
                )
            },
            function (err) {
                console.log('Could not log in.', err);
                return false;
            }
          );
    }
    _listenfor(eventname){
        var self = this;
        self.particle.getEventStream({ deviceId: 'mine', auth: self.token }).then(function(stream) {
            stream.on('event', function(data) {
              console.log("Event: ", data);
              if(data.name == eventname){
                console.log("New paper kiosk status: " + data.data)
                self.trackedevent = data;
                self._trigger(data.data);
              }
              self.latestevent = data;
            });
        });
    }
    _call(_device, _cmd, _arg){
        var self = this;
        var matched = _.find(self.targets, function(device){
            return device.name == _device;
        })
        var fnPr = self.particle.callFunction({ deviceId: matched.id, name: _cmd, argument: _arg, auth: self.token });
        fnPr.then(
            function(data) {
                console.log(_cmd + ' called succesfully:', data);
            }, function(err) {
                console.log('An error occurred:', err);
        });
    }
    _attract(_device){
        var self = this;
        if(!self.canSend) return;
        self._call(_device, 'adjust-brtns', '200');
        self._call(_device, 'adjust-amp', '45');
    }
    _repel(_device){
        var self = this;
        if(!self.canSend) return;
        self._call(_device, 'adjust-brtns', '35');
        self._call(_device, 'adjust-amp', '75');
    }
    _dailySetup(){
        var self = this;
        self._call('paper-kiosk', 'adjust-brtns', 'med');
        self._call('paper-kiosk', 'adjust-amp', '100');
        self._call('tablet-kiosk', 'adjust-brtns', 'med');
        self._call('tablet-kiosk', 'adjust-amp', '100');
    }
    _dailyCloseout(){
        var self = this;
        self._call('paper-kiosk', 'adjust-brtns', 'off');
        self._call('tablet-kiosk', 'adjust-brtns', 'off');
    }
    _trigger(data){
        var self = this;
        if(data == "full"){
            self._attract('paper-kiosk')
        } else if(data == "empty"){
            self._repel('paper-kiosk')
        }
    }
}

module.exports.DeviceManager = DeviceManager