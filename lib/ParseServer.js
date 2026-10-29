"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Options = require("./Options");
var _defaults = _interopRequireDefault(require("./defaults"));
var logging = _interopRequireWildcard(require("./logger"));
var _Config = _interopRequireDefault(require("./Config"));
var _PromiseRouter = _interopRequireDefault(require("./PromiseRouter"));
var _requiredParameter = _interopRequireDefault(require("./requiredParameter"));
var _AnalyticsRouter = require("./Routers/AnalyticsRouter");
var _ClassesRouter = require("./Routers/ClassesRouter");
var _FeaturesRouter = require("./Routers/FeaturesRouter");
var _FilesRouter = require("./Routers/FilesRouter");
var _FunctionsRouter = require("./Routers/FunctionsRouter");
var _GlobalConfigRouter = require("./Routers/GlobalConfigRouter");
var _GraphQLRouter = require("./Routers/GraphQLRouter");
var _HooksRouter = require("./Routers/HooksRouter");
var _IAPValidationRouter = require("./Routers/IAPValidationRouter");
var _InstallationsRouter = require("./Routers/InstallationsRouter");
var _LogsRouter = require("./Routers/LogsRouter");
var _ParseLiveQueryServer = require("./LiveQuery/ParseLiveQueryServer");
var _PagesRouter = require("./Routers/PagesRouter");
var _PublicAPIRouter = require("./Routers/PublicAPIRouter");
var _PushRouter = require("./Routers/PushRouter");
var _CloudCodeRouter = require("./Routers/CloudCodeRouter");
var _RolesRouter = require("./Routers/RolesRouter");
var _SchemasRouter = require("./Routers/SchemasRouter");
var _SessionsRouter = require("./Routers/SessionsRouter");
var _UsersRouter = require("./Routers/UsersRouter");
var _PurgeRouter = require("./Routers/PurgeRouter");
var _AudiencesRouter = require("./Routers/AudiencesRouter");
var _AggregateRouter = require("./Routers/AggregateRouter");
var _ParseServerRESTController = require("./ParseServerRESTController");
var controllers = _interopRequireWildcard(require("./Controllers"));
var _ParseGraphQLServer = require("./GraphQL/ParseGraphQLServer");
var _SecurityRouter = require("./Routers/SecurityRouter");
var _CheckRunner = _interopRequireDefault(require("./Security/CheckRunner"));
var _Deprecator = _interopRequireDefault(require("./Deprecator/Deprecator"));
var _DefinedSchemas = require("./SchemaMigrations/DefinedSchemas");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
// ParseServer - open-source compatible API Server for Parse apps

var batch = require('./batch'),
  bodyParser = require('body-parser'),
  express = require('express'),
  middlewares = require('./middlewares'),
  Parse = require('parse/node').Parse,
  {
    parse
  } = require('graphql'),
  path = require('path'),
  fs = require('fs');
// Mutate the Parse object to add the Cloud Code handlers
addParseCloud();

// ParseServer works like a constructor of an express app.
// https://parseplatform.org/parse-server/api/master/ParseServerOptions.html
class ParseServer {
  /**
   * @constructor
   * @param {ParseServerOptions} options the parse server initialization options
   */
  constructor(options) {
    // Scan for deprecated Parse Server options
    _Deprecator.default.scanParseServerOptions(options);
    // Set option defaults
    injectDefaults(options);
    const {
      appId = (0, _requiredParameter.default)('You must provide an appId!'),
      masterKey = (0, _requiredParameter.default)('You must provide a masterKey!'),
      javascriptKey,
      serverURL = (0, _requiredParameter.default)('You must provide a serverURL!')
    } = options;
    // Initialize the node client SDK automatically
    Parse.initialize(appId, javascriptKey || 'unused', masterKey);
    Parse.serverURL = serverURL;
    _Config.default.validateOptions(options);
    const allControllers = controllers.getControllers(options);
    options.state = 'initialized';
    this.config = _Config.default.put(Object.assign({}, options, allControllers));
    this.config.masterKeyIpsStore = new Map();
    this.config.maintenanceKeyIpsStore = new Map();
    logging.setLogger(allControllers.loggerController);
  }

  /**
   * Starts Parse Server as an express app; this promise resolves when Parse Server is ready to accept requests.
   */

  async start() {
    try {
      if (this.config.state === 'ok') {
        return this;
      }
      this.config.state = 'starting';
      _Config.default.put(this.config);
      const {
        databaseController,
        hooksController,
        cloud,
        security,
        schema,
        cacheAdapter,
        liveQueryController
      } = this.config;
      try {
        await databaseController.performInitialization();
      } catch (e) {
        if (e.code !== Parse.Error.DUPLICATE_VALUE) {
          throw e;
        }
      }
      await hooksController.load();
      const startupPromises = [];
      if (schema) {
        startupPromises.push(new _DefinedSchemas.DefinedSchemas(schema, this.config).execute());
      }
      if (cacheAdapter !== null && cacheAdapter !== void 0 && cacheAdapter.connect && typeof cacheAdapter.connect === 'function') {
        startupPromises.push(cacheAdapter.connect());
      }
      startupPromises.push(liveQueryController.connect());
      await Promise.all(startupPromises);
      if (cloud) {
        addParseCloud();
        if (typeof cloud === 'function') {
          await Promise.resolve(cloud(Parse));
        } else if (typeof cloud === 'string') {
          var _json;
          let json;
          if (process.env.npm_package_json) {
            json = require(process.env.npm_package_json);
          }
          if (process.env.npm_package_type === 'module' || ((_json = json) === null || _json === void 0 ? void 0 : _json.type) === 'module') {
            await import(path.resolve(process.cwd(), cloud));
          } else {
            require(path.resolve(process.cwd(), cloud));
          }
        } else {
          throw "argument 'cloud' must either be a string or a function";
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (security && security.enableCheck && security.enableCheckLog) {
        new _CheckRunner.default(security).run();
      }
      this.config.state = 'ok';
      _Config.default.put(this.config);
      return this;
    } catch (error) {
      console.error(error);
      this.config.state = 'error';
      throw error;
    }
  }
  get app() {
    if (!this._app) {
      this._app = ParseServer.app(this.config);
    }
    return this._app;
  }
  handleShutdown() {
    var _this$liveQueryServer, _this$liveQueryServer2;
    const promises = [];
    const {
      adapter: databaseAdapter
    } = this.config.databaseController;
    if (databaseAdapter && typeof databaseAdapter.handleShutdown === 'function') {
      promises.push(databaseAdapter.handleShutdown());
    }
    const {
      adapter: fileAdapter
    } = this.config.filesController;
    if (fileAdapter && typeof fileAdapter.handleShutdown === 'function') {
      promises.push(fileAdapter.handleShutdown());
    }
    const {
      adapter: cacheAdapter
    } = this.config.cacheController;
    if (cacheAdapter && typeof cacheAdapter.handleShutdown === 'function') {
      promises.push(cacheAdapter.handleShutdown());
    }
    if ((_this$liveQueryServer = this.liveQueryServer) !== null && _this$liveQueryServer !== void 0 && (_this$liveQueryServer2 = _this$liveQueryServer.server) !== null && _this$liveQueryServer2 !== void 0 && _this$liveQueryServer2.close) {
      promises.push(new Promise(resolve => this.liveQueryServer.server.close(resolve)));
    }
    if (this.liveQueryServer) {
      promises.push(this.liveQueryServer.shutdown());
    }
    return (promises.length > 0 ? Promise.all(promises) : Promise.resolve()).then(() => {
      if (this.config.serverCloseComplete) {
        this.config.serverCloseComplete();
      }
    });
  }

  /**
   * @static
   * Create an express app for the parse server
   * @param {Object} options let you specify the maxUploadSize when creating the express app  */
  static app(options) {
    const {
      maxUploadSize = '20mb',
      appId,
      directAccess,
      pages,
      rateLimit = []
    } = options;
    // This app serves the Parse API directly.
    // It's the equivalent of https://api.parse.com/1 in the hosted Parse API.
    var api = express();
    //api.use("/apps", express.static(__dirname + "/public"));
    api.use(middlewares.allowCrossDomain(appId));
    // File handling needs to be before default middlewares are applied
    api.use('/', new _FilesRouter.FilesRouter().expressRouter({
      maxUploadSize: maxUploadSize
    }));
    api.use('/health', function (req, res) {
      res.status(options.state === 'ok' ? 200 : 503);
      if (options.state === 'starting') {
        res.set('Retry-After', 1);
      }
      res.json({
        status: options.state
      });
    });
    api.use('/', bodyParser.urlencoded({
      extended: false
    }), pages.enableRouter ? new _PagesRouter.PagesRouter(pages).expressRouter() : new _PublicAPIRouter.PublicAPIRouter().expressRouter());
    api.use(bodyParser.json({
      type: '*/*',
      limit: maxUploadSize
    }));
    api.use(middlewares.allowMethodOverride);
    api.use(middlewares.handleParseHeaders);
    const routes = Array.isArray(rateLimit) ? rateLimit : [rateLimit];
    for (const route of routes) {
      middlewares.addRateLimit(route, options);
    }
    api.use(middlewares.handleParseSession);
    const appRouter = ParseServer.promiseRouter({
      appId
    });
    api.use(appRouter.expressRouter());
    api.use(middlewares.handleParseErrors);

    // run the following when not testing
    if (!process.env.TESTING) {
      //This causes tests to spew some useless warnings, so disable in test
      /* istanbul ignore next */
      process.on('uncaughtException', err => {
        if (err.code === 'EADDRINUSE') {
          // user-friendly message for this common error
          process.stderr.write(`Unable to listen on port ${err.port}. The port is already in use.`);
          process.exit(0);
        } else {
          throw err;
        }
      });
      // verify the server url after a 'mount' event is received
      /* istanbul ignore next */
      api.on('mount', async function () {
        await new Promise(resolve => setTimeout(resolve, 1000));
        ParseServer.verifyServerUrl();
      });
    }
    if (process.env.PARSE_SERVER_ENABLE_EXPERIMENTAL_DIRECT_ACCESS === '1' || directAccess) {
      Parse.CoreManager.setRESTController((0, _ParseServerRESTController.ParseServerRESTController)(appId, appRouter));
    }
    return api;
  }
  static promiseRouter({
    appId
  }) {
    const routers = [new _ClassesRouter.ClassesRouter(), new _UsersRouter.UsersRouter(), new _SessionsRouter.SessionsRouter(), new _RolesRouter.RolesRouter(), new _AnalyticsRouter.AnalyticsRouter(), new _InstallationsRouter.InstallationsRouter(), new _FunctionsRouter.FunctionsRouter(), new _SchemasRouter.SchemasRouter(), new _PushRouter.PushRouter(), new _LogsRouter.LogsRouter(), new _IAPValidationRouter.IAPValidationRouter(), new _FeaturesRouter.FeaturesRouter(), new _GlobalConfigRouter.GlobalConfigRouter(), new _GraphQLRouter.GraphQLRouter(), new _PurgeRouter.PurgeRouter(), new _HooksRouter.HooksRouter(), new _CloudCodeRouter.CloudCodeRouter(), new _AudiencesRouter.AudiencesRouter(), new _AggregateRouter.AggregateRouter(), new _SecurityRouter.SecurityRouter()];
    const routes = routers.reduce((memo, router) => {
      return memo.concat(router.routes);
    }, []);
    const appRouter = new _PromiseRouter.default(routes, appId);
    batch.mountOnto(appRouter);
    return appRouter;
  }

  /**
   * starts the parse server's express app
   * @param {ParseServerOptions} options to use to start the server
   * @returns {ParseServer} the parse server instance
   */

  async startApp(options) {
    try {
      await this.start();
    } catch (e) {
      console.error('Error on ParseServer.startApp: ', e);
      throw e;
    }
    const app = express();
    if (options.middleware) {
      let middleware;
      if (typeof options.middleware == 'string') {
        middleware = require(path.resolve(process.cwd(), options.middleware));
      } else {
        middleware = options.middleware; // use as-is let express fail
      }

      app.use(middleware);
    }
    app.use(options.mountPath, this.app);
    if (options.mountGraphQL === true || options.mountPlayground === true) {
      let graphQLCustomTypeDefs = undefined;
      if (typeof options.graphQLSchema === 'string') {
        graphQLCustomTypeDefs = parse(fs.readFileSync(options.graphQLSchema, 'utf8'));
      } else if (typeof options.graphQLSchema === 'object' || typeof options.graphQLSchema === 'function') {
        graphQLCustomTypeDefs = options.graphQLSchema;
      }
      const parseGraphQLServer = new _ParseGraphQLServer.ParseGraphQLServer(this, {
        graphQLPath: options.graphQLPath,
        playgroundPath: options.playgroundPath,
        graphQLCustomTypeDefs
      });
      if (options.mountGraphQL) {
        parseGraphQLServer.applyGraphQL(app);
      }
      if (options.mountPlayground) {
        parseGraphQLServer.applyPlayground(app);
      }
    }
    const server = await new Promise(resolve => {
      app.listen(options.port, options.host, function () {
        resolve(this);
      });
    });
    this.server = server;
    if (options.startLiveQueryServer || options.liveQueryServerOptions) {
      this.liveQueryServer = await ParseServer.createLiveQueryServer(server, options.liveQueryServerOptions, options);
    }
    if (options.trustProxy) {
      app.set('trust proxy', options.trustProxy);
    }
    /* istanbul ignore next */
    if (!process.env.TESTING) {
      configureListeners(this);
    }
    this.expressApp = app;
    return this;
  }

  /**
   * Creates a new ParseServer and starts it.
   * @param {ParseServerOptions} options used to start the server
   * @returns {ParseServer} the parse server instance
   */
  static async startApp(options) {
    const parseServer = new ParseServer(options);
    return parseServer.startApp(options);
  }

  /**
   * Helper method to create a liveQuery server
   * @static
   * @param {Server} httpServer an optional http server to pass
   * @param {LiveQueryServerOptions} config options for the liveQueryServer
   * @param {ParseServerOptions} options options for the ParseServer
   * @returns {Promise<ParseLiveQueryServer>} the live query server instance
   */
  static async createLiveQueryServer(httpServer, config, options) {
    if (!httpServer || config && config.port) {
      var app = express();
      httpServer = require('http').createServer(app);
      httpServer.listen(config.port);
    }
    const server = new _ParseLiveQueryServer.ParseLiveQueryServer(httpServer, config, options);
    await server.connect();
    return server;
  }
  static async verifyServerUrl() {
    // perform a health check on the serverURL value
    if (Parse.serverURL) {
      var _response$headers;
      const isValidHttpUrl = string => {
        let url;
        try {
          url = new URL(string);
        } catch (_) {
          return false;
        }
        return url.protocol === 'http:' || url.protocol === 'https:';
      };
      const url = `${Parse.serverURL.replace(/\/$/, '')}/health`;
      if (!isValidHttpUrl(url)) {
        console.warn(`\nWARNING, Unable to connect to '${Parse.serverURL}' as the URL is invalid.` + ` Cloud code and push notifications may be unavailable!\n`);
        return;
      }
      const request = require('./request');
      const response = await request({
        url
      }).catch(response => response);
      const json = response.data || null;
      const retry = (_response$headers = response.headers) === null || _response$headers === void 0 ? void 0 : _response$headers['retry-after'];
      if (retry) {
        await new Promise(resolve => setTimeout(resolve, retry * 1000));
        return this.verifyServerUrl();
      }
      if (response.status !== 200 || (json === null || json === void 0 ? void 0 : json.status) !== 'ok') {
        /* eslint-disable no-console */
        console.warn(`\nWARNING, Unable to connect to '${Parse.serverURL}'.` + ` Cloud code and push notifications may be unavailable!\n`);
        /* eslint-enable no-console */
        return;
      }
      return true;
    }
  }
}
function addParseCloud() {
  const ParseCloud = require('./cloud-code/Parse.Cloud');
  const ParseServer = require('./cloud-code/Parse.Server');
  Object.defineProperty(Parse, 'Server', {
    get() {
      const conf = _Config.default.get(Parse.applicationId);
      return _objectSpread(_objectSpread({}, conf), ParseServer);
    },
    set(newVal) {
      newVal.appId = Parse.applicationId;
      _Config.default.put(newVal);
    },
    configurable: true
  });
  Object.assign(Parse.Cloud, ParseCloud);
  global.Parse = Parse;
}
function injectDefaults(options) {
  Object.keys(_defaults.default).forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(options, key)) {
      options[key] = _defaults.default[key];
    }
  });
  if (!Object.prototype.hasOwnProperty.call(options, 'serverURL')) {
    options.serverURL = `http://localhost:${options.port}${options.mountPath}`;
  }

  // Reserved Characters
  if (options.appId) {
    const regex = /[!#$%'()*+&/:;=?@[\]{}^,|<>]/g;
    if (options.appId.match(regex)) {
      console.warn(`\nWARNING, appId that contains special characters can cause issues while using with urls.\n`);
    }
  }

  // Backwards compatibility
  if (options.userSensitiveFields) {
    /* eslint-disable no-console */
    !process.env.TESTING && console.warn(`\nDEPRECATED: userSensitiveFields has been replaced by protectedFields allowing the ability to protect fields in all classes with CLP. \n`);
    /* eslint-enable no-console */

    const userSensitiveFields = Array.from(new Set([...(_defaults.default.userSensitiveFields || []), ...(options.userSensitiveFields || [])]));

    // If the options.protectedFields is unset,
    // it'll be assigned the default above.
    // Here, protect against the case where protectedFields
    // is set, but doesn't have _User.
    if (!('_User' in options.protectedFields)) {
      options.protectedFields = Object.assign({
        _User: []
      }, options.protectedFields);
    }
    options.protectedFields['_User']['*'] = Array.from(new Set([...(options.protectedFields['_User']['*'] || []), ...userSensitiveFields]));
  }

  // Merge protectedFields options with defaults.
  Object.keys(_defaults.default.protectedFields).forEach(c => {
    const cur = options.protectedFields[c];
    if (!cur) {
      options.protectedFields[c] = _defaults.default.protectedFields[c];
    } else {
      Object.keys(_defaults.default.protectedFields[c]).forEach(r => {
        const unq = new Set([...(options.protectedFields[c][r] || []), ..._defaults.default.protectedFields[c][r]]);
        options.protectedFields[c][r] = Array.from(unq);
      });
    }
  });
}

// Those can't be tested as it requires a subprocess
/* istanbul ignore next */
function configureListeners(parseServer) {
  const server = parseServer.server;
  const sockets = {};
  /* Currently, express doesn't shut down immediately after receiving SIGINT/SIGTERM if it has client connections that haven't timed out. (This is a known issue with node - https://github.com/nodejs/node/issues/2642)
    This function, along with `destroyAliveConnections()`, intend to fix this behavior such that parse server will close all open connections and initiate the shutdown process as soon as it receives a SIGINT/SIGTERM signal. */
  server.on('connection', socket => {
    const socketId = socket.remoteAddress + ':' + socket.remotePort;
    sockets[socketId] = socket;
    socket.on('close', () => {
      delete sockets[socketId];
    });
  });
  const destroyAliveConnections = function () {
    for (const socketId in sockets) {
      try {
        sockets[socketId].destroy();
      } catch (e) {
        /* */
      }
    }
  };
  const handleShutdown = function () {
    process.stdout.write('Termination signal received. Shutting down.');
    destroyAliveConnections();
    server.close();
    parseServer.handleShutdown();
  };
  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}
var _default = ParseServer;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfT3B0aW9ucyIsInJlcXVpcmUiLCJfZGVmYXVsdHMiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwibG9nZ2luZyIsIl9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkIiwiX0NvbmZpZyIsIl9Qcm9taXNlUm91dGVyIiwiX3JlcXVpcmVkUGFyYW1ldGVyIiwiX0FuYWx5dGljc1JvdXRlciIsIl9DbGFzc2VzUm91dGVyIiwiX0ZlYXR1cmVzUm91dGVyIiwiX0ZpbGVzUm91dGVyIiwiX0Z1bmN0aW9uc1JvdXRlciIsIl9HbG9iYWxDb25maWdSb3V0ZXIiLCJfR3JhcGhRTFJvdXRlciIsIl9Ib29rc1JvdXRlciIsIl9JQVBWYWxpZGF0aW9uUm91dGVyIiwiX0luc3RhbGxhdGlvbnNSb3V0ZXIiLCJfTG9nc1JvdXRlciIsIl9QYXJzZUxpdmVRdWVyeVNlcnZlciIsIl9QYWdlc1JvdXRlciIsIl9QdWJsaWNBUElSb3V0ZXIiLCJfUHVzaFJvdXRlciIsIl9DbG91ZENvZGVSb3V0ZXIiLCJfUm9sZXNSb3V0ZXIiLCJfU2NoZW1hc1JvdXRlciIsIl9TZXNzaW9uc1JvdXRlciIsIl9Vc2Vyc1JvdXRlciIsIl9QdXJnZVJvdXRlciIsIl9BdWRpZW5jZXNSb3V0ZXIiLCJfQWdncmVnYXRlUm91dGVyIiwiX1BhcnNlU2VydmVyUkVTVENvbnRyb2xsZXIiLCJjb250cm9sbGVycyIsIl9QYXJzZUdyYXBoUUxTZXJ2ZXIiLCJfU2VjdXJpdHlSb3V0ZXIiLCJfQ2hlY2tSdW5uZXIiLCJfRGVwcmVjYXRvciIsIl9EZWZpbmVkU2NoZW1hcyIsIl9nZXRSZXF1aXJlV2lsZGNhcmRDYWNoZSIsIm5vZGVJbnRlcm9wIiwiV2Vha01hcCIsImNhY2hlQmFiZWxJbnRlcm9wIiwiY2FjaGVOb2RlSW50ZXJvcCIsIm9iaiIsIl9fZXNNb2R1bGUiLCJkZWZhdWx0IiwiY2FjaGUiLCJoYXMiLCJnZXQiLCJuZXdPYmoiLCJoYXNQcm9wZXJ0eURlc2NyaXB0b3IiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImtleSIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImRlc2MiLCJzZXQiLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwic3ltYm9scyIsImZpbHRlciIsInN5bSIsImVudW1lcmFibGUiLCJwdXNoIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwidGFyZ2V0IiwiaSIsImFyZ3VtZW50cyIsImxlbmd0aCIsInNvdXJjZSIsImZvckVhY2giLCJfZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZGVmaW5lUHJvcGVydGllcyIsInZhbHVlIiwiX3RvUHJvcGVydHlLZXkiLCJjb25maWd1cmFibGUiLCJ3cml0YWJsZSIsImFyZyIsIl90b1ByaW1pdGl2ZSIsIlN0cmluZyIsImlucHV0IiwiaGludCIsInByaW0iLCJTeW1ib2wiLCJ0b1ByaW1pdGl2ZSIsInVuZGVmaW5lZCIsInJlcyIsIlR5cGVFcnJvciIsIk51bWJlciIsImJhdGNoIiwiYm9keVBhcnNlciIsImV4cHJlc3MiLCJtaWRkbGV3YXJlcyIsIlBhcnNlIiwicGFyc2UiLCJwYXRoIiwiZnMiLCJhZGRQYXJzZUNsb3VkIiwiUGFyc2VTZXJ2ZXIiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJEZXByZWNhdG9yIiwic2NhblBhcnNlU2VydmVyT3B0aW9ucyIsImluamVjdERlZmF1bHRzIiwiYXBwSWQiLCJyZXF1aXJlZFBhcmFtZXRlciIsIm1hc3RlcktleSIsImphdmFzY3JpcHRLZXkiLCJzZXJ2ZXJVUkwiLCJpbml0aWFsaXplIiwiQ29uZmlnIiwidmFsaWRhdGVPcHRpb25zIiwiYWxsQ29udHJvbGxlcnMiLCJnZXRDb250cm9sbGVycyIsInN0YXRlIiwiY29uZmlnIiwicHV0IiwiYXNzaWduIiwibWFzdGVyS2V5SXBzU3RvcmUiLCJNYXAiLCJtYWludGVuYW5jZUtleUlwc1N0b3JlIiwic2V0TG9nZ2VyIiwibG9nZ2VyQ29udHJvbGxlciIsInN0YXJ0IiwiZGF0YWJhc2VDb250cm9sbGVyIiwiaG9va3NDb250cm9sbGVyIiwiY2xvdWQiLCJzZWN1cml0eSIsInNjaGVtYSIsImNhY2hlQWRhcHRlciIsImxpdmVRdWVyeUNvbnRyb2xsZXIiLCJwZXJmb3JtSW5pdGlhbGl6YXRpb24iLCJlIiwiY29kZSIsIkVycm9yIiwiRFVQTElDQVRFX1ZBTFVFIiwibG9hZCIsInN0YXJ0dXBQcm9taXNlcyIsIkRlZmluZWRTY2hlbWFzIiwiZXhlY3V0ZSIsImNvbm5lY3QiLCJQcm9taXNlIiwiYWxsIiwicmVzb2x2ZSIsIl9qc29uIiwianNvbiIsInByb2Nlc3MiLCJlbnYiLCJucG1fcGFja2FnZV9qc29uIiwibnBtX3BhY2thZ2VfdHlwZSIsInR5cGUiLCJjd2QiLCJzZXRUaW1lb3V0IiwiZW5hYmxlQ2hlY2siLCJlbmFibGVDaGVja0xvZyIsIkNoZWNrUnVubmVyIiwicnVuIiwiZXJyb3IiLCJjb25zb2xlIiwiYXBwIiwiX2FwcCIsImhhbmRsZVNodXRkb3duIiwiX3RoaXMkbGl2ZVF1ZXJ5U2VydmVyIiwiX3RoaXMkbGl2ZVF1ZXJ5U2VydmVyMiIsInByb21pc2VzIiwiYWRhcHRlciIsImRhdGFiYXNlQWRhcHRlciIsImZpbGVBZGFwdGVyIiwiZmlsZXNDb250cm9sbGVyIiwiY2FjaGVDb250cm9sbGVyIiwibGl2ZVF1ZXJ5U2VydmVyIiwic2VydmVyIiwiY2xvc2UiLCJzaHV0ZG93biIsInRoZW4iLCJzZXJ2ZXJDbG9zZUNvbXBsZXRlIiwibWF4VXBsb2FkU2l6ZSIsImRpcmVjdEFjY2VzcyIsInBhZ2VzIiwicmF0ZUxpbWl0IiwiYXBpIiwidXNlIiwiYWxsb3dDcm9zc0RvbWFpbiIsIkZpbGVzUm91dGVyIiwiZXhwcmVzc1JvdXRlciIsInJlcSIsInN0YXR1cyIsInVybGVuY29kZWQiLCJleHRlbmRlZCIsImVuYWJsZVJvdXRlciIsIlBhZ2VzUm91dGVyIiwiUHVibGljQVBJUm91dGVyIiwibGltaXQiLCJhbGxvd01ldGhvZE92ZXJyaWRlIiwiaGFuZGxlUGFyc2VIZWFkZXJzIiwicm91dGVzIiwiQXJyYXkiLCJpc0FycmF5Iiwicm91dGUiLCJhZGRSYXRlTGltaXQiLCJoYW5kbGVQYXJzZVNlc3Npb24iLCJhcHBSb3V0ZXIiLCJwcm9taXNlUm91dGVyIiwiaGFuZGxlUGFyc2VFcnJvcnMiLCJURVNUSU5HIiwib24iLCJlcnIiLCJzdGRlcnIiLCJ3cml0ZSIsInBvcnQiLCJleGl0IiwidmVyaWZ5U2VydmVyVXJsIiwiUEFSU0VfU0VSVkVSX0VOQUJMRV9FWFBFUklNRU5UQUxfRElSRUNUX0FDQ0VTUyIsIkNvcmVNYW5hZ2VyIiwic2V0UkVTVENvbnRyb2xsZXIiLCJQYXJzZVNlcnZlclJFU1RDb250cm9sbGVyIiwicm91dGVycyIsIkNsYXNzZXNSb3V0ZXIiLCJVc2Vyc1JvdXRlciIsIlNlc3Npb25zUm91dGVyIiwiUm9sZXNSb3V0ZXIiLCJBbmFseXRpY3NSb3V0ZXIiLCJJbnN0YWxsYXRpb25zUm91dGVyIiwiRnVuY3Rpb25zUm91dGVyIiwiU2NoZW1hc1JvdXRlciIsIlB1c2hSb3V0ZXIiLCJMb2dzUm91dGVyIiwiSUFQVmFsaWRhdGlvblJvdXRlciIsIkZlYXR1cmVzUm91dGVyIiwiR2xvYmFsQ29uZmlnUm91dGVyIiwiR3JhcGhRTFJvdXRlciIsIlB1cmdlUm91dGVyIiwiSG9va3NSb3V0ZXIiLCJDbG91ZENvZGVSb3V0ZXIiLCJBdWRpZW5jZXNSb3V0ZXIiLCJBZ2dyZWdhdGVSb3V0ZXIiLCJTZWN1cml0eVJvdXRlciIsInJlZHVjZSIsIm1lbW8iLCJyb3V0ZXIiLCJjb25jYXQiLCJQcm9taXNlUm91dGVyIiwibW91bnRPbnRvIiwic3RhcnRBcHAiLCJtaWRkbGV3YXJlIiwibW91bnRQYXRoIiwibW91bnRHcmFwaFFMIiwibW91bnRQbGF5Z3JvdW5kIiwiZ3JhcGhRTEN1c3RvbVR5cGVEZWZzIiwiZ3JhcGhRTFNjaGVtYSIsInJlYWRGaWxlU3luYyIsInBhcnNlR3JhcGhRTFNlcnZlciIsIlBhcnNlR3JhcGhRTFNlcnZlciIsImdyYXBoUUxQYXRoIiwicGxheWdyb3VuZFBhdGgiLCJhcHBseUdyYXBoUUwiLCJhcHBseVBsYXlncm91bmQiLCJsaXN0ZW4iLCJob3N0Iiwic3RhcnRMaXZlUXVlcnlTZXJ2ZXIiLCJsaXZlUXVlcnlTZXJ2ZXJPcHRpb25zIiwiY3JlYXRlTGl2ZVF1ZXJ5U2VydmVyIiwidHJ1c3RQcm94eSIsImNvbmZpZ3VyZUxpc3RlbmVycyIsImV4cHJlc3NBcHAiLCJwYXJzZVNlcnZlciIsImh0dHBTZXJ2ZXIiLCJjcmVhdGVTZXJ2ZXIiLCJQYXJzZUxpdmVRdWVyeVNlcnZlciIsIl9yZXNwb25zZSRoZWFkZXJzIiwiaXNWYWxpZEh0dHBVcmwiLCJzdHJpbmciLCJ1cmwiLCJVUkwiLCJfIiwicHJvdG9jb2wiLCJyZXBsYWNlIiwid2FybiIsInJlcXVlc3QiLCJyZXNwb25zZSIsImNhdGNoIiwiZGF0YSIsInJldHJ5IiwiaGVhZGVycyIsIlBhcnNlQ2xvdWQiLCJjb25mIiwiYXBwbGljYXRpb25JZCIsIm5ld1ZhbCIsIkNsb3VkIiwiZ2xvYmFsIiwiZGVmYXVsdHMiLCJyZWdleCIsIm1hdGNoIiwidXNlclNlbnNpdGl2ZUZpZWxkcyIsImZyb20iLCJTZXQiLCJwcm90ZWN0ZWRGaWVsZHMiLCJfVXNlciIsImMiLCJjdXIiLCJyIiwidW5xIiwic29ja2V0cyIsInNvY2tldCIsInNvY2tldElkIiwicmVtb3RlQWRkcmVzcyIsInJlbW90ZVBvcnQiLCJkZXN0cm95QWxpdmVDb25uZWN0aW9ucyIsImRlc3Ryb3kiLCJzdGRvdXQiLCJfZGVmYXVsdCIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi9zcmMvUGFyc2VTZXJ2ZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gUGFyc2VTZXJ2ZXIgLSBvcGVuLXNvdXJjZSBjb21wYXRpYmxlIEFQSSBTZXJ2ZXIgZm9yIFBhcnNlIGFwcHNcblxudmFyIGJhdGNoID0gcmVxdWlyZSgnLi9iYXRjaCcpLFxuICBib2R5UGFyc2VyID0gcmVxdWlyZSgnYm9keS1wYXJzZXInKSxcbiAgZXhwcmVzcyA9IHJlcXVpcmUoJ2V4cHJlc3MnKSxcbiAgbWlkZGxld2FyZXMgPSByZXF1aXJlKCcuL21pZGRsZXdhcmVzJyksXG4gIFBhcnNlID0gcmVxdWlyZSgncGFyc2Uvbm9kZScpLlBhcnNlLFxuICB7IHBhcnNlIH0gPSByZXF1aXJlKCdncmFwaHFsJyksXG4gIHBhdGggPSByZXF1aXJlKCdwYXRoJyksXG4gIGZzID0gcmVxdWlyZSgnZnMnKTtcblxuaW1wb3J0IHsgUGFyc2VTZXJ2ZXJPcHRpb25zLCBMaXZlUXVlcnlTZXJ2ZXJPcHRpb25zIH0gZnJvbSAnLi9PcHRpb25zJztcbmltcG9ydCBkZWZhdWx0cyBmcm9tICcuL2RlZmF1bHRzJztcbmltcG9ydCAqIGFzIGxvZ2dpbmcgZnJvbSAnLi9sb2dnZXInO1xuaW1wb3J0IENvbmZpZyBmcm9tICcuL0NvbmZpZyc7XG5pbXBvcnQgUHJvbWlzZVJvdXRlciBmcm9tICcuL1Byb21pc2VSb3V0ZXInO1xuaW1wb3J0IHJlcXVpcmVkUGFyYW1ldGVyIGZyb20gJy4vcmVxdWlyZWRQYXJhbWV0ZXInO1xuaW1wb3J0IHsgQW5hbHl0aWNzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0FuYWx5dGljc1JvdXRlcic7XG5pbXBvcnQgeyBDbGFzc2VzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0NsYXNzZXNSb3V0ZXInO1xuaW1wb3J0IHsgRmVhdHVyZXNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvRmVhdHVyZXNSb3V0ZXInO1xuaW1wb3J0IHsgRmlsZXNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvRmlsZXNSb3V0ZXInO1xuaW1wb3J0IHsgRnVuY3Rpb25zUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0Z1bmN0aW9uc1JvdXRlcic7XG5pbXBvcnQgeyBHbG9iYWxDb25maWdSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvR2xvYmFsQ29uZmlnUm91dGVyJztcbmltcG9ydCB7IEdyYXBoUUxSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvR3JhcGhRTFJvdXRlcic7XG5pbXBvcnQgeyBIb29rc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9Ib29rc1JvdXRlcic7XG5pbXBvcnQgeyBJQVBWYWxpZGF0aW9uUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0lBUFZhbGlkYXRpb25Sb3V0ZXInO1xuaW1wb3J0IHsgSW5zdGFsbGF0aW9uc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9JbnN0YWxsYXRpb25zUm91dGVyJztcbmltcG9ydCB7IExvZ3NSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvTG9nc1JvdXRlcic7XG5pbXBvcnQgeyBQYXJzZUxpdmVRdWVyeVNlcnZlciB9IGZyb20gJy4vTGl2ZVF1ZXJ5L1BhcnNlTGl2ZVF1ZXJ5U2VydmVyJztcbmltcG9ydCB7IFBhZ2VzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL1BhZ2VzUm91dGVyJztcbmltcG9ydCB7IFB1YmxpY0FQSVJvdXRlciB9IGZyb20gJy4vUm91dGVycy9QdWJsaWNBUElSb3V0ZXInO1xuaW1wb3J0IHsgUHVzaFJvdXRlciB9IGZyb20gJy4vUm91dGVycy9QdXNoUm91dGVyJztcbmltcG9ydCB7IENsb3VkQ29kZVJvdXRlciB9IGZyb20gJy4vUm91dGVycy9DbG91ZENvZGVSb3V0ZXInO1xuaW1wb3J0IHsgUm9sZXNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvUm9sZXNSb3V0ZXInO1xuaW1wb3J0IHsgU2NoZW1hc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9TY2hlbWFzUm91dGVyJztcbmltcG9ydCB7IFNlc3Npb25zUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL1Nlc3Npb25zUm91dGVyJztcbmltcG9ydCB7IFVzZXJzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL1VzZXJzUm91dGVyJztcbmltcG9ydCB7IFB1cmdlUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL1B1cmdlUm91dGVyJztcbmltcG9ydCB7IEF1ZGllbmNlc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9BdWRpZW5jZXNSb3V0ZXInO1xuaW1wb3J0IHsgQWdncmVnYXRlUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0FnZ3JlZ2F0ZVJvdXRlcic7XG5pbXBvcnQgeyBQYXJzZVNlcnZlclJFU1RDb250cm9sbGVyIH0gZnJvbSAnLi9QYXJzZVNlcnZlclJFU1RDb250cm9sbGVyJztcbmltcG9ydCAqIGFzIGNvbnRyb2xsZXJzIGZyb20gJy4vQ29udHJvbGxlcnMnO1xuaW1wb3J0IHsgUGFyc2VHcmFwaFFMU2VydmVyIH0gZnJvbSAnLi9HcmFwaFFML1BhcnNlR3JhcGhRTFNlcnZlcic7XG5pbXBvcnQgeyBTZWN1cml0eVJvdXRlciB9IGZyb20gJy4vUm91dGVycy9TZWN1cml0eVJvdXRlcic7XG5pbXBvcnQgQ2hlY2tSdW5uZXIgZnJvbSAnLi9TZWN1cml0eS9DaGVja1J1bm5lcic7XG5pbXBvcnQgRGVwcmVjYXRvciBmcm9tICcuL0RlcHJlY2F0b3IvRGVwcmVjYXRvcic7XG5pbXBvcnQgeyBEZWZpbmVkU2NoZW1hcyB9IGZyb20gJy4vU2NoZW1hTWlncmF0aW9ucy9EZWZpbmVkU2NoZW1hcyc7XG5cbi8vIE11dGF0ZSB0aGUgUGFyc2Ugb2JqZWN0IHRvIGFkZCB0aGUgQ2xvdWQgQ29kZSBoYW5kbGVyc1xuYWRkUGFyc2VDbG91ZCgpO1xuXG4vLyBQYXJzZVNlcnZlciB3b3JrcyBsaWtlIGEgY29uc3RydWN0b3Igb2YgYW4gZXhwcmVzcyBhcHAuXG4vLyBodHRwczovL3BhcnNlcGxhdGZvcm0ub3JnL3BhcnNlLXNlcnZlci9hcGkvbWFzdGVyL1BhcnNlU2VydmVyT3B0aW9ucy5odG1sXG5jbGFzcyBQYXJzZVNlcnZlciB7XG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtQYXJzZVNlcnZlck9wdGlvbnN9IG9wdGlvbnMgdGhlIHBhcnNlIHNlcnZlciBpbml0aWFsaXphdGlvbiBvcHRpb25zXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBQYXJzZVNlcnZlck9wdGlvbnMpIHtcbiAgICAvLyBTY2FuIGZvciBkZXByZWNhdGVkIFBhcnNlIFNlcnZlciBvcHRpb25zXG4gICAgRGVwcmVjYXRvci5zY2FuUGFyc2VTZXJ2ZXJPcHRpb25zKG9wdGlvbnMpO1xuICAgIC8vIFNldCBvcHRpb24gZGVmYXVsdHNcbiAgICBpbmplY3REZWZhdWx0cyhvcHRpb25zKTtcbiAgICBjb25zdCB7XG4gICAgICBhcHBJZCA9IHJlcXVpcmVkUGFyYW1ldGVyKCdZb3UgbXVzdCBwcm92aWRlIGFuIGFwcElkIScpLFxuICAgICAgbWFzdGVyS2V5ID0gcmVxdWlyZWRQYXJhbWV0ZXIoJ1lvdSBtdXN0IHByb3ZpZGUgYSBtYXN0ZXJLZXkhJyksXG4gICAgICBqYXZhc2NyaXB0S2V5LFxuICAgICAgc2VydmVyVVJMID0gcmVxdWlyZWRQYXJhbWV0ZXIoJ1lvdSBtdXN0IHByb3ZpZGUgYSBzZXJ2ZXJVUkwhJyksXG4gICAgfSA9IG9wdGlvbnM7XG4gICAgLy8gSW5pdGlhbGl6ZSB0aGUgbm9kZSBjbGllbnQgU0RLIGF1dG9tYXRpY2FsbHlcbiAgICBQYXJzZS5pbml0aWFsaXplKGFwcElkLCBqYXZhc2NyaXB0S2V5IHx8ICd1bnVzZWQnLCBtYXN0ZXJLZXkpO1xuICAgIFBhcnNlLnNlcnZlclVSTCA9IHNlcnZlclVSTDtcblxuICAgIENvbmZpZy52YWxpZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgY29uc3QgYWxsQ29udHJvbGxlcnMgPSBjb250cm9sbGVycy5nZXRDb250cm9sbGVycyhvcHRpb25zKTtcbiAgICBvcHRpb25zLnN0YXRlID0gJ2luaXRpYWxpemVkJztcbiAgICB0aGlzLmNvbmZpZyA9IENvbmZpZy5wdXQoT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywgYWxsQ29udHJvbGxlcnMpKTtcbiAgICB0aGlzLmNvbmZpZy5tYXN0ZXJLZXlJcHNTdG9yZSA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLmNvbmZpZy5tYWludGVuYW5jZUtleUlwc1N0b3JlID0gbmV3IE1hcCgpO1xuICAgIGxvZ2dpbmcuc2V0TG9nZ2VyKGFsbENvbnRyb2xsZXJzLmxvZ2dlckNvbnRyb2xsZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0cyBQYXJzZSBTZXJ2ZXIgYXMgYW4gZXhwcmVzcyBhcHA7IHRoaXMgcHJvbWlzZSByZXNvbHZlcyB3aGVuIFBhcnNlIFNlcnZlciBpcyByZWFkeSB0byBhY2NlcHQgcmVxdWVzdHMuXG4gICAqL1xuXG4gIGFzeW5jIHN0YXJ0KCkge1xuICAgIHRyeSB7XG4gICAgICBpZiAodGhpcy5jb25maWcuc3RhdGUgPT09ICdvaycpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgICB0aGlzLmNvbmZpZy5zdGF0ZSA9ICdzdGFydGluZyc7XG4gICAgICBDb25maWcucHV0KHRoaXMuY29uZmlnKTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgZGF0YWJhc2VDb250cm9sbGVyLFxuICAgICAgICBob29rc0NvbnRyb2xsZXIsXG4gICAgICAgIGNsb3VkLFxuICAgICAgICBzZWN1cml0eSxcbiAgICAgICAgc2NoZW1hLFxuICAgICAgICBjYWNoZUFkYXB0ZXIsXG4gICAgICAgIGxpdmVRdWVyeUNvbnRyb2xsZXIsXG4gICAgICB9ID0gdGhpcy5jb25maWc7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBkYXRhYmFzZUNvbnRyb2xsZXIucGVyZm9ybUluaXRpYWxpemF0aW9uKCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChlLmNvZGUgIT09IFBhcnNlLkVycm9yLkRVUExJQ0FURV9WQUxVRSkge1xuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGF3YWl0IGhvb2tzQ29udHJvbGxlci5sb2FkKCk7XG4gICAgICBjb25zdCBzdGFydHVwUHJvbWlzZXMgPSBbXTtcbiAgICAgIGlmIChzY2hlbWEpIHtcbiAgICAgICAgc3RhcnR1cFByb21pc2VzLnB1c2gobmV3IERlZmluZWRTY2hlbWFzKHNjaGVtYSwgdGhpcy5jb25maWcpLmV4ZWN1dGUoKSk7XG4gICAgICB9XG4gICAgICBpZiAoY2FjaGVBZGFwdGVyPy5jb25uZWN0ICYmIHR5cGVvZiBjYWNoZUFkYXB0ZXIuY29ubmVjdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBzdGFydHVwUHJvbWlzZXMucHVzaChjYWNoZUFkYXB0ZXIuY29ubmVjdCgpKTtcbiAgICAgIH1cbiAgICAgIHN0YXJ0dXBQcm9taXNlcy5wdXNoKGxpdmVRdWVyeUNvbnRyb2xsZXIuY29ubmVjdCgpKTtcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKHN0YXJ0dXBQcm9taXNlcyk7XG4gICAgICBpZiAoY2xvdWQpIHtcbiAgICAgICAgYWRkUGFyc2VDbG91ZCgpO1xuICAgICAgICBpZiAodHlwZW9mIGNsb3VkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgYXdhaXQgUHJvbWlzZS5yZXNvbHZlKGNsb3VkKFBhcnNlKSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGNsb3VkID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGxldCBqc29uO1xuICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5ucG1fcGFja2FnZV9qc29uKSB7XG4gICAgICAgICAgICBqc29uID0gcmVxdWlyZShwcm9jZXNzLmVudi5ucG1fcGFja2FnZV9qc29uKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHByb2Nlc3MuZW52Lm5wbV9wYWNrYWdlX3R5cGUgPT09ICdtb2R1bGUnIHx8IGpzb24/LnR5cGUgPT09ICdtb2R1bGUnKSB7XG4gICAgICAgICAgICBhd2FpdCBpbXBvcnQocGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIGNsb3VkKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcXVpcmUocGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIGNsb3VkKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IFwiYXJndW1lbnQgJ2Nsb3VkJyBtdXN0IGVpdGhlciBiZSBhIHN0cmluZyBvciBhIGZ1bmN0aW9uXCI7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwKSk7XG4gICAgICB9XG4gICAgICBpZiAoc2VjdXJpdHkgJiYgc2VjdXJpdHkuZW5hYmxlQ2hlY2sgJiYgc2VjdXJpdHkuZW5hYmxlQ2hlY2tMb2cpIHtcbiAgICAgICAgbmV3IENoZWNrUnVubmVyKHNlY3VyaXR5KS5ydW4oKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY29uZmlnLnN0YXRlID0gJ29rJztcbiAgICAgIENvbmZpZy5wdXQodGhpcy5jb25maWcpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgdGhpcy5jb25maWcuc3RhdGUgPSAnZXJyb3InO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgZ2V0IGFwcCgpIHtcbiAgICBpZiAoIXRoaXMuX2FwcCkge1xuICAgICAgdGhpcy5fYXBwID0gUGFyc2VTZXJ2ZXIuYXBwKHRoaXMuY29uZmlnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2FwcDtcbiAgfVxuXG4gIGhhbmRsZVNodXRkb3duKCkge1xuICAgIGNvbnN0IHByb21pc2VzID0gW107XG4gICAgY29uc3QgeyBhZGFwdGVyOiBkYXRhYmFzZUFkYXB0ZXIgfSA9IHRoaXMuY29uZmlnLmRhdGFiYXNlQ29udHJvbGxlcjtcbiAgICBpZiAoZGF0YWJhc2VBZGFwdGVyICYmIHR5cGVvZiBkYXRhYmFzZUFkYXB0ZXIuaGFuZGxlU2h1dGRvd24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHByb21pc2VzLnB1c2goZGF0YWJhc2VBZGFwdGVyLmhhbmRsZVNodXRkb3duKCkpO1xuICAgIH1cbiAgICBjb25zdCB7IGFkYXB0ZXI6IGZpbGVBZGFwdGVyIH0gPSB0aGlzLmNvbmZpZy5maWxlc0NvbnRyb2xsZXI7XG4gICAgaWYgKGZpbGVBZGFwdGVyICYmIHR5cGVvZiBmaWxlQWRhcHRlci5oYW5kbGVTaHV0ZG93biA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcHJvbWlzZXMucHVzaChmaWxlQWRhcHRlci5oYW5kbGVTaHV0ZG93bigpKTtcbiAgICB9XG4gICAgY29uc3QgeyBhZGFwdGVyOiBjYWNoZUFkYXB0ZXIgfSA9IHRoaXMuY29uZmlnLmNhY2hlQ29udHJvbGxlcjtcbiAgICBpZiAoY2FjaGVBZGFwdGVyICYmIHR5cGVvZiBjYWNoZUFkYXB0ZXIuaGFuZGxlU2h1dGRvd24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHByb21pc2VzLnB1c2goY2FjaGVBZGFwdGVyLmhhbmRsZVNodXRkb3duKCkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5saXZlUXVlcnlTZXJ2ZXI/LnNlcnZlcj8uY2xvc2UpIHtcbiAgICAgIHByb21pc2VzLnB1c2gobmV3IFByb21pc2UocmVzb2x2ZSA9PiB0aGlzLmxpdmVRdWVyeVNlcnZlci5zZXJ2ZXIuY2xvc2UocmVzb2x2ZSkpKTtcbiAgICB9XG4gICAgaWYgKHRoaXMubGl2ZVF1ZXJ5U2VydmVyKSB7XG4gICAgICBwcm9taXNlcy5wdXNoKHRoaXMubGl2ZVF1ZXJ5U2VydmVyLnNodXRkb3duKCkpO1xuICAgIH1cbiAgICByZXR1cm4gKHByb21pc2VzLmxlbmd0aCA+IDAgPyBQcm9taXNlLmFsbChwcm9taXNlcykgOiBQcm9taXNlLnJlc29sdmUoKSkudGhlbigoKSA9PiB7XG4gICAgICBpZiAodGhpcy5jb25maWcuc2VydmVyQ2xvc2VDb21wbGV0ZSkge1xuICAgICAgICB0aGlzLmNvbmZpZy5zZXJ2ZXJDbG9zZUNvbXBsZXRlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQHN0YXRpY1xuICAgKiBDcmVhdGUgYW4gZXhwcmVzcyBhcHAgZm9yIHRoZSBwYXJzZSBzZXJ2ZXJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgbGV0IHlvdSBzcGVjaWZ5IHRoZSBtYXhVcGxvYWRTaXplIHdoZW4gY3JlYXRpbmcgdGhlIGV4cHJlc3MgYXBwICAqL1xuICBzdGF0aWMgYXBwKG9wdGlvbnMpIHtcbiAgICBjb25zdCB7IG1heFVwbG9hZFNpemUgPSAnMjBtYicsIGFwcElkLCBkaXJlY3RBY2Nlc3MsIHBhZ2VzLCByYXRlTGltaXQgPSBbXSB9ID0gb3B0aW9ucztcbiAgICAvLyBUaGlzIGFwcCBzZXJ2ZXMgdGhlIFBhcnNlIEFQSSBkaXJlY3RseS5cbiAgICAvLyBJdCdzIHRoZSBlcXVpdmFsZW50IG9mIGh0dHBzOi8vYXBpLnBhcnNlLmNvbS8xIGluIHRoZSBob3N0ZWQgUGFyc2UgQVBJLlxuICAgIHZhciBhcGkgPSBleHByZXNzKCk7XG4gICAgLy9hcGkudXNlKFwiL2FwcHNcIiwgZXhwcmVzcy5zdGF0aWMoX19kaXJuYW1lICsgXCIvcHVibGljXCIpKTtcbiAgICBhcGkudXNlKG1pZGRsZXdhcmVzLmFsbG93Q3Jvc3NEb21haW4oYXBwSWQpKTtcbiAgICAvLyBGaWxlIGhhbmRsaW5nIG5lZWRzIHRvIGJlIGJlZm9yZSBkZWZhdWx0IG1pZGRsZXdhcmVzIGFyZSBhcHBsaWVkXG4gICAgYXBpLnVzZShcbiAgICAgICcvJyxcbiAgICAgIG5ldyBGaWxlc1JvdXRlcigpLmV4cHJlc3NSb3V0ZXIoe1xuICAgICAgICBtYXhVcGxvYWRTaXplOiBtYXhVcGxvYWRTaXplLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgYXBpLnVzZSgnL2hlYWx0aCcsIGZ1bmN0aW9uIChyZXEsIHJlcykge1xuICAgICAgcmVzLnN0YXR1cyhvcHRpb25zLnN0YXRlID09PSAnb2snID8gMjAwIDogNTAzKTtcbiAgICAgIGlmIChvcHRpb25zLnN0YXRlID09PSAnc3RhcnRpbmcnKSB7XG4gICAgICAgIHJlcy5zZXQoJ1JldHJ5LUFmdGVyJywgMSk7XG4gICAgICB9XG4gICAgICByZXMuanNvbih7XG4gICAgICAgIHN0YXR1czogb3B0aW9ucy5zdGF0ZSxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgYXBpLnVzZShcbiAgICAgICcvJyxcbiAgICAgIGJvZHlQYXJzZXIudXJsZW5jb2RlZCh7IGV4dGVuZGVkOiBmYWxzZSB9KSxcbiAgICAgIHBhZ2VzLmVuYWJsZVJvdXRlclxuICAgICAgICA/IG5ldyBQYWdlc1JvdXRlcihwYWdlcykuZXhwcmVzc1JvdXRlcigpXG4gICAgICAgIDogbmV3IFB1YmxpY0FQSVJvdXRlcigpLmV4cHJlc3NSb3V0ZXIoKVxuICAgICk7XG5cbiAgICBhcGkudXNlKGJvZHlQYXJzZXIuanNvbih7IHR5cGU6ICcqLyonLCBsaW1pdDogbWF4VXBsb2FkU2l6ZSB9KSk7XG4gICAgYXBpLnVzZShtaWRkbGV3YXJlcy5hbGxvd01ldGhvZE92ZXJyaWRlKTtcbiAgICBhcGkudXNlKG1pZGRsZXdhcmVzLmhhbmRsZVBhcnNlSGVhZGVycyk7XG4gICAgY29uc3Qgcm91dGVzID0gQXJyYXkuaXNBcnJheShyYXRlTGltaXQpID8gcmF0ZUxpbWl0IDogW3JhdGVMaW1pdF07XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiByb3V0ZXMpIHtcbiAgICAgIG1pZGRsZXdhcmVzLmFkZFJhdGVMaW1pdChyb3V0ZSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIGFwaS51c2UobWlkZGxld2FyZXMuaGFuZGxlUGFyc2VTZXNzaW9uKTtcblxuICAgIGNvbnN0IGFwcFJvdXRlciA9IFBhcnNlU2VydmVyLnByb21pc2VSb3V0ZXIoeyBhcHBJZCB9KTtcbiAgICBhcGkudXNlKGFwcFJvdXRlci5leHByZXNzUm91dGVyKCkpO1xuXG4gICAgYXBpLnVzZShtaWRkbGV3YXJlcy5oYW5kbGVQYXJzZUVycm9ycyk7XG5cbiAgICAvLyBydW4gdGhlIGZvbGxvd2luZyB3aGVuIG5vdCB0ZXN0aW5nXG4gICAgaWYgKCFwcm9jZXNzLmVudi5URVNUSU5HKSB7XG4gICAgICAvL1RoaXMgY2F1c2VzIHRlc3RzIHRvIHNwZXcgc29tZSB1c2VsZXNzIHdhcm5pbmdzLCBzbyBkaXNhYmxlIGluIHRlc3RcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICBwcm9jZXNzLm9uKCd1bmNhdWdodEV4Y2VwdGlvbicsIGVyciA9PiB7XG4gICAgICAgIGlmIChlcnIuY29kZSA9PT0gJ0VBRERSSU5VU0UnKSB7XG4gICAgICAgICAgLy8gdXNlci1mcmllbmRseSBtZXNzYWdlIGZvciB0aGlzIGNvbW1vbiBlcnJvclxuICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKGBVbmFibGUgdG8gbGlzdGVuIG9uIHBvcnQgJHtlcnIucG9ydH0uIFRoZSBwb3J0IGlzIGFscmVhZHkgaW4gdXNlLmApO1xuICAgICAgICAgIHByb2Nlc3MuZXhpdCgwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gdmVyaWZ5IHRoZSBzZXJ2ZXIgdXJsIGFmdGVyIGEgJ21vdW50JyBldmVudCBpcyByZWNlaXZlZFxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIGFwaS5vbignbW91bnQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDAwKSk7XG4gICAgICAgIFBhcnNlU2VydmVyLnZlcmlmeVNlcnZlclVybCgpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChwcm9jZXNzLmVudi5QQVJTRV9TRVJWRVJfRU5BQkxFX0VYUEVSSU1FTlRBTF9ESVJFQ1RfQUNDRVNTID09PSAnMScgfHwgZGlyZWN0QWNjZXNzKSB7XG4gICAgICBQYXJzZS5Db3JlTWFuYWdlci5zZXRSRVNUQ29udHJvbGxlcihQYXJzZVNlcnZlclJFU1RDb250cm9sbGVyKGFwcElkLCBhcHBSb3V0ZXIpKTtcbiAgICB9XG4gICAgcmV0dXJuIGFwaTtcbiAgfVxuXG4gIHN0YXRpYyBwcm9taXNlUm91dGVyKHsgYXBwSWQgfSkge1xuICAgIGNvbnN0IHJvdXRlcnMgPSBbXG4gICAgICBuZXcgQ2xhc3Nlc1JvdXRlcigpLFxuICAgICAgbmV3IFVzZXJzUm91dGVyKCksXG4gICAgICBuZXcgU2Vzc2lvbnNSb3V0ZXIoKSxcbiAgICAgIG5ldyBSb2xlc1JvdXRlcigpLFxuICAgICAgbmV3IEFuYWx5dGljc1JvdXRlcigpLFxuICAgICAgbmV3IEluc3RhbGxhdGlvbnNSb3V0ZXIoKSxcbiAgICAgIG5ldyBGdW5jdGlvbnNSb3V0ZXIoKSxcbiAgICAgIG5ldyBTY2hlbWFzUm91dGVyKCksXG4gICAgICBuZXcgUHVzaFJvdXRlcigpLFxuICAgICAgbmV3IExvZ3NSb3V0ZXIoKSxcbiAgICAgIG5ldyBJQVBWYWxpZGF0aW9uUm91dGVyKCksXG4gICAgICBuZXcgRmVhdHVyZXNSb3V0ZXIoKSxcbiAgICAgIG5ldyBHbG9iYWxDb25maWdSb3V0ZXIoKSxcbiAgICAgIG5ldyBHcmFwaFFMUm91dGVyKCksXG4gICAgICBuZXcgUHVyZ2VSb3V0ZXIoKSxcbiAgICAgIG5ldyBIb29rc1JvdXRlcigpLFxuICAgICAgbmV3IENsb3VkQ29kZVJvdXRlcigpLFxuICAgICAgbmV3IEF1ZGllbmNlc1JvdXRlcigpLFxuICAgICAgbmV3IEFnZ3JlZ2F0ZVJvdXRlcigpLFxuICAgICAgbmV3IFNlY3VyaXR5Um91dGVyKCksXG4gICAgXTtcblxuICAgIGNvbnN0IHJvdXRlcyA9IHJvdXRlcnMucmVkdWNlKChtZW1vLCByb3V0ZXIpID0+IHtcbiAgICAgIHJldHVybiBtZW1vLmNvbmNhdChyb3V0ZXIucm91dGVzKTtcbiAgICB9LCBbXSk7XG5cbiAgICBjb25zdCBhcHBSb3V0ZXIgPSBuZXcgUHJvbWlzZVJvdXRlcihyb3V0ZXMsIGFwcElkKTtcblxuICAgIGJhdGNoLm1vdW50T250byhhcHBSb3V0ZXIpO1xuICAgIHJldHVybiBhcHBSb3V0ZXI7XG4gIH1cblxuICAvKipcbiAgICogc3RhcnRzIHRoZSBwYXJzZSBzZXJ2ZXIncyBleHByZXNzIGFwcFxuICAgKiBAcGFyYW0ge1BhcnNlU2VydmVyT3B0aW9uc30gb3B0aW9ucyB0byB1c2UgdG8gc3RhcnQgdGhlIHNlcnZlclxuICAgKiBAcmV0dXJucyB7UGFyc2VTZXJ2ZXJ9IHRoZSBwYXJzZSBzZXJ2ZXIgaW5zdGFuY2VcbiAgICovXG5cbiAgYXN5bmMgc3RhcnRBcHAob3B0aW9uczogUGFyc2VTZXJ2ZXJPcHRpb25zKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuc3RhcnQoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBvbiBQYXJzZVNlcnZlci5zdGFydEFwcDogJywgZSk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgICBjb25zdCBhcHAgPSBleHByZXNzKCk7XG4gICAgaWYgKG9wdGlvbnMubWlkZGxld2FyZSkge1xuICAgICAgbGV0IG1pZGRsZXdhcmU7XG4gICAgICBpZiAodHlwZW9mIG9wdGlvbnMubWlkZGxld2FyZSA9PSAnc3RyaW5nJykge1xuICAgICAgICBtaWRkbGV3YXJlID0gcmVxdWlyZShwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgb3B0aW9ucy5taWRkbGV3YXJlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtaWRkbGV3YXJlID0gb3B0aW9ucy5taWRkbGV3YXJlOyAvLyB1c2UgYXMtaXMgbGV0IGV4cHJlc3MgZmFpbFxuICAgICAgfVxuICAgICAgYXBwLnVzZShtaWRkbGV3YXJlKTtcbiAgICB9XG4gICAgYXBwLnVzZShvcHRpb25zLm1vdW50UGF0aCwgdGhpcy5hcHApO1xuXG4gICAgaWYgKG9wdGlvbnMubW91bnRHcmFwaFFMID09PSB0cnVlIHx8IG9wdGlvbnMubW91bnRQbGF5Z3JvdW5kID09PSB0cnVlKSB7XG4gICAgICBsZXQgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzID0gdW5kZWZpbmVkO1xuICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLmdyYXBoUUxTY2hlbWEgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGdyYXBoUUxDdXN0b21UeXBlRGVmcyA9IHBhcnNlKGZzLnJlYWRGaWxlU3luYyhvcHRpb25zLmdyYXBoUUxTY2hlbWEsICd1dGY4JykpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgdHlwZW9mIG9wdGlvbnMuZ3JhcGhRTFNjaGVtYSA9PT0gJ29iamVjdCcgfHxcbiAgICAgICAgdHlwZW9mIG9wdGlvbnMuZ3JhcGhRTFNjaGVtYSA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgKSB7XG4gICAgICAgIGdyYXBoUUxDdXN0b21UeXBlRGVmcyA9IG9wdGlvbnMuZ3JhcGhRTFNjaGVtYTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFyc2VHcmFwaFFMU2VydmVyID0gbmV3IFBhcnNlR3JhcGhRTFNlcnZlcih0aGlzLCB7XG4gICAgICAgIGdyYXBoUUxQYXRoOiBvcHRpb25zLmdyYXBoUUxQYXRoLFxuICAgICAgICBwbGF5Z3JvdW5kUGF0aDogb3B0aW9ucy5wbGF5Z3JvdW5kUGF0aCxcbiAgICAgICAgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChvcHRpb25zLm1vdW50R3JhcGhRTCkge1xuICAgICAgICBwYXJzZUdyYXBoUUxTZXJ2ZXIuYXBwbHlHcmFwaFFMKGFwcCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLm1vdW50UGxheWdyb3VuZCkge1xuICAgICAgICBwYXJzZUdyYXBoUUxTZXJ2ZXIuYXBwbHlQbGF5Z3JvdW5kKGFwcCk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHNlcnZlciA9IGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgYXBwLmxpc3RlbihvcHRpb25zLnBvcnQsIG9wdGlvbnMuaG9zdCwgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXNvbHZlKHRoaXMpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdGhpcy5zZXJ2ZXIgPSBzZXJ2ZXI7XG5cbiAgICBpZiAob3B0aW9ucy5zdGFydExpdmVRdWVyeVNlcnZlciB8fCBvcHRpb25zLmxpdmVRdWVyeVNlcnZlck9wdGlvbnMpIHtcbiAgICAgIHRoaXMubGl2ZVF1ZXJ5U2VydmVyID0gYXdhaXQgUGFyc2VTZXJ2ZXIuY3JlYXRlTGl2ZVF1ZXJ5U2VydmVyKFxuICAgICAgICBzZXJ2ZXIsXG4gICAgICAgIG9wdGlvbnMubGl2ZVF1ZXJ5U2VydmVyT3B0aW9ucyxcbiAgICAgICAgb3B0aW9uc1xuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMudHJ1c3RQcm94eSkge1xuICAgICAgYXBwLnNldCgndHJ1c3QgcHJveHknLCBvcHRpb25zLnRydXN0UHJveHkpO1xuICAgIH1cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICghcHJvY2Vzcy5lbnYuVEVTVElORykge1xuICAgICAgY29uZmlndXJlTGlzdGVuZXJzKHRoaXMpO1xuICAgIH1cbiAgICB0aGlzLmV4cHJlc3NBcHAgPSBhcHA7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBQYXJzZVNlcnZlciBhbmQgc3RhcnRzIGl0LlxuICAgKiBAcGFyYW0ge1BhcnNlU2VydmVyT3B0aW9uc30gb3B0aW9ucyB1c2VkIHRvIHN0YXJ0IHRoZSBzZXJ2ZXJcbiAgICogQHJldHVybnMge1BhcnNlU2VydmVyfSB0aGUgcGFyc2Ugc2VydmVyIGluc3RhbmNlXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgc3RhcnRBcHAob3B0aW9uczogUGFyc2VTZXJ2ZXJPcHRpb25zKSB7XG4gICAgY29uc3QgcGFyc2VTZXJ2ZXIgPSBuZXcgUGFyc2VTZXJ2ZXIob3B0aW9ucyk7XG4gICAgcmV0dXJuIHBhcnNlU2VydmVyLnN0YXJ0QXBwKG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBtZXRob2QgdG8gY3JlYXRlIGEgbGl2ZVF1ZXJ5IHNlcnZlclxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7U2VydmVyfSBodHRwU2VydmVyIGFuIG9wdGlvbmFsIGh0dHAgc2VydmVyIHRvIHBhc3NcbiAgICogQHBhcmFtIHtMaXZlUXVlcnlTZXJ2ZXJPcHRpb25zfSBjb25maWcgb3B0aW9ucyBmb3IgdGhlIGxpdmVRdWVyeVNlcnZlclxuICAgKiBAcGFyYW0ge1BhcnNlU2VydmVyT3B0aW9uc30gb3B0aW9ucyBvcHRpb25zIGZvciB0aGUgUGFyc2VTZXJ2ZXJcbiAgICogQHJldHVybnMge1Byb21pc2U8UGFyc2VMaXZlUXVlcnlTZXJ2ZXI+fSB0aGUgbGl2ZSBxdWVyeSBzZXJ2ZXIgaW5zdGFuY2VcbiAgICovXG4gIHN0YXRpYyBhc3luYyBjcmVhdGVMaXZlUXVlcnlTZXJ2ZXIoXG4gICAgaHR0cFNlcnZlcixcbiAgICBjb25maWc6IExpdmVRdWVyeVNlcnZlck9wdGlvbnMsXG4gICAgb3B0aW9uczogUGFyc2VTZXJ2ZXJPcHRpb25zXG4gICkge1xuICAgIGlmICghaHR0cFNlcnZlciB8fCAoY29uZmlnICYmIGNvbmZpZy5wb3J0KSkge1xuICAgICAgdmFyIGFwcCA9IGV4cHJlc3MoKTtcbiAgICAgIGh0dHBTZXJ2ZXIgPSByZXF1aXJlKCdodHRwJykuY3JlYXRlU2VydmVyKGFwcCk7XG4gICAgICBodHRwU2VydmVyLmxpc3Rlbihjb25maWcucG9ydCk7XG4gICAgfVxuICAgIGNvbnN0IHNlcnZlciA9IG5ldyBQYXJzZUxpdmVRdWVyeVNlcnZlcihodHRwU2VydmVyLCBjb25maWcsIG9wdGlvbnMpO1xuICAgIGF3YWl0IHNlcnZlci5jb25uZWN0KCk7XG4gICAgcmV0dXJuIHNlcnZlcjtcbiAgfVxuXG4gIHN0YXRpYyBhc3luYyB2ZXJpZnlTZXJ2ZXJVcmwoKSB7XG4gICAgLy8gcGVyZm9ybSBhIGhlYWx0aCBjaGVjayBvbiB0aGUgc2VydmVyVVJMIHZhbHVlXG4gICAgaWYgKFBhcnNlLnNlcnZlclVSTCkge1xuICAgICAgY29uc3QgaXNWYWxpZEh0dHBVcmwgPSBzdHJpbmcgPT4ge1xuICAgICAgICBsZXQgdXJsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHVybCA9IG5ldyBVUkwoc3RyaW5nKTtcbiAgICAgICAgfSBjYXRjaCAoXykge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSAnaHR0cDonIHx8IHVybC5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gICAgICB9O1xuICAgICAgY29uc3QgdXJsID0gYCR7UGFyc2Uuc2VydmVyVVJMLnJlcGxhY2UoL1xcLyQvLCAnJyl9L2hlYWx0aGA7XG4gICAgICBpZiAoIWlzVmFsaWRIdHRwVXJsKHVybCkpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBcXG5XQVJOSU5HLCBVbmFibGUgdG8gY29ubmVjdCB0byAnJHtQYXJzZS5zZXJ2ZXJVUkx9JyBhcyB0aGUgVVJMIGlzIGludmFsaWQuYCArXG4gICAgICAgICAgICBgIENsb3VkIGNvZGUgYW5kIHB1c2ggbm90aWZpY2F0aW9ucyBtYXkgYmUgdW5hdmFpbGFibGUhXFxuYFxuICAgICAgICApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCByZXF1ZXN0ID0gcmVxdWlyZSgnLi9yZXF1ZXN0Jyk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3QoeyB1cmwgfSkuY2F0Y2gocmVzcG9uc2UgPT4gcmVzcG9uc2UpO1xuICAgICAgY29uc3QganNvbiA9IHJlc3BvbnNlLmRhdGEgfHwgbnVsbDtcbiAgICAgIGNvbnN0IHJldHJ5ID0gcmVzcG9uc2UuaGVhZGVycz8uWydyZXRyeS1hZnRlciddO1xuICAgICAgaWYgKHJldHJ5KSB7XG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCByZXRyeSAqIDEwMDApKTtcbiAgICAgICAgcmV0dXJuIHRoaXMudmVyaWZ5U2VydmVyVXJsKCk7XG4gICAgICB9XG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzICE9PSAyMDAgfHwganNvbj8uc3RhdHVzICE9PSAnb2snKSB7XG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIGBcXG5XQVJOSU5HLCBVbmFibGUgdG8gY29ubmVjdCB0byAnJHtQYXJzZS5zZXJ2ZXJVUkx9Jy5gICtcbiAgICAgICAgICAgIGAgQ2xvdWQgY29kZSBhbmQgcHVzaCBub3RpZmljYXRpb25zIG1heSBiZSB1bmF2YWlsYWJsZSFcXG5gXG4gICAgICAgICk7XG4gICAgICAgIC8qIGVzbGludC1lbmFibGUgbm8tY29uc29sZSAqL1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkUGFyc2VDbG91ZCgpIHtcbiAgY29uc3QgUGFyc2VDbG91ZCA9IHJlcXVpcmUoJy4vY2xvdWQtY29kZS9QYXJzZS5DbG91ZCcpO1xuICBjb25zdCBQYXJzZVNlcnZlciA9IHJlcXVpcmUoJy4vY2xvdWQtY29kZS9QYXJzZS5TZXJ2ZXInKTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFBhcnNlLCAnU2VydmVyJywge1xuICAgIGdldCgpIHtcbiAgICAgIGNvbnN0IGNvbmYgPSBDb25maWcuZ2V0KFBhcnNlLmFwcGxpY2F0aW9uSWQpO1xuICAgICAgcmV0dXJuIHsgLi4uY29uZiwgLi4uUGFyc2VTZXJ2ZXIgfTtcbiAgICB9LFxuICAgIHNldChuZXdWYWwpIHtcbiAgICAgIG5ld1ZhbC5hcHBJZCA9IFBhcnNlLmFwcGxpY2F0aW9uSWQ7XG4gICAgICBDb25maWcucHV0KG5ld1ZhbCk7XG4gICAgfSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gIH0pO1xuICBPYmplY3QuYXNzaWduKFBhcnNlLkNsb3VkLCBQYXJzZUNsb3VkKTtcbiAgZ2xvYmFsLlBhcnNlID0gUGFyc2U7XG59XG5cbmZ1bmN0aW9uIGluamVjdERlZmF1bHRzKG9wdGlvbnM6IFBhcnNlU2VydmVyT3B0aW9ucykge1xuICBPYmplY3Qua2V5cyhkZWZhdWx0cykuZm9yRWFjaChrZXkgPT4ge1xuICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9wdGlvbnMsIGtleSkpIHtcbiAgICAgIG9wdGlvbnNba2V5XSA9IGRlZmF1bHRzW2tleV07XG4gICAgfVxuICB9KTtcblxuICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvcHRpb25zLCAnc2VydmVyVVJMJykpIHtcbiAgICBvcHRpb25zLnNlcnZlclVSTCA9IGBodHRwOi8vbG9jYWxob3N0OiR7b3B0aW9ucy5wb3J0fSR7b3B0aW9ucy5tb3VudFBhdGh9YDtcbiAgfVxuXG4gIC8vIFJlc2VydmVkIENoYXJhY3RlcnNcbiAgaWYgKG9wdGlvbnMuYXBwSWQpIHtcbiAgICBjb25zdCByZWdleCA9IC9bISMkJScoKSorJi86Oz0/QFtcXF17fV4sfDw+XS9nO1xuICAgIGlmIChvcHRpb25zLmFwcElkLm1hdGNoKHJlZ2V4KSkge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBgXFxuV0FSTklORywgYXBwSWQgdGhhdCBjb250YWlucyBzcGVjaWFsIGNoYXJhY3RlcnMgY2FuIGNhdXNlIGlzc3VlcyB3aGlsZSB1c2luZyB3aXRoIHVybHMuXFxuYFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvLyBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICBpZiAob3B0aW9ucy51c2VyU2Vuc2l0aXZlRmllbGRzKSB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuICAgICFwcm9jZXNzLmVudi5URVNUSU5HICYmXG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBcXG5ERVBSRUNBVEVEOiB1c2VyU2Vuc2l0aXZlRmllbGRzIGhhcyBiZWVuIHJlcGxhY2VkIGJ5IHByb3RlY3RlZEZpZWxkcyBhbGxvd2luZyB0aGUgYWJpbGl0eSB0byBwcm90ZWN0IGZpZWxkcyBpbiBhbGwgY2xhc3NlcyB3aXRoIENMUC4gXFxuYFxuICAgICAgKTtcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cblxuICAgIGNvbnN0IHVzZXJTZW5zaXRpdmVGaWVsZHMgPSBBcnJheS5mcm9tKFxuICAgICAgbmV3IFNldChbLi4uKGRlZmF1bHRzLnVzZXJTZW5zaXRpdmVGaWVsZHMgfHwgW10pLCAuLi4ob3B0aW9ucy51c2VyU2Vuc2l0aXZlRmllbGRzIHx8IFtdKV0pXG4gICAgKTtcblxuICAgIC8vIElmIHRoZSBvcHRpb25zLnByb3RlY3RlZEZpZWxkcyBpcyB1bnNldCxcbiAgICAvLyBpdCdsbCBiZSBhc3NpZ25lZCB0aGUgZGVmYXVsdCBhYm92ZS5cbiAgICAvLyBIZXJlLCBwcm90ZWN0IGFnYWluc3QgdGhlIGNhc2Ugd2hlcmUgcHJvdGVjdGVkRmllbGRzXG4gICAgLy8gaXMgc2V0LCBidXQgZG9lc24ndCBoYXZlIF9Vc2VyLlxuICAgIGlmICghKCdfVXNlcicgaW4gb3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHMpKSB7XG4gICAgICBvcHRpb25zLnByb3RlY3RlZEZpZWxkcyA9IE9iamVjdC5hc3NpZ24oeyBfVXNlcjogW10gfSwgb3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHMpO1xuICAgIH1cblxuICAgIG9wdGlvbnMucHJvdGVjdGVkRmllbGRzWydfVXNlciddWycqJ10gPSBBcnJheS5mcm9tKFxuICAgICAgbmV3IFNldChbLi4uKG9wdGlvbnMucHJvdGVjdGVkRmllbGRzWydfVXNlciddWycqJ10gfHwgW10pLCAuLi51c2VyU2Vuc2l0aXZlRmllbGRzXSlcbiAgICApO1xuICB9XG5cbiAgLy8gTWVyZ2UgcHJvdGVjdGVkRmllbGRzIG9wdGlvbnMgd2l0aCBkZWZhdWx0cy5cbiAgT2JqZWN0LmtleXMoZGVmYXVsdHMucHJvdGVjdGVkRmllbGRzKS5mb3JFYWNoKGMgPT4ge1xuICAgIGNvbnN0IGN1ciA9IG9wdGlvbnMucHJvdGVjdGVkRmllbGRzW2NdO1xuICAgIGlmICghY3VyKSB7XG4gICAgICBvcHRpb25zLnByb3RlY3RlZEZpZWxkc1tjXSA9IGRlZmF1bHRzLnByb3RlY3RlZEZpZWxkc1tjXTtcbiAgICB9IGVsc2Uge1xuICAgICAgT2JqZWN0LmtleXMoZGVmYXVsdHMucHJvdGVjdGVkRmllbGRzW2NdKS5mb3JFYWNoKHIgPT4ge1xuICAgICAgICBjb25zdCB1bnEgPSBuZXcgU2V0KFtcbiAgICAgICAgICAuLi4ob3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHNbY11bcl0gfHwgW10pLFxuICAgICAgICAgIC4uLmRlZmF1bHRzLnByb3RlY3RlZEZpZWxkc1tjXVtyXSxcbiAgICAgICAgXSk7XG4gICAgICAgIG9wdGlvbnMucHJvdGVjdGVkRmllbGRzW2NdW3JdID0gQXJyYXkuZnJvbSh1bnEpO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuLy8gVGhvc2UgY2FuJ3QgYmUgdGVzdGVkIGFzIGl0IHJlcXVpcmVzIGEgc3VicHJvY2Vzc1xuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbmZ1bmN0aW9uIGNvbmZpZ3VyZUxpc3RlbmVycyhwYXJzZVNlcnZlcikge1xuICBjb25zdCBzZXJ2ZXIgPSBwYXJzZVNlcnZlci5zZXJ2ZXI7XG4gIGNvbnN0IHNvY2tldHMgPSB7fTtcbiAgLyogQ3VycmVudGx5LCBleHByZXNzIGRvZXNuJ3Qgc2h1dCBkb3duIGltbWVkaWF0ZWx5IGFmdGVyIHJlY2VpdmluZyBTSUdJTlQvU0lHVEVSTSBpZiBpdCBoYXMgY2xpZW50IGNvbm5lY3Rpb25zIHRoYXQgaGF2ZW4ndCB0aW1lZCBvdXQuIChUaGlzIGlzIGEga25vd24gaXNzdWUgd2l0aCBub2RlIC0gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2lzc3Vlcy8yNjQyKVxuICAgIFRoaXMgZnVuY3Rpb24sIGFsb25nIHdpdGggYGRlc3Ryb3lBbGl2ZUNvbm5lY3Rpb25zKClgLCBpbnRlbmQgdG8gZml4IHRoaXMgYmVoYXZpb3Igc3VjaCB0aGF0IHBhcnNlIHNlcnZlciB3aWxsIGNsb3NlIGFsbCBvcGVuIGNvbm5lY3Rpb25zIGFuZCBpbml0aWF0ZSB0aGUgc2h1dGRvd24gcHJvY2VzcyBhcyBzb29uIGFzIGl0IHJlY2VpdmVzIGEgU0lHSU5UL1NJR1RFUk0gc2lnbmFsLiAqL1xuICBzZXJ2ZXIub24oJ2Nvbm5lY3Rpb24nLCBzb2NrZXQgPT4ge1xuICAgIGNvbnN0IHNvY2tldElkID0gc29ja2V0LnJlbW90ZUFkZHJlc3MgKyAnOicgKyBzb2NrZXQucmVtb3RlUG9ydDtcbiAgICBzb2NrZXRzW3NvY2tldElkXSA9IHNvY2tldDtcbiAgICBzb2NrZXQub24oJ2Nsb3NlJywgKCkgPT4ge1xuICAgICAgZGVsZXRlIHNvY2tldHNbc29ja2V0SWRdO1xuICAgIH0pO1xuICB9KTtcblxuICBjb25zdCBkZXN0cm95QWxpdmVDb25uZWN0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICBmb3IgKGNvbnN0IHNvY2tldElkIGluIHNvY2tldHMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHNvY2tldHNbc29ja2V0SWRdLmRlc3Ryb3koKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLyogKi9cbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlU2h1dGRvd24gPSBmdW5jdGlvbiAoKSB7XG4gICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoJ1Rlcm1pbmF0aW9uIHNpZ25hbCByZWNlaXZlZC4gU2h1dHRpbmcgZG93bi4nKTtcbiAgICBkZXN0cm95QWxpdmVDb25uZWN0aW9ucygpO1xuICAgIHNlcnZlci5jbG9zZSgpO1xuICAgIHBhcnNlU2VydmVyLmhhbmRsZVNodXRkb3duKCk7XG4gIH07XG4gIHByb2Nlc3Mub24oJ1NJR1RFUk0nLCBoYW5kbGVTaHV0ZG93bik7XG4gIHByb2Nlc3Mub24oJ1NJR0lOVCcsIGhhbmRsZVNodXRkb3duKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgUGFyc2VTZXJ2ZXI7XG4iXSwibWFwcGluZ3MiOiI7Ozs7OztBQVdBLElBQUFB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