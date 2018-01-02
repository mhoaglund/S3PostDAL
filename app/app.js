//config
var nconf = require('nconf');
var provider = require('./provider.js')
if(process.env.bucket){
  _OrgField = process.env.orgfield;
  _S3Bucket = process.env.bucket;
  _OrgMapKey = _OrgField + "map.json";
  _MainKey = process.env.mainfile;
  _AllKey = process.env.allfile;
  _DiffKey = process.env.difffile;
}
else{
  nconf.file('./app/config_alt.json');
  //gotta figure out these globals now
  _OrgField = nconf.get('orgfield');
  _S3Bucket = nconf.get('bucket');
  _OrgMapKey = _OrgField + "map.json"; //array of possible options for organization field
  _MainKey = nconf.get('mainfile');
  _AllKey = nconf.get('allfile');
  _DiffKey = nconf.get('difffile');
}

var fs = require('fs');
var dpconfig = JSON.parse(fs.readFileSync('./app/config_alt.json', 'utf8'));
_dp = new provider.DataProvider(dpconfig)

var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var multerS3 = require('multer-s3');

var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var staticauth = require('./staticauth');

// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use(new Strategy(
  function(username, password, cb) {
    staticauth.users.findByUsername(username, function(err, user) {
      if (err) { return cb(err); }
      if (!user) { return cb(null, false); }
      if (user.password != password) { return cb(null, false); }
      return cb(null, user);
    });
  }));


// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  staticauth.users.findById(id, function (err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

var index = require('./routes/index');
var users = require('./routes/users');
var upload = require('./routes/upload');
var listitems = require('./routes/list');
var retrieve = require('./routes/retrieve');
var compose = require('./routes/compose');

var app = express();

app.use(require('express-session')({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);
app.use('/upload', upload);
app.use('/list', listitems);
app.use('/retrieve', retrieve);
app.use('/compose', compose);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
