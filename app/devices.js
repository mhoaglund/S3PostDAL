var Particle = require('particle-api-js');

class DeviceManager{
    constructor(configinfo){
        this.particle = new Particle();
        this.config = configinfo;
        this.isloggedin = false;
        this.token = null;
        this.alldevices = {};
    }
    _login(){
        this.particle.login({username: this.config.particle-email, password: this.config.particle-pw}).then(
            function(data) {
              this.token = data.body.access_token;
              this.isloggedin = true;
            },
            function (err) {
              console.log('Could not log in.', err);
            }
          );
    }
    _findAll(){
        this.particle.listDevices({ auth: token }).then(
            function(devices){
                this.alldevices = devices;
            },
            function(err) {
                console.log('List devices call failed: ', err);
            }
        );
    }
    //TODO: how to actually set this up?
    //We need to differentially control two outputs with input from a single channel.
    //_pushPaper
        //needs to know if there's an occupied paper podium
    //_pushTablet
        //needs to know if we've printed all new change orders
    //_evaluate
}