"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _QueryTools = require("./LiveQuery/QueryTools");
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
var _Definitions = _interopRequireDefault(require("./Options/Definitions"));
var _TestUtils = require("./TestUtils");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// ParseServer - open-source compatible API Server for Parse apps

var batch = require('./batch'),
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

// Track connections to destroy them on shutdown
const connections = new _TestUtils.Connections();

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
    const interfaces = JSON.parse(JSON.stringify(_Definitions.default));
    function getValidObject(root) {
      const result = {};
      for (const key in root) {
        if (Object.prototype.hasOwnProperty.call(root[key], 'type')) {
          if (root[key].type.endsWith('[]')) {
            result[key] = [getValidObject(interfaces[root[key].type.slice(0, -2)])];
          } else {
            result[key] = getValidObject(interfaces[root[key].type]);
          }
        } else {
          result[key] = '';
        }
      }
      return result;
    }
    const optionsBlueprint = getValidObject(interfaces['ParseServerOptions']);
    function validateKeyNames(original, ref, name = '') {
      let result = [];
      const prefix = name + (name !== '' ? '.' : '');
      for (const key in original) {
        if (!Object.prototype.hasOwnProperty.call(ref, key)) {
          result.push(prefix + key);
        } else {
          if (ref[key] === '') {
            continue;
          }
          let res = [];
          if (Array.isArray(original[key]) && Array.isArray(ref[key])) {
            const type = ref[key][0];
            original[key].forEach((item, idx) => {
              if (typeof item === 'object' && item !== null) {
                res = res.concat(validateKeyNames(item, type, prefix + key + `[${idx}]`));
              }
            });
          } else if (typeof original[key] === 'object' && typeof ref[key] === 'object') {
            res = validateKeyNames(original[key], ref[key], prefix + key);
          }
          result = result.concat(res);
        }
      }
      return result;
    }
    const diff = validateKeyNames(options, optionsBlueprint);
    if (diff.length > 0) {
      const logger = logging.logger;
      logger.error(`Invalid key(s) found in Parse Server configuration: ${diff.join(', ')}`);
    }

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
    (0, _QueryTools.setRegexTimeout)(options.liveQuery?.regexTimeout);
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
        cacheController,
        cloud,
        security,
        schema,
        liveQueryController
      } = this.config;
      try {
        await databaseController.performInitialization();
      } catch (e) {
        if (e.code !== Parse.Error.DUPLICATE_VALUE) {
          throw e;
        }
      }
      const pushController = await controllers.getPushController(this.config);
      await hooksController.load();
      const startupPromises = [this.config.loadMasterKey?.()];
      if (schema) {
        startupPromises.push(new _DefinedSchemas.DefinedSchemas(schema, this.config).execute());
      }
      if (cacheController.adapter?.connect && typeof cacheController.adapter.connect === 'function') {
        startupPromises.push(cacheController.adapter.connect());
      }
      startupPromises.push(liveQueryController.connect());
      await Promise.all(startupPromises);
      if (cloud) {
        addParseCloud();
        if (typeof cloud === 'function') {
          await Promise.resolve(cloud(Parse));
        } else if (typeof cloud === 'string') {
          let json;
          if (process.env.npm_package_json) {
            json = require(process.env.npm_package_json);
          }
          if (process.env.npm_package_type === 'module' || json?.type === 'module') {
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
      this.config = {
        ...this.config,
        ...pushController
      };
      _Config.default.put(this.config);
      return this;
    } catch (error) {
      // eslint-disable-next-line no-console
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

  /**
   * Stops the parse server, cancels any ongoing requests and closes all connections.
   *
   * Currently, express doesn't shut down immediately after receiving SIGINT/SIGTERM
   * if it has client connections that haven't timed out.
   * (This is a known issue with node - https://github.com/nodejs/node/issues/2642)
   *
   * @returns {Promise<void>} a promise that resolves when the server is stopped
   */
  async handleShutdown() {
    const serverClosePromise = (0, _TestUtils.resolvingPromise)();
    const liveQueryServerClosePromise = (0, _TestUtils.resolvingPromise)();
    const promises = [];
    this.server.close(error => {
      /* istanbul ignore next */
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Error while closing parse server', error);
      }
      serverClosePromise.resolve();
    });
    if (this.liveQueryServer?.server?.close && this.liveQueryServer.server !== this.server) {
      this.liveQueryServer.server.close(error => {
        /* istanbul ignore next */
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Error while closing live query server', error);
        }
        liveQueryServerClosePromise.resolve();
      });
    } else {
      liveQueryServerClosePromise.resolve();
    }
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
    if (this.liveQueryServer) {
      promises.push(this.liveQueryServer.shutdown());
    }
    await Promise.all(promises);
    connections.destroyAll();
    await Promise.all([serverClosePromise, liveQueryServerClosePromise]);
    if (this.config.serverCloseComplete) {
      this.config.serverCloseComplete();
    }
  }

  /**
   * @static
   * Allow developers to customize each request with inversion of control/dependency injection
   */
  static applyRequestContextMiddleware(api, options) {
    if (options.requestContextMiddleware) {
      if (typeof options.requestContextMiddleware !== 'function') {
        throw new Error('requestContextMiddleware must be a function');
      }
      api.use(options.requestContextMiddleware);
    }
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
    api.use(middlewares.allowDoubleForwardSlash);
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
    api.use('/', express.urlencoded({
      extended: false
    }), pages.enableRouter ? new _PagesRouter.PagesRouter(pages).expressRouter() : new _PublicAPIRouter.PublicAPIRouter().expressRouter());
    api.use(express.json({
      type: '*/*',
      limit: maxUploadSize
    }));
    api.use(middlewares.allowMethodOverride);
    api.use(middlewares.handleParseHeaders);
    api.set('query parser', 'extended');
    const routes = Array.isArray(rateLimit) ? rateLimit : [rateLimit];
    for (const route of routes) {
      middlewares.addRateLimit(route, options);
    }
    api.use(middlewares.handleParseSession);
    this.applyRequestContextMiddleware(api, options);
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
          if (err.message) {
            process.stderr.write('An uncaught exception occurred: ' + err.message);
          }
          if (err.stack) {
            process.stderr.write('Stack Trace:\n' + err.stack);
          } else {
            process.stderr.write(err);
          }
          process.exit(1);
        }
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
      // eslint-disable-next-line no-console
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
    connections.track(server);
    if (options.startLiveQueryServer || options.liveQueryServerOptions) {
      this.liveQueryServer = await ParseServer.createLiveQueryServer(server, options.liveQueryServerOptions, options);
      if (this.liveQueryServer.server !== this.server) {
        connections.track(this.liveQueryServer.server);
      }
    }
    if (options.trustProxy) {
      app.set('trust proxy', options.trustProxy);
    }
    /* istanbul ignore next */
    if (!process.env.TESTING) {
      configureListeners(this);
      if (options.verifyServerUrl !== false) {
        await ParseServer.verifyServerUrl();
      }
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
        // eslint-disable-next-line no-console
        console.warn(`\nWARNING, Unable to connect to '${Parse.serverURL}' as the URL is invalid.` + ` Cloud code and push notifications may be unavailable!\n`);
        return;
      }
      const request = require('./request');
      const response = await request({
        url
      }).catch(response => response);
      const json = response.data || null;
      const retry = response.headers?.['retry-after'];
      if (retry) {
        await new Promise(resolve => setTimeout(resolve, retry * 1000));
        return this.verifyServerUrl();
      }
      if (response.status !== 200 || json?.status !== 'ok') {
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
      return {
        ...conf,
        ...ParseServer
      };
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
      // eslint-disable-next-line no-console
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
  const handleShutdown = function () {
    process.stdout.write('Termination signal received. Shutting down.');
    parseServer.handleShutdown();
  };
  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}
var _default = exports.default = ParseServer;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfUXVlcnlUb29scyIsInJlcXVpcmUiLCJfZGVmYXVsdHMiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwibG9nZ2luZyIsIl9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkIiwiX0NvbmZpZyIsIl9Qcm9taXNlUm91dGVyIiwiX3JlcXVpcmVkUGFyYW1ldGVyIiwiX0FuYWx5dGljc1JvdXRlciIsIl9DbGFzc2VzUm91dGVyIiwiX0ZlYXR1cmVzUm91dGVyIiwiX0ZpbGVzUm91dGVyIiwiX0Z1bmN0aW9uc1JvdXRlciIsIl9HbG9iYWxDb25maWdSb3V0ZXIiLCJfR3JhcGhRTFJvdXRlciIsIl9Ib29rc1JvdXRlciIsIl9JQVBWYWxpZGF0aW9uUm91dGVyIiwiX0luc3RhbGxhdGlvbnNSb3V0ZXIiLCJfTG9nc1JvdXRlciIsIl9QYXJzZUxpdmVRdWVyeVNlcnZlciIsIl9QYWdlc1JvdXRlciIsIl9QdWJsaWNBUElSb3V0ZXIiLCJfUHVzaFJvdXRlciIsIl9DbG91ZENvZGVSb3V0ZXIiLCJfUm9sZXNSb3V0ZXIiLCJfU2NoZW1hc1JvdXRlciIsIl9TZXNzaW9uc1JvdXRlciIsIl9Vc2Vyc1JvdXRlciIsIl9QdXJnZVJvdXRlciIsIl9BdWRpZW5jZXNSb3V0ZXIiLCJfQWdncmVnYXRlUm91dGVyIiwiX1BhcnNlU2VydmVyUkVTVENvbnRyb2xsZXIiLCJjb250cm9sbGVycyIsIl9QYXJzZUdyYXBoUUxTZXJ2ZXIiLCJfU2VjdXJpdHlSb3V0ZXIiLCJfQ2hlY2tSdW5uZXIiLCJfRGVwcmVjYXRvciIsIl9EZWZpbmVkU2NoZW1hcyIsIl9EZWZpbml0aW9ucyIsIl9UZXN0VXRpbHMiLCJlIiwidCIsIldlYWtNYXAiLCJyIiwibiIsIl9fZXNNb2R1bGUiLCJvIiwiaSIsImYiLCJfX3Byb3RvX18iLCJkZWZhdWx0IiwiaGFzIiwiZ2V0Iiwic2V0IiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJiYXRjaCIsImV4cHJlc3MiLCJtaWRkbGV3YXJlcyIsIlBhcnNlIiwicGFyc2UiLCJwYXRoIiwiZnMiLCJhZGRQYXJzZUNsb3VkIiwiY29ubmVjdGlvbnMiLCJDb25uZWN0aW9ucyIsIlBhcnNlU2VydmVyIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiRGVwcmVjYXRvciIsInNjYW5QYXJzZVNlcnZlck9wdGlvbnMiLCJpbnRlcmZhY2VzIiwiSlNPTiIsInN0cmluZ2lmeSIsIk9wdGlvbnNEZWZpbml0aW9ucyIsImdldFZhbGlkT2JqZWN0Iiwicm9vdCIsInJlc3VsdCIsImtleSIsInByb3RvdHlwZSIsInR5cGUiLCJlbmRzV2l0aCIsInNsaWNlIiwib3B0aW9uc0JsdWVwcmludCIsInZhbGlkYXRlS2V5TmFtZXMiLCJvcmlnaW5hbCIsInJlZiIsIm5hbWUiLCJwcmVmaXgiLCJwdXNoIiwicmVzIiwiQXJyYXkiLCJpc0FycmF5IiwiZm9yRWFjaCIsIml0ZW0iLCJpZHgiLCJjb25jYXQiLCJkaWZmIiwibGVuZ3RoIiwibG9nZ2VyIiwiZXJyb3IiLCJqb2luIiwiaW5qZWN0RGVmYXVsdHMiLCJhcHBJZCIsInJlcXVpcmVkUGFyYW1ldGVyIiwibWFzdGVyS2V5IiwiamF2YXNjcmlwdEtleSIsInNlcnZlclVSTCIsImluaXRpYWxpemUiLCJDb25maWciLCJ2YWxpZGF0ZU9wdGlvbnMiLCJhbGxDb250cm9sbGVycyIsImdldENvbnRyb2xsZXJzIiwic3RhdGUiLCJjb25maWciLCJwdXQiLCJhc3NpZ24iLCJtYXN0ZXJLZXlJcHNTdG9yZSIsIk1hcCIsIm1haW50ZW5hbmNlS2V5SXBzU3RvcmUiLCJzZXRMb2dnZXIiLCJsb2dnZXJDb250cm9sbGVyIiwic2V0UmVnZXhUaW1lb3V0IiwibGl2ZVF1ZXJ5IiwicmVnZXhUaW1lb3V0Iiwic3RhcnQiLCJkYXRhYmFzZUNvbnRyb2xsZXIiLCJob29rc0NvbnRyb2xsZXIiLCJjYWNoZUNvbnRyb2xsZXIiLCJjbG91ZCIsInNlY3VyaXR5Iiwic2NoZW1hIiwibGl2ZVF1ZXJ5Q29udHJvbGxlciIsInBlcmZvcm1Jbml0aWFsaXphdGlvbiIsImNvZGUiLCJFcnJvciIsIkRVUExJQ0FURV9WQUxVRSIsInB1c2hDb250cm9sbGVyIiwiZ2V0UHVzaENvbnRyb2xsZXIiLCJsb2FkIiwic3RhcnR1cFByb21pc2VzIiwibG9hZE1hc3RlcktleSIsIkRlZmluZWRTY2hlbWFzIiwiZXhlY3V0ZSIsImFkYXB0ZXIiLCJjb25uZWN0IiwiUHJvbWlzZSIsImFsbCIsInJlc29sdmUiLCJqc29uIiwicHJvY2VzcyIsImVudiIsIm5wbV9wYWNrYWdlX2pzb24iLCJucG1fcGFja2FnZV90eXBlIiwiY3dkIiwic2V0VGltZW91dCIsImVuYWJsZUNoZWNrIiwiZW5hYmxlQ2hlY2tMb2ciLCJDaGVja1J1bm5lciIsInJ1biIsImNvbnNvbGUiLCJhcHAiLCJfYXBwIiwiaGFuZGxlU2h1dGRvd24iLCJzZXJ2ZXJDbG9zZVByb21pc2UiLCJyZXNvbHZpbmdQcm9taXNlIiwibGl2ZVF1ZXJ5U2VydmVyQ2xvc2VQcm9taXNlIiwicHJvbWlzZXMiLCJzZXJ2ZXIiLCJjbG9zZSIsImxpdmVRdWVyeVNlcnZlciIsImRhdGFiYXNlQWRhcHRlciIsImZpbGVBZGFwdGVyIiwiZmlsZXNDb250cm9sbGVyIiwiY2FjaGVBZGFwdGVyIiwic2h1dGRvd24iLCJkZXN0cm95QWxsIiwic2VydmVyQ2xvc2VDb21wbGV0ZSIsImFwcGx5UmVxdWVzdENvbnRleHRNaWRkbGV3YXJlIiwiYXBpIiwicmVxdWVzdENvbnRleHRNaWRkbGV3YXJlIiwidXNlIiwibWF4VXBsb2FkU2l6ZSIsImRpcmVjdEFjY2VzcyIsInBhZ2VzIiwicmF0ZUxpbWl0IiwiYWxsb3dDcm9zc0RvbWFpbiIsImFsbG93RG91YmxlRm9yd2FyZFNsYXNoIiwiRmlsZXNSb3V0ZXIiLCJleHByZXNzUm91dGVyIiwicmVxIiwic3RhdHVzIiwidXJsZW5jb2RlZCIsImV4dGVuZGVkIiwiZW5hYmxlUm91dGVyIiwiUGFnZXNSb3V0ZXIiLCJQdWJsaWNBUElSb3V0ZXIiLCJsaW1pdCIsImFsbG93TWV0aG9kT3ZlcnJpZGUiLCJoYW5kbGVQYXJzZUhlYWRlcnMiLCJyb3V0ZXMiLCJyb3V0ZSIsImFkZFJhdGVMaW1pdCIsImhhbmRsZVBhcnNlU2Vzc2lvbiIsImFwcFJvdXRlciIsInByb21pc2VSb3V0ZXIiLCJoYW5kbGVQYXJzZUVycm9ycyIsIlRFU1RJTkciLCJvbiIsImVyciIsInN0ZGVyciIsIndyaXRlIiwicG9ydCIsImV4aXQiLCJtZXNzYWdlIiwic3RhY2siLCJQQVJTRV9TRVJWRVJfRU5BQkxFX0VYUEVSSU1FTlRBTF9ESVJFQ1RfQUNDRVNTIiwiQ29yZU1hbmFnZXIiLCJzZXRSRVNUQ29udHJvbGxlciIsIlBhcnNlU2VydmVyUkVTVENvbnRyb2xsZXIiLCJyb3V0ZXJzIiwiQ2xhc3Nlc1JvdXRlciIsIlVzZXJzUm91dGVyIiwiU2Vzc2lvbnNSb3V0ZXIiLCJSb2xlc1JvdXRlciIsIkFuYWx5dGljc1JvdXRlciIsIkluc3RhbGxhdGlvbnNSb3V0ZXIiLCJGdW5jdGlvbnNSb3V0ZXIiLCJTY2hlbWFzUm91dGVyIiwiUHVzaFJvdXRlciIsIkxvZ3NSb3V0ZXIiLCJJQVBWYWxpZGF0aW9uUm91dGVyIiwiRmVhdHVyZXNSb3V0ZXIiLCJHbG9iYWxDb25maWdSb3V0ZXIiLCJHcmFwaFFMUm91dGVyIiwiUHVyZ2VSb3V0ZXIiLCJIb29rc1JvdXRlciIsIkNsb3VkQ29kZVJvdXRlciIsIkF1ZGllbmNlc1JvdXRlciIsIkFnZ3JlZ2F0ZVJvdXRlciIsIlNlY3VyaXR5Um91dGVyIiwicmVkdWNlIiwibWVtbyIsInJvdXRlciIsIlByb21pc2VSb3V0ZXIiLCJtb3VudE9udG8iLCJzdGFydEFwcCIsIm1pZGRsZXdhcmUiLCJtb3VudFBhdGgiLCJtb3VudEdyYXBoUUwiLCJtb3VudFBsYXlncm91bmQiLCJncmFwaFFMQ3VzdG9tVHlwZURlZnMiLCJ1bmRlZmluZWQiLCJncmFwaFFMU2NoZW1hIiwicmVhZEZpbGVTeW5jIiwicGFyc2VHcmFwaFFMU2VydmVyIiwiUGFyc2VHcmFwaFFMU2VydmVyIiwiZ3JhcGhRTFBhdGgiLCJwbGF5Z3JvdW5kUGF0aCIsImFwcGx5R3JhcGhRTCIsImFwcGx5UGxheWdyb3VuZCIsImxpc3RlbiIsImhvc3QiLCJ0cmFjayIsInN0YXJ0TGl2ZVF1ZXJ5U2VydmVyIiwibGl2ZVF1ZXJ5U2VydmVyT3B0aW9ucyIsImNyZWF0ZUxpdmVRdWVyeVNlcnZlciIsInRydXN0UHJveHkiLCJjb25maWd1cmVMaXN0ZW5lcnMiLCJ2ZXJpZnlTZXJ2ZXJVcmwiLCJleHByZXNzQXBwIiwicGFyc2VTZXJ2ZXIiLCJodHRwU2VydmVyIiwiY3JlYXRlU2VydmVyIiwiUGFyc2VMaXZlUXVlcnlTZXJ2ZXIiLCJpc1ZhbGlkSHR0cFVybCIsInN0cmluZyIsInVybCIsIlVSTCIsIl8iLCJwcm90b2NvbCIsInJlcGxhY2UiLCJ3YXJuIiwicmVxdWVzdCIsInJlc3BvbnNlIiwiY2F0Y2giLCJkYXRhIiwicmV0cnkiLCJoZWFkZXJzIiwiUGFyc2VDbG91ZCIsImNvbmYiLCJhcHBsaWNhdGlvbklkIiwibmV3VmFsIiwiY29uZmlndXJhYmxlIiwiQ2xvdWQiLCJnbG9iYWwiLCJrZXlzIiwiZGVmYXVsdHMiLCJyZWdleCIsIm1hdGNoIiwidXNlclNlbnNpdGl2ZUZpZWxkcyIsImZyb20iLCJTZXQiLCJwcm90ZWN0ZWRGaWVsZHMiLCJfVXNlciIsImMiLCJjdXIiLCJ1bnEiLCJzdGRvdXQiLCJfZGVmYXVsdCIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi9zcmMvUGFyc2VTZXJ2ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gUGFyc2VTZXJ2ZXIgLSBvcGVuLXNvdXJjZSBjb21wYXRpYmxlIEFQSSBTZXJ2ZXIgZm9yIFBhcnNlIGFwcHNcblxudmFyIGJhdGNoID0gcmVxdWlyZSgnLi9iYXRjaCcpLFxuICBleHByZXNzID0gcmVxdWlyZSgnZXhwcmVzcycpLFxuICBtaWRkbGV3YXJlcyA9IHJlcXVpcmUoJy4vbWlkZGxld2FyZXMnKSxcbiAgUGFyc2UgPSByZXF1aXJlKCdwYXJzZS9ub2RlJykuUGFyc2UsXG4gIHsgcGFyc2UgfSA9IHJlcXVpcmUoJ2dyYXBocWwnKSxcbiAgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKSxcbiAgZnMgPSByZXF1aXJlKCdmcycpO1xuXG5pbXBvcnQgeyBQYXJzZVNlcnZlck9wdGlvbnMsIExpdmVRdWVyeVNlcnZlck9wdGlvbnMgfSBmcm9tICcuL09wdGlvbnMnO1xuaW1wb3J0IHsgc2V0UmVnZXhUaW1lb3V0IH0gZnJvbSAnLi9MaXZlUXVlcnkvUXVlcnlUb29scyc7XG5pbXBvcnQgZGVmYXVsdHMgZnJvbSAnLi9kZWZhdWx0cyc7XG5pbXBvcnQgKiBhcyBsb2dnaW5nIGZyb20gJy4vbG9nZ2VyJztcbmltcG9ydCBDb25maWcgZnJvbSAnLi9Db25maWcnO1xuaW1wb3J0IFByb21pc2VSb3V0ZXIgZnJvbSAnLi9Qcm9taXNlUm91dGVyJztcbmltcG9ydCByZXF1aXJlZFBhcmFtZXRlciBmcm9tICcuL3JlcXVpcmVkUGFyYW1ldGVyJztcbmltcG9ydCB7IEFuYWx5dGljc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9BbmFseXRpY3NSb3V0ZXInO1xuaW1wb3J0IHsgQ2xhc3Nlc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9DbGFzc2VzUm91dGVyJztcbmltcG9ydCB7IEZlYXR1cmVzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0ZlYXR1cmVzUm91dGVyJztcbmltcG9ydCB7IEZpbGVzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0ZpbGVzUm91dGVyJztcbmltcG9ydCB7IEZ1bmN0aW9uc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9GdW5jdGlvbnNSb3V0ZXInO1xuaW1wb3J0IHsgR2xvYmFsQ29uZmlnUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0dsb2JhbENvbmZpZ1JvdXRlcic7XG5pbXBvcnQgeyBHcmFwaFFMUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0dyYXBoUUxSb3V0ZXInO1xuaW1wb3J0IHsgSG9va3NSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvSG9va3NSb3V0ZXInO1xuaW1wb3J0IHsgSUFQVmFsaWRhdGlvblJvdXRlciB9IGZyb20gJy4vUm91dGVycy9JQVBWYWxpZGF0aW9uUm91dGVyJztcbmltcG9ydCB7IEluc3RhbGxhdGlvbnNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvSW5zdGFsbGF0aW9uc1JvdXRlcic7XG5pbXBvcnQgeyBMb2dzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL0xvZ3NSb3V0ZXInO1xuaW1wb3J0IHsgUGFyc2VMaXZlUXVlcnlTZXJ2ZXIgfSBmcm9tICcuL0xpdmVRdWVyeS9QYXJzZUxpdmVRdWVyeVNlcnZlcic7XG5pbXBvcnQgeyBQYWdlc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9QYWdlc1JvdXRlcic7XG5pbXBvcnQgeyBQdWJsaWNBUElSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvUHVibGljQVBJUm91dGVyJztcbmltcG9ydCB7IFB1c2hSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvUHVzaFJvdXRlcic7XG5pbXBvcnQgeyBDbG91ZENvZGVSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvQ2xvdWRDb2RlUm91dGVyJztcbmltcG9ydCB7IFJvbGVzUm91dGVyIH0gZnJvbSAnLi9Sb3V0ZXJzL1JvbGVzUm91dGVyJztcbmltcG9ydCB7IFNjaGVtYXNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvU2NoZW1hc1JvdXRlcic7XG5pbXBvcnQgeyBTZXNzaW9uc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9TZXNzaW9uc1JvdXRlcic7XG5pbXBvcnQgeyBVc2Vyc1JvdXRlciB9IGZyb20gJy4vUm91dGVycy9Vc2Vyc1JvdXRlcic7XG5pbXBvcnQgeyBQdXJnZVJvdXRlciB9IGZyb20gJy4vUm91dGVycy9QdXJnZVJvdXRlcic7XG5pbXBvcnQgeyBBdWRpZW5jZXNSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvQXVkaWVuY2VzUm91dGVyJztcbmltcG9ydCB7IEFnZ3JlZ2F0ZVJvdXRlciB9IGZyb20gJy4vUm91dGVycy9BZ2dyZWdhdGVSb3V0ZXInO1xuaW1wb3J0IHsgUGFyc2VTZXJ2ZXJSRVNUQ29udHJvbGxlciB9IGZyb20gJy4vUGFyc2VTZXJ2ZXJSRVNUQ29udHJvbGxlcic7XG5pbXBvcnQgKiBhcyBjb250cm9sbGVycyBmcm9tICcuL0NvbnRyb2xsZXJzJztcbmltcG9ydCB7IFBhcnNlR3JhcGhRTFNlcnZlciB9IGZyb20gJy4vR3JhcGhRTC9QYXJzZUdyYXBoUUxTZXJ2ZXInO1xuaW1wb3J0IHsgU2VjdXJpdHlSb3V0ZXIgfSBmcm9tICcuL1JvdXRlcnMvU2VjdXJpdHlSb3V0ZXInO1xuaW1wb3J0IENoZWNrUnVubmVyIGZyb20gJy4vU2VjdXJpdHkvQ2hlY2tSdW5uZXInO1xuaW1wb3J0IERlcHJlY2F0b3IgZnJvbSAnLi9EZXByZWNhdG9yL0RlcHJlY2F0b3InO1xuaW1wb3J0IHsgRGVmaW5lZFNjaGVtYXMgfSBmcm9tICcuL1NjaGVtYU1pZ3JhdGlvbnMvRGVmaW5lZFNjaGVtYXMnO1xuaW1wb3J0IE9wdGlvbnNEZWZpbml0aW9ucyBmcm9tICcuL09wdGlvbnMvRGVmaW5pdGlvbnMnO1xuaW1wb3J0IHsgcmVzb2x2aW5nUHJvbWlzZSwgQ29ubmVjdGlvbnMgfSBmcm9tICcuL1Rlc3RVdGlscyc7XG5cbi8vIE11dGF0ZSB0aGUgUGFyc2Ugb2JqZWN0IHRvIGFkZCB0aGUgQ2xvdWQgQ29kZSBoYW5kbGVyc1xuYWRkUGFyc2VDbG91ZCgpO1xuXG4vLyBUcmFjayBjb25uZWN0aW9ucyB0byBkZXN0cm95IHRoZW0gb24gc2h1dGRvd25cbmNvbnN0IGNvbm5lY3Rpb25zID0gbmV3IENvbm5lY3Rpb25zKCk7XG5cbi8vIFBhcnNlU2VydmVyIHdvcmtzIGxpa2UgYSBjb25zdHJ1Y3RvciBvZiBhbiBleHByZXNzIGFwcC5cbi8vIGh0dHBzOi8vcGFyc2VwbGF0Zm9ybS5vcmcvcGFyc2Utc2VydmVyL2FwaS9tYXN0ZXIvUGFyc2VTZXJ2ZXJPcHRpb25zLmh0bWxcbmNsYXNzIFBhcnNlU2VydmVyIHtcbiAgX2FwcDogYW55O1xuICBjb25maWc6IGFueTtcbiAgc2VydmVyOiBhbnk7XG4gIGV4cHJlc3NBcHA6IGFueTtcbiAgbGl2ZVF1ZXJ5U2VydmVyOiBhbnk7XG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtQYXJzZVNlcnZlck9wdGlvbnN9IG9wdGlvbnMgdGhlIHBhcnNlIHNlcnZlciBpbml0aWFsaXphdGlvbiBvcHRpb25zXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBQYXJzZVNlcnZlck9wdGlvbnMpIHtcbiAgICAvLyBTY2FuIGZvciBkZXByZWNhdGVkIFBhcnNlIFNlcnZlciBvcHRpb25zXG4gICAgRGVwcmVjYXRvci5zY2FuUGFyc2VTZXJ2ZXJPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgY29uc3QgaW50ZXJmYWNlcyA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoT3B0aW9uc0RlZmluaXRpb25zKSk7XG5cbiAgICBmdW5jdGlvbiBnZXRWYWxpZE9iamVjdChyb290KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICAgIGZvciAoY29uc3Qga2V5IGluIHJvb3QpIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChyb290W2tleV0sICd0eXBlJykpIHtcbiAgICAgICAgICBpZiAocm9vdFtrZXldLnR5cGUuZW5kc1dpdGgoJ1tdJykpIHtcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gW2dldFZhbGlkT2JqZWN0KGludGVyZmFjZXNbcm9vdFtrZXldLnR5cGUuc2xpY2UoMCwgLTIpXSldO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IGdldFZhbGlkT2JqZWN0KGludGVyZmFjZXNbcm9vdFtrZXldLnR5cGVdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0W2tleV0gPSAnJztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBjb25zdCBvcHRpb25zQmx1ZXByaW50ID0gZ2V0VmFsaWRPYmplY3QoaW50ZXJmYWNlc1snUGFyc2VTZXJ2ZXJPcHRpb25zJ10pO1xuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGVLZXlOYW1lcyhvcmlnaW5hbCwgcmVmLCBuYW1lID0gJycpIHtcbiAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgIGNvbnN0IHByZWZpeCA9IG5hbWUgKyAobmFtZSAhPT0gJycgPyAnLicgOiAnJyk7XG4gICAgICBmb3IgKGNvbnN0IGtleSBpbiBvcmlnaW5hbCkge1xuICAgICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChyZWYsIGtleSkpIHtcbiAgICAgICAgICByZXN1bHQucHVzaChwcmVmaXggKyBrZXkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChyZWZba2V5XSA9PT0gJycpIHsgY29udGludWU7IH1cbiAgICAgICAgICBsZXQgcmVzID0gW107XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkob3JpZ2luYWxba2V5XSkgJiYgQXJyYXkuaXNBcnJheShyZWZba2V5XSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSByZWZba2V5XVswXTtcbiAgICAgICAgICAgIG9yaWdpbmFsW2tleV0uZm9yRWFjaCgoaXRlbSwgaWR4KSA9PiB7XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJlcyA9IHJlcy5jb25jYXQodmFsaWRhdGVLZXlOYW1lcyhpdGVtLCB0eXBlLCBwcmVmaXggKyBrZXkgKyBgWyR7aWR4fV1gKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG9yaWdpbmFsW2tleV0gPT09ICdvYmplY3QnICYmIHR5cGVvZiByZWZba2V5XSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJlcyA9IHZhbGlkYXRlS2V5TmFtZXMob3JpZ2luYWxba2V5XSwgcmVmW2tleV0sIHByZWZpeCArIGtleSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5jb25jYXQocmVzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBjb25zdCBkaWZmID0gdmFsaWRhdGVLZXlOYW1lcyhvcHRpb25zLCBvcHRpb25zQmx1ZXByaW50KTtcbiAgICBpZiAoZGlmZi5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBsb2dnZXIgPSAobG9nZ2luZyBhcyBhbnkpLmxvZ2dlcjtcbiAgICAgIGxvZ2dlci5lcnJvcihgSW52YWxpZCBrZXkocykgZm91bmQgaW4gUGFyc2UgU2VydmVyIGNvbmZpZ3VyYXRpb246ICR7ZGlmZi5qb2luKCcsICcpfWApO1xuICAgIH1cblxuICAgIC8vIFNldCBvcHRpb24gZGVmYXVsdHNcbiAgICBpbmplY3REZWZhdWx0cyhvcHRpb25zKTtcbiAgICBjb25zdCB7XG4gICAgICBhcHBJZCA9IHJlcXVpcmVkUGFyYW1ldGVyKCdZb3UgbXVzdCBwcm92aWRlIGFuIGFwcElkIScpLFxuICAgICAgbWFzdGVyS2V5ID0gcmVxdWlyZWRQYXJhbWV0ZXIoJ1lvdSBtdXN0IHByb3ZpZGUgYSBtYXN0ZXJLZXkhJyksXG4gICAgICBqYXZhc2NyaXB0S2V5LFxuICAgICAgc2VydmVyVVJMID0gcmVxdWlyZWRQYXJhbWV0ZXIoJ1lvdSBtdXN0IHByb3ZpZGUgYSBzZXJ2ZXJVUkwhJyksXG4gICAgfSA9IG9wdGlvbnM7XG4gICAgLy8gSW5pdGlhbGl6ZSB0aGUgbm9kZSBjbGllbnQgU0RLIGF1dG9tYXRpY2FsbHlcbiAgICBQYXJzZS5pbml0aWFsaXplKGFwcElkLCBqYXZhc2NyaXB0S2V5IHx8ICd1bnVzZWQnLCBtYXN0ZXJLZXkpO1xuICAgIFBhcnNlLnNlcnZlclVSTCA9IHNlcnZlclVSTDtcbiAgICBDb25maWcudmFsaWRhdGVPcHRpb25zKG9wdGlvbnMpO1xuICAgIGNvbnN0IGFsbENvbnRyb2xsZXJzID0gY29udHJvbGxlcnMuZ2V0Q29udHJvbGxlcnMob3B0aW9ucyk7XG5cbiAgICAob3B0aW9ucyBhcyBhbnkpLnN0YXRlID0gJ2luaXRpYWxpemVkJztcbiAgICB0aGlzLmNvbmZpZyA9IENvbmZpZy5wdXQoT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywgYWxsQ29udHJvbGxlcnMpKTtcbiAgICB0aGlzLmNvbmZpZy5tYXN0ZXJLZXlJcHNTdG9yZSA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLmNvbmZpZy5tYWludGVuYW5jZUtleUlwc1N0b3JlID0gbmV3IE1hcCgpO1xuICAgIGxvZ2dpbmcuc2V0TG9nZ2VyKGFsbENvbnRyb2xsZXJzLmxvZ2dlckNvbnRyb2xsZXIpO1xuICAgIHNldFJlZ2V4VGltZW91dChvcHRpb25zLmxpdmVRdWVyeT8ucmVnZXhUaW1lb3V0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydHMgUGFyc2UgU2VydmVyIGFzIGFuIGV4cHJlc3MgYXBwOyB0aGlzIHByb21pc2UgcmVzb2x2ZXMgd2hlbiBQYXJzZSBTZXJ2ZXIgaXMgcmVhZHkgdG8gYWNjZXB0IHJlcXVlc3RzLlxuICAgKi9cblxuICBhc3luYyBzdGFydCgpOiBQcm9taXNlPHRoaXM+IHtcbiAgICB0cnkge1xuICAgICAgaWYgKHRoaXMuY29uZmlnLnN0YXRlID09PSAnb2snKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuICAgICAgdGhpcy5jb25maWcuc3RhdGUgPSAnc3RhcnRpbmcnO1xuICAgICAgQ29uZmlnLnB1dCh0aGlzLmNvbmZpZyk7XG4gICAgICBjb25zdCB7XG4gICAgICAgIGRhdGFiYXNlQ29udHJvbGxlcixcbiAgICAgICAgaG9va3NDb250cm9sbGVyLFxuICAgICAgICBjYWNoZUNvbnRyb2xsZXIsXG4gICAgICAgIGNsb3VkLFxuICAgICAgICBzZWN1cml0eSxcbiAgICAgICAgc2NoZW1hLFxuICAgICAgICBsaXZlUXVlcnlDb250cm9sbGVyLFxuICAgICAgfSA9IHRoaXMuY29uZmlnO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZGF0YWJhc2VDb250cm9sbGVyLnBlcmZvcm1Jbml0aWFsaXphdGlvbigpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoZS5jb2RlICE9PSBQYXJzZS5FcnJvci5EVVBMSUNBVEVfVkFMVUUpIHtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBwdXNoQ29udHJvbGxlciA9IGF3YWl0IGNvbnRyb2xsZXJzLmdldFB1c2hDb250cm9sbGVyKHRoaXMuY29uZmlnKTtcbiAgICAgIGF3YWl0IGhvb2tzQ29udHJvbGxlci5sb2FkKCk7XG4gICAgICBjb25zdCBzdGFydHVwUHJvbWlzZXMgPSBbdGhpcy5jb25maWcubG9hZE1hc3RlcktleT8uKCldO1xuICAgICAgaWYgKHNjaGVtYSkge1xuICAgICAgICBzdGFydHVwUHJvbWlzZXMucHVzaChuZXcgRGVmaW5lZFNjaGVtYXMoc2NoZW1hLCB0aGlzLmNvbmZpZykuZXhlY3V0ZSgpKTtcbiAgICAgIH1cbiAgICAgIGlmIChcbiAgICAgICAgY2FjaGVDb250cm9sbGVyLmFkYXB0ZXI/LmNvbm5lY3QgJiZcbiAgICAgICAgdHlwZW9mIGNhY2hlQ29udHJvbGxlci5hZGFwdGVyLmNvbm5lY3QgPT09ICdmdW5jdGlvbidcbiAgICAgICkge1xuICAgICAgICBzdGFydHVwUHJvbWlzZXMucHVzaChjYWNoZUNvbnRyb2xsZXIuYWRhcHRlci5jb25uZWN0KCkpO1xuICAgICAgfVxuICAgICAgc3RhcnR1cFByb21pc2VzLnB1c2gobGl2ZVF1ZXJ5Q29udHJvbGxlci5jb25uZWN0KCkpO1xuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoc3RhcnR1cFByb21pc2VzKTtcbiAgICAgIGlmIChjbG91ZCkge1xuICAgICAgICBhZGRQYXJzZUNsb3VkKCk7XG4gICAgICAgIGlmICh0eXBlb2YgY2xvdWQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBhd2FpdCBQcm9taXNlLnJlc29sdmUoY2xvdWQoUGFyc2UpKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY2xvdWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgbGV0IGpzb247XG4gICAgICAgICAgaWYgKHByb2Nlc3MuZW52Lm5wbV9wYWNrYWdlX2pzb24pIHtcbiAgICAgICAgICAgIGpzb24gPSByZXF1aXJlKHByb2Nlc3MuZW52Lm5wbV9wYWNrYWdlX2pzb24pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfdHlwZSA9PT0gJ21vZHVsZScgfHwganNvbj8udHlwZSA9PT0gJ21vZHVsZScpIHtcbiAgICAgICAgICAgIGF3YWl0IGltcG9ydChwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgY2xvdWQpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVxdWlyZShwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgY2xvdWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgXCJhcmd1bWVudCAnY2xvdWQnIG11c3QgZWl0aGVyIGJlIGEgc3RyaW5nIG9yIGEgZnVuY3Rpb25cIjtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTApKTtcbiAgICAgIH1cbiAgICAgIGlmIChzZWN1cml0eSAmJiBzZWN1cml0eS5lbmFibGVDaGVjayAmJiBzZWN1cml0eS5lbmFibGVDaGVja0xvZykge1xuICAgICAgICBuZXcgQ2hlY2tSdW5uZXIoc2VjdXJpdHkpLnJ1bigpO1xuICAgICAgfVxuICAgICAgdGhpcy5jb25maWcuc3RhdGUgPSAnb2snO1xuICAgICAgdGhpcy5jb25maWcgPSB7IC4uLnRoaXMuY29uZmlnLCAuLi5wdXNoQ29udHJvbGxlciB9O1xuICAgICAgQ29uZmlnLnB1dCh0aGlzLmNvbmZpZyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgdGhpcy5jb25maWcuc3RhdGUgPSAnZXJyb3InO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgZ2V0IGFwcCgpIHtcbiAgICBpZiAoIXRoaXMuX2FwcCkge1xuICAgICAgdGhpcy5fYXBwID0gUGFyc2VTZXJ2ZXIuYXBwKHRoaXMuY29uZmlnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2FwcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wcyB0aGUgcGFyc2Ugc2VydmVyLCBjYW5jZWxzIGFueSBvbmdvaW5nIHJlcXVlc3RzIGFuZCBjbG9zZXMgYWxsIGNvbm5lY3Rpb25zLlxuICAgKlxuICAgKiBDdXJyZW50bHksIGV4cHJlc3MgZG9lc24ndCBzaHV0IGRvd24gaW1tZWRpYXRlbHkgYWZ0ZXIgcmVjZWl2aW5nIFNJR0lOVC9TSUdURVJNXG4gICAqIGlmIGl0IGhhcyBjbGllbnQgY29ubmVjdGlvbnMgdGhhdCBoYXZlbid0IHRpbWVkIG91dC5cbiAgICogKFRoaXMgaXMgYSBrbm93biBpc3N1ZSB3aXRoIG5vZGUgLSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvaXNzdWVzLzI2NDIpXG4gICAqXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fSBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBzZXJ2ZXIgaXMgc3RvcHBlZFxuICAgKi9cbiAgYXN5bmMgaGFuZGxlU2h1dGRvd24oKSB7XG4gICAgY29uc3Qgc2VydmVyQ2xvc2VQcm9taXNlID0gcmVzb2x2aW5nUHJvbWlzZSgpO1xuICAgIGNvbnN0IGxpdmVRdWVyeVNlcnZlckNsb3NlUHJvbWlzZSA9IHJlc29sdmluZ1Byb21pc2UoKTtcbiAgICBjb25zdCBwcm9taXNlcyA9IFtdO1xuICAgIHRoaXMuc2VydmVyLmNsb3NlKChlcnJvcikgPT4ge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB3aGlsZSBjbG9zaW5nIHBhcnNlIHNlcnZlcicsIGVycm9yKTtcbiAgICAgIH1cbiAgICAgIHNlcnZlckNsb3NlUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfSk7XG4gICAgaWYgKHRoaXMubGl2ZVF1ZXJ5U2VydmVyPy5zZXJ2ZXI/LmNsb3NlICYmIHRoaXMubGl2ZVF1ZXJ5U2VydmVyLnNlcnZlciAhPT0gdGhpcy5zZXJ2ZXIpIHtcbiAgICAgIHRoaXMubGl2ZVF1ZXJ5U2VydmVyLnNlcnZlci5jbG9zZSgoZXJyb3IpID0+IHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB3aGlsZSBjbG9zaW5nIGxpdmUgcXVlcnkgc2VydmVyJywgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGxpdmVRdWVyeVNlcnZlckNsb3NlUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGl2ZVF1ZXJ5U2VydmVyQ2xvc2VQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG4gICAgY29uc3QgeyBhZGFwdGVyOiBkYXRhYmFzZUFkYXB0ZXIgfSA9IHRoaXMuY29uZmlnLmRhdGFiYXNlQ29udHJvbGxlcjtcbiAgICBpZiAoZGF0YWJhc2VBZGFwdGVyICYmIHR5cGVvZiBkYXRhYmFzZUFkYXB0ZXIuaGFuZGxlU2h1dGRvd24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHByb21pc2VzLnB1c2goZGF0YWJhc2VBZGFwdGVyLmhhbmRsZVNodXRkb3duKCkpO1xuICAgIH1cbiAgICBjb25zdCB7IGFkYXB0ZXI6IGZpbGVBZGFwdGVyIH0gPSB0aGlzLmNvbmZpZy5maWxlc0NvbnRyb2xsZXI7XG4gICAgaWYgKGZpbGVBZGFwdGVyICYmIHR5cGVvZiBmaWxlQWRhcHRlci5oYW5kbGVTaHV0ZG93biA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcHJvbWlzZXMucHVzaChmaWxlQWRhcHRlci5oYW5kbGVTaHV0ZG93bigpKTtcbiAgICB9XG4gICAgY29uc3QgeyBhZGFwdGVyOiBjYWNoZUFkYXB0ZXIgfSA9IHRoaXMuY29uZmlnLmNhY2hlQ29udHJvbGxlcjtcbiAgICBpZiAoY2FjaGVBZGFwdGVyICYmIHR5cGVvZiBjYWNoZUFkYXB0ZXIuaGFuZGxlU2h1dGRvd24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHByb21pc2VzLnB1c2goY2FjaGVBZGFwdGVyLmhhbmRsZVNodXRkb3duKCkpO1xuICAgIH1cbiAgICBpZiAodGhpcy5saXZlUXVlcnlTZXJ2ZXIpIHtcbiAgICAgIHByb21pc2VzLnB1c2godGhpcy5saXZlUXVlcnlTZXJ2ZXIuc2h1dGRvd24oKSk7XG4gICAgfVxuICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgICBjb25uZWN0aW9ucy5kZXN0cm95QWxsKCk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW3NlcnZlckNsb3NlUHJvbWlzZSwgbGl2ZVF1ZXJ5U2VydmVyQ2xvc2VQcm9taXNlXSk7XG4gICAgaWYgKHRoaXMuY29uZmlnLnNlcnZlckNsb3NlQ29tcGxldGUpIHtcbiAgICAgIHRoaXMuY29uZmlnLnNlcnZlckNsb3NlQ29tcGxldGUoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHN0YXRpY1xuICAgKiBBbGxvdyBkZXZlbG9wZXJzIHRvIGN1c3RvbWl6ZSBlYWNoIHJlcXVlc3Qgd2l0aCBpbnZlcnNpb24gb2YgY29udHJvbC9kZXBlbmRlbmN5IGluamVjdGlvblxuICAgKi9cbiAgc3RhdGljIGFwcGx5UmVxdWVzdENvbnRleHRNaWRkbGV3YXJlKGFwaSwgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLnJlcXVlc3RDb250ZXh0TWlkZGxld2FyZSkge1xuICAgICAgaWYgKHR5cGVvZiBvcHRpb25zLnJlcXVlc3RDb250ZXh0TWlkZGxld2FyZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlcXVlc3RDb250ZXh0TWlkZGxld2FyZSBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcbiAgICAgIH1cbiAgICAgIGFwaS51c2Uob3B0aW9ucy5yZXF1ZXN0Q29udGV4dE1pZGRsZXdhcmUpO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogQHN0YXRpY1xuICAgKiBDcmVhdGUgYW4gZXhwcmVzcyBhcHAgZm9yIHRoZSBwYXJzZSBzZXJ2ZXJcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgbGV0IHlvdSBzcGVjaWZ5IHRoZSBtYXhVcGxvYWRTaXplIHdoZW4gY3JlYXRpbmcgdGhlIGV4cHJlc3MgYXBwICAqL1xuICBzdGF0aWMgYXBwKG9wdGlvbnMpIHtcbiAgICBjb25zdCB7XG4gICAgICBtYXhVcGxvYWRTaXplID0gJzIwbWInLFxuICAgICAgYXBwSWQsXG4gICAgICBkaXJlY3RBY2Nlc3MsXG4gICAgICBwYWdlcyxcbiAgICAgIHJhdGVMaW1pdCA9IFtdLFxuICAgIH0gPSBvcHRpb25zO1xuICAgIC8vIFRoaXMgYXBwIHNlcnZlcyB0aGUgUGFyc2UgQVBJIGRpcmVjdGx5LlxuICAgIC8vIEl0J3MgdGhlIGVxdWl2YWxlbnQgb2YgaHR0cHM6Ly9hcGkucGFyc2UuY29tLzEgaW4gdGhlIGhvc3RlZCBQYXJzZSBBUEkuXG4gICAgdmFyIGFwaSA9IGV4cHJlc3MoKTtcbiAgICAvL2FwaS51c2UoXCIvYXBwc1wiLCBleHByZXNzLnN0YXRpYyhfX2Rpcm5hbWUgKyBcIi9wdWJsaWNcIikpO1xuICAgIGFwaS51c2UobWlkZGxld2FyZXMuYWxsb3dDcm9zc0RvbWFpbihhcHBJZCkpO1xuICAgIGFwaS51c2UobWlkZGxld2FyZXMuYWxsb3dEb3VibGVGb3J3YXJkU2xhc2gpO1xuICAgIC8vIEZpbGUgaGFuZGxpbmcgbmVlZHMgdG8gYmUgYmVmb3JlIGRlZmF1bHQgbWlkZGxld2FyZXMgYXJlIGFwcGxpZWRcbiAgICBhcGkudXNlKFxuICAgICAgJy8nLFxuICAgICAgbmV3IEZpbGVzUm91dGVyKCkuZXhwcmVzc1JvdXRlcih7XG4gICAgICAgIG1heFVwbG9hZFNpemU6IG1heFVwbG9hZFNpemUsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBhcGkudXNlKCcvaGVhbHRoJywgZnVuY3Rpb24gKHJlcSwgcmVzKSB7XG4gICAgICByZXMuc3RhdHVzKG9wdGlvbnMuc3RhdGUgPT09ICdvaycgPyAyMDAgOiA1MDMpO1xuICAgICAgaWYgKG9wdGlvbnMuc3RhdGUgPT09ICdzdGFydGluZycpIHtcbiAgICAgICAgcmVzLnNldCgnUmV0cnktQWZ0ZXInLCAxKTtcbiAgICAgIH1cbiAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgc3RhdHVzOiBvcHRpb25zLnN0YXRlLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBhcGkudXNlKFxuICAgICAgJy8nLFxuICAgICAgZXhwcmVzcy51cmxlbmNvZGVkKHsgZXh0ZW5kZWQ6IGZhbHNlIH0pLFxuICAgICAgcGFnZXMuZW5hYmxlUm91dGVyXG4gICAgICAgID8gbmV3IFBhZ2VzUm91dGVyKHBhZ2VzKS5leHByZXNzUm91dGVyKClcbiAgICAgICAgOiBuZXcgUHVibGljQVBJUm91dGVyKCkuZXhwcmVzc1JvdXRlcigpXG4gICAgKTtcblxuICAgIGFwaS51c2UoZXhwcmVzcy5qc29uKHsgdHlwZTogJyovKicsIGxpbWl0OiBtYXhVcGxvYWRTaXplIH0pKTtcbiAgICBhcGkudXNlKG1pZGRsZXdhcmVzLmFsbG93TWV0aG9kT3ZlcnJpZGUpO1xuICAgIGFwaS51c2UobWlkZGxld2FyZXMuaGFuZGxlUGFyc2VIZWFkZXJzKTtcbiAgICBhcGkuc2V0KCdxdWVyeSBwYXJzZXInLCAnZXh0ZW5kZWQnKTtcbiAgICBjb25zdCByb3V0ZXMgPSBBcnJheS5pc0FycmF5KHJhdGVMaW1pdCkgPyByYXRlTGltaXQgOiBbcmF0ZUxpbWl0XTtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHJvdXRlcykge1xuICAgICAgbWlkZGxld2FyZXMuYWRkUmF0ZUxpbWl0KHJvdXRlLCBvcHRpb25zKTtcbiAgICB9XG4gICAgYXBpLnVzZShtaWRkbGV3YXJlcy5oYW5kbGVQYXJzZVNlc3Npb24pO1xuICAgIHRoaXMuYXBwbHlSZXF1ZXN0Q29udGV4dE1pZGRsZXdhcmUoYXBpLCBvcHRpb25zKTtcbiAgICBjb25zdCBhcHBSb3V0ZXIgPSBQYXJzZVNlcnZlci5wcm9taXNlUm91dGVyKHsgYXBwSWQgfSk7XG4gICAgYXBpLnVzZShhcHBSb3V0ZXIuZXhwcmVzc1JvdXRlcigpKTtcblxuICAgIGFwaS51c2UobWlkZGxld2FyZXMuaGFuZGxlUGFyc2VFcnJvcnMpO1xuXG4gICAgLy8gcnVuIHRoZSBmb2xsb3dpbmcgd2hlbiBub3QgdGVzdGluZ1xuICAgIGlmICghcHJvY2Vzcy5lbnYuVEVTVElORykge1xuICAgICAgLy9UaGlzIGNhdXNlcyB0ZXN0cyB0byBzcGV3IHNvbWUgdXNlbGVzcyB3YXJuaW5ncywgc28gZGlzYWJsZSBpbiB0ZXN0XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgcHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKGVyci5jb2RlID09PSAnRUFERFJJTlVTRScpIHtcbiAgICAgICAgICAvLyB1c2VyLWZyaWVuZGx5IG1lc3NhZ2UgZm9yIHRoaXMgY29tbW9uIGVycm9yXG4gICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoYFVuYWJsZSB0byBsaXN0ZW4gb24gcG9ydCAke2Vyci5wb3J0fS4gVGhlIHBvcnQgaXMgYWxyZWFkeSBpbiB1c2UuYCk7XG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChlcnIubWVzc2FnZSkge1xuICAgICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoJ0FuIHVuY2F1Z2h0IGV4Y2VwdGlvbiBvY2N1cnJlZDogJyArIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGVyci5zdGFjaykge1xuICAgICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoJ1N0YWNrIFRyYWNlOlxcbicgKyBlcnIuc3RhY2spO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAocHJvY2Vzcy5lbnYuUEFSU0VfU0VSVkVSX0VOQUJMRV9FWFBFUklNRU5UQUxfRElSRUNUX0FDQ0VTUyA9PT0gJzEnIHx8IGRpcmVjdEFjY2Vzcykge1xuICAgICAgUGFyc2UuQ29yZU1hbmFnZXIuc2V0UkVTVENvbnRyb2xsZXIoUGFyc2VTZXJ2ZXJSRVNUQ29udHJvbGxlcihhcHBJZCwgYXBwUm91dGVyKSk7XG4gICAgfVxuICAgIHJldHVybiBhcGk7XG4gIH1cblxuICBzdGF0aWMgcHJvbWlzZVJvdXRlcih7IGFwcElkIH0pIHtcbiAgICBjb25zdCByb3V0ZXJzID0gW1xuICAgICAgbmV3IENsYXNzZXNSb3V0ZXIoKSxcbiAgICAgIG5ldyBVc2Vyc1JvdXRlcigpLFxuICAgICAgbmV3IFNlc3Npb25zUm91dGVyKCksXG4gICAgICBuZXcgUm9sZXNSb3V0ZXIoKSxcbiAgICAgIG5ldyBBbmFseXRpY3NSb3V0ZXIoKSxcbiAgICAgIG5ldyBJbnN0YWxsYXRpb25zUm91dGVyKCksXG4gICAgICBuZXcgRnVuY3Rpb25zUm91dGVyKCksXG4gICAgICBuZXcgU2NoZW1hc1JvdXRlcigpLFxuICAgICAgbmV3IFB1c2hSb3V0ZXIoKSxcbiAgICAgIG5ldyBMb2dzUm91dGVyKCksXG4gICAgICBuZXcgSUFQVmFsaWRhdGlvblJvdXRlcigpLFxuICAgICAgbmV3IEZlYXR1cmVzUm91dGVyKCksXG4gICAgICBuZXcgR2xvYmFsQ29uZmlnUm91dGVyKCksXG4gICAgICBuZXcgR3JhcGhRTFJvdXRlcigpLFxuICAgICAgbmV3IFB1cmdlUm91dGVyKCksXG4gICAgICBuZXcgSG9va3NSb3V0ZXIoKSxcbiAgICAgIG5ldyBDbG91ZENvZGVSb3V0ZXIoKSxcbiAgICAgIG5ldyBBdWRpZW5jZXNSb3V0ZXIoKSxcbiAgICAgIG5ldyBBZ2dyZWdhdGVSb3V0ZXIoKSxcbiAgICAgIG5ldyBTZWN1cml0eVJvdXRlcigpLFxuICAgIF07XG5cbiAgICBjb25zdCByb3V0ZXMgPSByb3V0ZXJzLnJlZHVjZSgobWVtbywgcm91dGVyKSA9PiB7XG4gICAgICByZXR1cm4gbWVtby5jb25jYXQocm91dGVyLnJvdXRlcyk7XG4gICAgfSwgW10pO1xuXG4gICAgY29uc3QgYXBwUm91dGVyID0gbmV3IFByb21pc2VSb3V0ZXIocm91dGVzLCBhcHBJZCk7XG5cbiAgICBiYXRjaC5tb3VudE9udG8oYXBwUm91dGVyKTtcbiAgICByZXR1cm4gYXBwUm91dGVyO1xuICB9XG5cbiAgLyoqXG4gICAqIHN0YXJ0cyB0aGUgcGFyc2Ugc2VydmVyJ3MgZXhwcmVzcyBhcHBcbiAgICogQHBhcmFtIHtQYXJzZVNlcnZlck9wdGlvbnN9IG9wdGlvbnMgdG8gdXNlIHRvIHN0YXJ0IHRoZSBzZXJ2ZXJcbiAgICogQHJldHVybnMge1BhcnNlU2VydmVyfSB0aGUgcGFyc2Ugc2VydmVyIGluc3RhbmNlXG4gICAqL1xuXG4gIGFzeW5jIHN0YXJ0QXBwKG9wdGlvbnM6IFBhcnNlU2VydmVyT3B0aW9ucykge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnN0YXJ0KCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIG9uIFBhcnNlU2VydmVyLnN0YXJ0QXBwOiAnLCBlKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIGNvbnN0IGFwcCA9IGV4cHJlc3MoKTtcbiAgICBpZiAob3B0aW9ucy5taWRkbGV3YXJlKSB7XG4gICAgICBsZXQgbWlkZGxld2FyZTtcbiAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5taWRkbGV3YXJlID09ICdzdHJpbmcnKSB7XG4gICAgICAgIG1pZGRsZXdhcmUgPSByZXF1aXJlKHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCBvcHRpb25zLm1pZGRsZXdhcmUpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1pZGRsZXdhcmUgPSBvcHRpb25zLm1pZGRsZXdhcmU7IC8vIHVzZSBhcy1pcyBsZXQgZXhwcmVzcyBmYWlsXG4gICAgICB9XG4gICAgICBhcHAudXNlKG1pZGRsZXdhcmUpO1xuICAgIH1cbiAgICBhcHAudXNlKG9wdGlvbnMubW91bnRQYXRoLCB0aGlzLmFwcCk7XG5cbiAgICBpZiAob3B0aW9ucy5tb3VudEdyYXBoUUwgPT09IHRydWUgfHwgb3B0aW9ucy5tb3VudFBsYXlncm91bmQgPT09IHRydWUpIHtcbiAgICAgIGxldCBncmFwaFFMQ3VzdG9tVHlwZURlZnMgPSB1bmRlZmluZWQ7XG4gICAgICBpZiAodHlwZW9mIG9wdGlvbnMuZ3JhcGhRTFNjaGVtYSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzID0gcGFyc2UoZnMucmVhZEZpbGVTeW5jKG9wdGlvbnMuZ3JhcGhRTFNjaGVtYSwgJ3V0ZjgnKSk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICB0eXBlb2Ygb3B0aW9ucy5ncmFwaFFMU2NoZW1hID09PSAnb2JqZWN0JyB8fFxuICAgICAgICB0eXBlb2Ygb3B0aW9ucy5ncmFwaFFMU2NoZW1hID09PSAnZnVuY3Rpb24nXG4gICAgICApIHtcbiAgICAgICAgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzID0gb3B0aW9ucy5ncmFwaFFMU2NoZW1hO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZUdyYXBoUUxTZXJ2ZXIgPSBuZXcgUGFyc2VHcmFwaFFMU2VydmVyKHRoaXMsIHtcbiAgICAgICAgZ3JhcGhRTFBhdGg6IG9wdGlvbnMuZ3JhcGhRTFBhdGgsXG4gICAgICAgIHBsYXlncm91bmRQYXRoOiBvcHRpb25zLnBsYXlncm91bmRQYXRoLFxuICAgICAgICBncmFwaFFMQ3VzdG9tVHlwZURlZnMsXG4gICAgICB9KTtcblxuICAgICAgaWYgKG9wdGlvbnMubW91bnRHcmFwaFFMKSB7XG4gICAgICAgIHBhcnNlR3JhcGhRTFNlcnZlci5hcHBseUdyYXBoUUwoYXBwKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMubW91bnRQbGF5Z3JvdW5kKSB7XG4gICAgICAgIHBhcnNlR3JhcGhRTFNlcnZlci5hcHBseVBsYXlncm91bmQoYXBwKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgc2VydmVyID0gYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICBhcHAubGlzdGVuKG9wdGlvbnMucG9ydCwgb3B0aW9ucy5ob3N0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJlc29sdmUodGhpcyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICB0aGlzLnNlcnZlciA9IHNlcnZlcjtcbiAgICBjb25uZWN0aW9ucy50cmFjayhzZXJ2ZXIpO1xuXG4gICAgaWYgKG9wdGlvbnMuc3RhcnRMaXZlUXVlcnlTZXJ2ZXIgfHwgb3B0aW9ucy5saXZlUXVlcnlTZXJ2ZXJPcHRpb25zKSB7XG4gICAgICB0aGlzLmxpdmVRdWVyeVNlcnZlciA9IGF3YWl0IFBhcnNlU2VydmVyLmNyZWF0ZUxpdmVRdWVyeVNlcnZlcihcbiAgICAgICAgc2VydmVyLFxuICAgICAgICBvcHRpb25zLmxpdmVRdWVyeVNlcnZlck9wdGlvbnMsXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICk7XG4gICAgICBpZiAodGhpcy5saXZlUXVlcnlTZXJ2ZXIuc2VydmVyICE9PSB0aGlzLnNlcnZlcikge1xuICAgICAgICBjb25uZWN0aW9ucy50cmFjayh0aGlzLmxpdmVRdWVyeVNlcnZlci5zZXJ2ZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAob3B0aW9ucy50cnVzdFByb3h5KSB7XG4gICAgICBhcHAuc2V0KCd0cnVzdCBwcm94eScsIG9wdGlvbnMudHJ1c3RQcm94eSk7XG4gICAgfVxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgaWYgKCFwcm9jZXNzLmVudi5URVNUSU5HKSB7XG4gICAgICBjb25maWd1cmVMaXN0ZW5lcnModGhpcyk7XG4gICAgICBpZiAob3B0aW9ucy52ZXJpZnlTZXJ2ZXJVcmwgIT09IGZhbHNlKSB7XG4gICAgICAgIGF3YWl0IFBhcnNlU2VydmVyLnZlcmlmeVNlcnZlclVybCgpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmV4cHJlc3NBcHAgPSBhcHA7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBQYXJzZVNlcnZlciBhbmQgc3RhcnRzIGl0LlxuICAgKiBAcGFyYW0ge1BhcnNlU2VydmVyT3B0aW9uc30gb3B0aW9ucyB1c2VkIHRvIHN0YXJ0IHRoZSBzZXJ2ZXJcbiAgICogQHJldHVybnMge1BhcnNlU2VydmVyfSB0aGUgcGFyc2Ugc2VydmVyIGluc3RhbmNlXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgc3RhcnRBcHAob3B0aW9uczogUGFyc2VTZXJ2ZXJPcHRpb25zKSB7XG4gICAgY29uc3QgcGFyc2VTZXJ2ZXIgPSBuZXcgUGFyc2VTZXJ2ZXIob3B0aW9ucyk7XG4gICAgcmV0dXJuIHBhcnNlU2VydmVyLnN0YXJ0QXBwKG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBtZXRob2QgdG8gY3JlYXRlIGEgbGl2ZVF1ZXJ5IHNlcnZlclxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7U2VydmVyfSBodHRwU2VydmVyIGFuIG9wdGlvbmFsIGh0dHAgc2VydmVyIHRvIHBhc3NcbiAgICogQHBhcmFtIHtMaXZlUXVlcnlTZXJ2ZXJPcHRpb25zfSBjb25maWcgb3B0aW9ucyBmb3IgdGhlIGxpdmVRdWVyeVNlcnZlclxuICAgKiBAcGFyYW0ge1BhcnNlU2VydmVyT3B0aW9uc30gb3B0aW9ucyBvcHRpb25zIGZvciB0aGUgUGFyc2VTZXJ2ZXJcbiAgICogQHJldHVybnMge1Byb21pc2U8UGFyc2VMaXZlUXVlcnlTZXJ2ZXI+fSB0aGUgbGl2ZSBxdWVyeSBzZXJ2ZXIgaW5zdGFuY2VcbiAgICovXG4gIHN0YXRpYyBhc3luYyBjcmVhdGVMaXZlUXVlcnlTZXJ2ZXIoXG4gICAgaHR0cFNlcnZlcixcbiAgICBjb25maWc6IExpdmVRdWVyeVNlcnZlck9wdGlvbnMsXG4gICAgb3B0aW9uczogUGFyc2VTZXJ2ZXJPcHRpb25zXG4gICk6IFByb21pc2U8UGFyc2VMaXZlUXVlcnlTZXJ2ZXI+IHtcbiAgICBpZiAoIWh0dHBTZXJ2ZXIgfHwgKGNvbmZpZyAmJiBjb25maWcucG9ydCkpIHtcbiAgICAgIHZhciBhcHAgPSBleHByZXNzKCk7XG4gICAgICBodHRwU2VydmVyID0gcmVxdWlyZSgnaHR0cCcpLmNyZWF0ZVNlcnZlcihhcHApO1xuICAgICAgaHR0cFNlcnZlci5saXN0ZW4oY29uZmlnLnBvcnQpO1xuICAgIH1cbiAgICBjb25zdCBzZXJ2ZXIgPSBuZXcgUGFyc2VMaXZlUXVlcnlTZXJ2ZXIoaHR0cFNlcnZlciwgY29uZmlnLCBvcHRpb25zKTtcbiAgICBhd2FpdCBzZXJ2ZXIuY29ubmVjdCgpO1xuICAgIHJldHVybiBzZXJ2ZXI7XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgdmVyaWZ5U2VydmVyVXJsKCkge1xuICAgIC8vIHBlcmZvcm0gYSBoZWFsdGggY2hlY2sgb24gdGhlIHNlcnZlclVSTCB2YWx1ZVxuICAgIGlmIChQYXJzZS5zZXJ2ZXJVUkwpIHtcbiAgICAgIGNvbnN0IGlzVmFsaWRIdHRwVXJsID0gc3RyaW5nID0+IHtcbiAgICAgICAgbGV0IHVybDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB1cmwgPSBuZXcgVVJMKHN0cmluZyk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gJ2h0dHA6JyB8fCB1cmwucHJvdG9jb2wgPT09ICdodHRwczonO1xuICAgICAgfTtcbiAgICAgIGNvbnN0IHVybCA9IGAke1BhcnNlLnNlcnZlclVSTC5yZXBsYWNlKC9cXC8kLywgJycpfS9oZWFsdGhgO1xuICAgICAgaWYgKCFpc1ZhbGlkSHR0cFVybCh1cmwpKSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgXFxuV0FSTklORywgVW5hYmxlIHRvIGNvbm5lY3QgdG8gJyR7UGFyc2Uuc2VydmVyVVJMfScgYXMgdGhlIFVSTCBpcyBpbnZhbGlkLmAgK1xuICAgICAgICAgICAgYCBDbG91ZCBjb2RlIGFuZCBwdXNoIG5vdGlmaWNhdGlvbnMgbWF5IGJlIHVuYXZhaWxhYmxlIVxcbmBcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgcmVxdWVzdCA9IHJlcXVpcmUoJy4vcmVxdWVzdCcpO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0KHsgdXJsIH0pLmNhdGNoKHJlc3BvbnNlID0+IHJlc3BvbnNlKTtcbiAgICAgIGNvbnN0IGpzb24gPSByZXNwb25zZS5kYXRhIHx8IG51bGw7XG4gICAgICBjb25zdCByZXRyeSA9IHJlc3BvbnNlLmhlYWRlcnM/LlsncmV0cnktYWZ0ZXInXTtcbiAgICAgIGlmIChyZXRyeSkge1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgcmV0cnkgKiAxMDAwKSk7XG4gICAgICAgIHJldHVybiB0aGlzLnZlcmlmeVNlcnZlclVybCgpO1xuICAgICAgfVxuICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyAhPT0gMjAwIHx8IGpzb24/LnN0YXR1cyAhPT0gJ29rJykge1xuICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgXFxuV0FSTklORywgVW5hYmxlIHRvIGNvbm5lY3QgdG8gJyR7UGFyc2Uuc2VydmVyVVJMfScuYCArXG4gICAgICAgICAgICBgIENsb3VkIGNvZGUgYW5kIHB1c2ggbm90aWZpY2F0aW9ucyBtYXkgYmUgdW5hdmFpbGFibGUhXFxuYFxuICAgICAgICApO1xuICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFkZFBhcnNlQ2xvdWQoKSB7XG4gIGNvbnN0IFBhcnNlQ2xvdWQgPSByZXF1aXJlKCcuL2Nsb3VkLWNvZGUvUGFyc2UuQ2xvdWQnKTtcbiAgY29uc3QgUGFyc2VTZXJ2ZXIgPSByZXF1aXJlKCcuL2Nsb3VkLWNvZGUvUGFyc2UuU2VydmVyJyk7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShQYXJzZSwgJ1NlcnZlcicsIHtcbiAgICBnZXQoKSB7XG4gICAgICBjb25zdCBjb25mID0gQ29uZmlnLmdldChQYXJzZS5hcHBsaWNhdGlvbklkKTtcbiAgICAgIHJldHVybiB7IC4uLmNvbmYsIC4uLlBhcnNlU2VydmVyIH07XG4gICAgfSxcbiAgICBzZXQobmV3VmFsKSB7XG4gICAgICBuZXdWYWwuYXBwSWQgPSBQYXJzZS5hcHBsaWNhdGlvbklkO1xuICAgICAgQ29uZmlnLnB1dChuZXdWYWwpO1xuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICB9KTtcbiAgT2JqZWN0LmFzc2lnbihQYXJzZS5DbG91ZCwgUGFyc2VDbG91ZCk7XG4gIGdsb2JhbC5QYXJzZSA9IFBhcnNlO1xufVxuXG5mdW5jdGlvbiBpbmplY3REZWZhdWx0cyhvcHRpb25zOiBQYXJzZVNlcnZlck9wdGlvbnMpIHtcbiAgT2JqZWN0LmtleXMoZGVmYXVsdHMpLmZvckVhY2goa2V5ID0+IHtcbiAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvcHRpb25zLCBrZXkpKSB7XG4gICAgICBvcHRpb25zW2tleV0gPSBkZWZhdWx0c1trZXldO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob3B0aW9ucywgJ3NlcnZlclVSTCcpKSB7XG4gICAgb3B0aW9ucy5zZXJ2ZXJVUkwgPSBgaHR0cDovL2xvY2FsaG9zdDoke29wdGlvbnMucG9ydH0ke29wdGlvbnMubW91bnRQYXRofWA7XG4gIH1cblxuICAvLyBSZXNlcnZlZCBDaGFyYWN0ZXJzXG4gIGlmIChvcHRpb25zLmFwcElkKSB7XG4gICAgY29uc3QgcmVnZXggPSAvWyEjJCUnKCkqKyYvOjs9P0BbXFxde31eLHw8Pl0vZztcbiAgICBpZiAob3B0aW9ucy5hcHBJZC5tYXRjaChyZWdleCkpIHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgIGBcXG5XQVJOSU5HLCBhcHBJZCB0aGF0IGNvbnRhaW5zIHNwZWNpYWwgY2hhcmFjdGVycyBjYW4gY2F1c2UgaXNzdWVzIHdoaWxlIHVzaW5nIHdpdGggdXJscy5cXG5gXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gIGlmIChvcHRpb25zLnVzZXJTZW5zaXRpdmVGaWVsZHMpIHtcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXG4gICAgIXByb2Nlc3MuZW52LlRFU1RJTkcgJiZcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgYFxcbkRFUFJFQ0FURUQ6IHVzZXJTZW5zaXRpdmVGaWVsZHMgaGFzIGJlZW4gcmVwbGFjZWQgYnkgcHJvdGVjdGVkRmllbGRzIGFsbG93aW5nIHRoZSBhYmlsaXR5IHRvIHByb3RlY3QgZmllbGRzIGluIGFsbCBjbGFzc2VzIHdpdGggQ0xQLiBcXG5gXG4gICAgICApO1xuICAgIC8qIGVzbGludC1lbmFibGUgbm8tY29uc29sZSAqL1xuXG4gICAgY29uc3QgdXNlclNlbnNpdGl2ZUZpZWxkcyA9IEFycmF5LmZyb20oXG4gICAgICBuZXcgU2V0KFsuLi4oZGVmYXVsdHMudXNlclNlbnNpdGl2ZUZpZWxkcyB8fCBbXSksIC4uLihvcHRpb25zLnVzZXJTZW5zaXRpdmVGaWVsZHMgfHwgW10pXSlcbiAgICApO1xuXG4gICAgLy8gSWYgdGhlIG9wdGlvbnMucHJvdGVjdGVkRmllbGRzIGlzIHVuc2V0LFxuICAgIC8vIGl0J2xsIGJlIGFzc2lnbmVkIHRoZSBkZWZhdWx0IGFib3ZlLlxuICAgIC8vIEhlcmUsIHByb3RlY3QgYWdhaW5zdCB0aGUgY2FzZSB3aGVyZSBwcm90ZWN0ZWRGaWVsZHNcbiAgICAvLyBpcyBzZXQsIGJ1dCBkb2Vzbid0IGhhdmUgX1VzZXIuXG4gICAgaWYgKCEoJ19Vc2VyJyBpbiBvcHRpb25zLnByb3RlY3RlZEZpZWxkcykpIHtcbiAgICAgIG9wdGlvbnMucHJvdGVjdGVkRmllbGRzID0gT2JqZWN0LmFzc2lnbih7IF9Vc2VyOiBbXSB9LCBvcHRpb25zLnByb3RlY3RlZEZpZWxkcyk7XG4gICAgfVxuXG4gICAgb3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHNbJ19Vc2VyJ11bJyonXSA9IEFycmF5LmZyb20oXG4gICAgICBuZXcgU2V0KFsuLi4ob3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHNbJ19Vc2VyJ11bJyonXSB8fCBbXSksIC4uLnVzZXJTZW5zaXRpdmVGaWVsZHNdKVxuICAgICk7XG4gIH1cblxuICAvLyBNZXJnZSBwcm90ZWN0ZWRGaWVsZHMgb3B0aW9ucyB3aXRoIGRlZmF1bHRzLlxuICBPYmplY3Qua2V5cyhkZWZhdWx0cy5wcm90ZWN0ZWRGaWVsZHMpLmZvckVhY2goYyA9PiB7XG4gICAgY29uc3QgY3VyID0gb3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHNbY107XG4gICAgaWYgKCFjdXIpIHtcbiAgICAgIG9wdGlvbnMucHJvdGVjdGVkRmllbGRzW2NdID0gZGVmYXVsdHMucHJvdGVjdGVkRmllbGRzW2NdO1xuICAgIH0gZWxzZSB7XG4gICAgICBPYmplY3Qua2V5cyhkZWZhdWx0cy5wcm90ZWN0ZWRGaWVsZHNbY10pLmZvckVhY2gociA9PiB7XG4gICAgICAgIGNvbnN0IHVucSA9IG5ldyBTZXQoW1xuICAgICAgICAgIC4uLihvcHRpb25zLnByb3RlY3RlZEZpZWxkc1tjXVtyXSB8fCBbXSksXG4gICAgICAgICAgLi4uZGVmYXVsdHMucHJvdGVjdGVkRmllbGRzW2NdW3JdLFxuICAgICAgICBdKTtcbiAgICAgICAgb3B0aW9ucy5wcm90ZWN0ZWRGaWVsZHNbY11bcl0gPSBBcnJheS5mcm9tKHVucSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG4vLyBUaG9zZSBjYW4ndCBiZSB0ZXN0ZWQgYXMgaXQgcmVxdWlyZXMgYSBzdWJwcm9jZXNzXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuZnVuY3Rpb24gY29uZmlndXJlTGlzdGVuZXJzKHBhcnNlU2VydmVyKSB7XG4gIGNvbnN0IGhhbmRsZVNodXRkb3duID0gZnVuY3Rpb24gKCkge1xuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKCdUZXJtaW5hdGlvbiBzaWduYWwgcmVjZWl2ZWQuIFNodXR0aW5nIGRvd24uJyk7XG4gICAgcGFyc2VTZXJ2ZXIuaGFuZGxlU2h1dGRvd24oKTtcbiAgfTtcbiAgcHJvY2Vzcy5vbignU0lHVEVSTScsIGhhbmRsZVNodXRkb3duKTtcbiAgcHJvY2Vzcy5vbignU0lHSU5UJywgaGFuZGxlU2h1dGRvd24pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBQYXJzZVNlcnZlcjtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBV0EsSUFBQUEsV0FBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsU0FBQSxHQUFBQyxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUcsT0FBQSxHQUFBQyx1QkFBQSxDQUFBSixPQUFBO0FBQ0EsSUFBQUssT0FBQSxHQUFBSCxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQU0sY0FBQSxHQUFBSixzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQU8sa0JBQUEsR0FBQUwsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFRLGdCQUFBLEdBQUFSLE9BQUE7QUFDQSxJQUFBUyxjQUFBLEdBQUFULE9BQUE7QUFDQSxJQUFBVSxlQUFBLEdBQUFWLE9BQUE7QUFDQSxJQUFBVyxZQUFBLEdBQUFYLE9BQUE7QUFDQSxJQUFBWSxnQkFBQSxHQUFBWixPQUFBO0FBQ0EsSUFBQWEsbUJBQUEsR0FBQWIsT0FBQTtBQUNBLElBQUFjLGNBQUEsR0FBQWQsT0FBQTtBQUNBLElBQUFlLFlBQUEsR0FBQWYsT0FBQTtBQUNBLElBQUFnQixvQkFBQSxHQUFBaEIsT0FBQTtBQUNBLElBQUFpQixvQkFBQSxHQUFBakIsT0FBQTtBQUNBLElBQUFrQixXQUFBLEdBQUFsQixPQUFBO0FBQ0EsSUFBQW1CLHFCQUFBLEdBQUFuQixPQUFBO0FBQ0EsSUFBQW9CLFlBQUEsR0FBQXBCLE9BQUE7QUFDQSxJQUFBcUIsZ0JBQUEsR0FBQXJCLE9BQUE7QUFDQSxJQUFBc0IsV0FBQSxHQUFBdEIsT0FBQTtBQUNBLElBQUF1QixnQkFBQSxHQUFBdkIsT0FBQTtBQUNBLElBQUF3QixZQUFBLEdBQUF4QixPQUFBO0FBQ0EsSUFBQXlCLGNBQUEsR0FBQXpCLE9BQUE7QUFDQSxJQUFB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QUFDO0VBQ0g7O0VBRUE7RUFDQXZQLE1BQU0sQ0FBQ21QLElBQUksQ0FBQ0MsaUJBQVEsQ0FBQ00sZUFBZSxDQUFDLENBQUNsTixPQUFPLENBQUNvTixDQUFDLElBQUk7SUFDakQsTUFBTUMsR0FBRyxHQUFHOU8sT0FBTyxDQUFDMk8sZUFBZSxDQUFDRSxDQUFDLENBQUM7SUFDdEMsSUFBSSxDQUFDQyxHQUFHLEVBQUU7TUFDUjlPLE9BQU8sQ0FBQzJPLGVBQWUsQ0FBQ0UsQ0FBQyxDQUFDLEdBQUdSLGlCQUFRLENBQUNNLGVBQWUsQ0FBQ0UsQ0FBQyxDQUFDO0lBQzFELENBQUMsTUFBTTtNQUNMNVAsTUFBTSxDQUFDbVAsSUFBSSxDQUFDQyxpQkFBUSxDQUFDTSxlQUFlLENBQUNFLENBQUMsQ0FBQyxDQUFDLENBQUNwTixPQUFPLENBQUNyRCxDQUFDLElBQUk7UUFDcEQsTUFBTTJRLEdBQUcsR0FBRyxJQUFJTCxHQUFHLENBQUMsQ0FDbEIsSUFBSTFPLE9BQU8sQ0FBQzJPLGVBQWUsQ0FBQ0UsQ0FBQyxDQUFDLENBQUN6USxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFDeEMsR0FBR2lRLGlCQUFRLENBQUNNLGVBQWUsQ0FBQ0UsQ0FBQyxDQUFDLENBQUN6USxDQUFDLENBQUMsQ0FDbEMsQ0FBQztRQUNGNEIsT0FBTyxDQUFDMk8sZUFBZSxDQUFDRSxDQUFDLENBQUMsQ0FBQ3pRLENBQUMsQ0FBQyxHQUFHbUQsS0FBSyxDQUFDa04sSUFBSSxDQUFDTSxHQUFHLENBQUM7TUFDakQsQ0FBQyxDQUFDO0lBQ0o7RUFDRixDQUFDLENBQUM7QUFDSjs7QUFFQTtBQUNBO0FBQ0EsU0FBU3ZDLGtCQUFrQkEsQ0FBQ0csV0FBVyxFQUFFO0VBQ3ZDLE1BQU01RyxjQUFjLEdBQUcsU0FBQUEsQ0FBQSxFQUFZO0lBQ2pDYixPQUFPLENBQUM4SixNQUFNLENBQUNqRyxLQUFLLENBQUMsNkNBQTZDLENBQUM7SUFDbkU0RCxXQUFXLENBQUM1RyxjQUFjLENBQUMsQ0FBQztFQUM5QixDQUFDO0VBQ0RiLE9BQU8sQ0FBQzBELEVBQUUsQ0FBQyxTQUFTLEVBQUU3QyxjQUFjLENBQUM7RUFDckNiLE9BQU8sQ0FBQzBELEVBQUUsQ0FBQyxRQUFRLEVBQUU3QyxjQUFjLENBQUM7QUFDdEM7QUFBQyxJQUFBa0osUUFBQSxHQUFBQyxPQUFBLENBQUF2USxPQUFBLEdBRWNtQixXQUFXIiwiaWdub3JlTGlzdCI6W119