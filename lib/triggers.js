"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Types = void 0;
exports._unregisterAll = _unregisterAll;
exports.addConnectTrigger = addConnectTrigger;
exports.addFunction = addFunction;
exports.addJob = addJob;
exports.addLiveQueryEventHandler = addLiveQueryEventHandler;
exports.addTrigger = addTrigger;
exports.getClassName = getClassName;
exports.getFunction = getFunction;
exports.getFunctionNames = getFunctionNames;
exports.getJob = getJob;
exports.getJobs = getJobs;
exports.getRequestFileObject = getRequestFileObject;
exports.getRequestObject = getRequestObject;
exports.getRequestQueryObject = getRequestQueryObject;
exports.getResponseObject = getResponseObject;
exports.getTrigger = getTrigger;
exports.getValidator = getValidator;
exports.inflate = inflate;
exports.maybeRunAfterFindTrigger = maybeRunAfterFindTrigger;
exports.maybeRunFileTrigger = maybeRunFileTrigger;
exports.maybeRunQueryTrigger = maybeRunQueryTrigger;
exports.maybeRunTrigger = maybeRunTrigger;
exports.maybeRunValidator = maybeRunValidator;
exports.removeFunction = removeFunction;
exports.removeTrigger = removeTrigger;
exports.resolveError = resolveError;
exports.runLiveQueryEventHandlers = runLiveQueryEventHandlers;
exports.runTrigger = runTrigger;
exports.toJSONwithObjects = toJSONwithObjects;
exports.triggerExists = triggerExists;
var _node = _interopRequireDefault(require("parse/node"));
var _logger = require("./logger");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); } // triggers.js
const Types = {
  beforeLogin: 'beforeLogin',
  afterLogin: 'afterLogin',
  afterLogout: 'afterLogout',
  beforeSave: 'beforeSave',
  afterSave: 'afterSave',
  beforeDelete: 'beforeDelete',
  afterDelete: 'afterDelete',
  beforeFind: 'beforeFind',
  afterFind: 'afterFind',
  beforeConnect: 'beforeConnect',
  beforeSubscribe: 'beforeSubscribe',
  afterEvent: 'afterEvent'
};
exports.Types = Types;
const ConnectClassName = '@Connect';
const baseStore = function () {
  const Validators = Object.keys(Types).reduce(function (base, key) {
    base[key] = {};
    return base;
  }, {});
  const Functions = {};
  const Jobs = {};
  const LiveQuery = [];
  const Triggers = Object.keys(Types).reduce(function (base, key) {
    base[key] = {};
    return base;
  }, {});
  return Object.freeze({
    Functions,
    Jobs,
    Validators,
    Triggers,
    LiveQuery
  });
};
function getClassName(parseClass) {
  if (parseClass && parseClass.className) {
    return parseClass.className;
  }
  if (parseClass && parseClass.name) {
    return parseClass.name.replace('Parse', '@');
  }
  return parseClass;
}
function validateClassNameForTriggers(className, type) {
  if (type == Types.beforeSave && className === '_PushStatus') {
    // _PushStatus uses undocumented nested key increment ops
    // allowing beforeSave would mess up the objects big time
    // TODO: Allow proper documented way of using nested increment ops
    throw 'Only afterSave is allowed on _PushStatus';
  }
  if ((type === Types.beforeLogin || type === Types.afterLogin) && className !== '_User') {
    // TODO: check if upstream code will handle `Error` instance rather
    // than this anti-pattern of throwing strings
    throw 'Only the _User class is allowed for the beforeLogin and afterLogin triggers';
  }
  if (type === Types.afterLogout && className !== '_Session') {
    // TODO: check if upstream code will handle `Error` instance rather
    // than this anti-pattern of throwing strings
    throw 'Only the _Session class is allowed for the afterLogout trigger.';
  }
  if (className === '_Session' && type !== Types.afterLogout) {
    // TODO: check if upstream code will handle `Error` instance rather
    // than this anti-pattern of throwing strings
    throw 'Only the afterLogout trigger is allowed for the _Session class.';
  }
  return className;
}
const _triggerStore = {};
const Category = {
  Functions: 'Functions',
  Validators: 'Validators',
  Jobs: 'Jobs',
  Triggers: 'Triggers'
};
function getStore(category, name, applicationId) {
  const invalidNameRegex = /['"`]/;
  if (invalidNameRegex.test(name)) {
    // Prevent a malicious user from injecting properties into the store
    return {};
  }
  const path = name.split('.');
  path.splice(-1); // remove last component
  applicationId = applicationId || _node.default.applicationId;
  _triggerStore[applicationId] = _triggerStore[applicationId] || baseStore();
  let store = _triggerStore[applicationId][category];
  for (const component of path) {
    store = store[component];
    if (!store) {
      return {};
    }
  }
  return store;
}
function add(category, name, handler, applicationId) {
  const lastComponent = name.split('.').splice(-1);
  const store = getStore(category, name, applicationId);
  if (store[lastComponent]) {
    _logger.logger.warn(`Warning: Duplicate cloud functions exist for ${lastComponent}. Only the last one will be used and the others will be ignored.`);
  }
  store[lastComponent] = handler;
}
function remove(category, name, applicationId) {
  const lastComponent = name.split('.').splice(-1);
  const store = getStore(category, name, applicationId);
  delete store[lastComponent];
}
function get(category, name, applicationId) {
  const lastComponent = name.split('.').splice(-1);
  const store = getStore(category, name, applicationId);
  return store[lastComponent];
}
function addFunction(functionName, handler, validationHandler, applicationId) {
  add(Category.Functions, functionName, handler, applicationId);
  add(Category.Validators, functionName, validationHandler, applicationId);
}
function addJob(jobName, handler, applicationId) {
  add(Category.Jobs, jobName, handler, applicationId);
}
function addTrigger(type, className, handler, applicationId, validationHandler) {
  validateClassNameForTriggers(className, type);
  add(Category.Triggers, `${type}.${className}`, handler, applicationId);
  add(Category.Validators, `${type}.${className}`, validationHandler, applicationId);
}
function addConnectTrigger(type, handler, applicationId, validationHandler) {
  add(Category.Triggers, `${type}.${ConnectClassName}`, handler, applicationId);
  add(Category.Validators, `${type}.${ConnectClassName}`, validationHandler, applicationId);
}
function addLiveQueryEventHandler(handler, applicationId) {
  applicationId = applicationId || _node.default.applicationId;
  _triggerStore[applicationId] = _triggerStore[applicationId] || baseStore();
  _triggerStore[applicationId].LiveQuery.push(handler);
}
function removeFunction(functionName, applicationId) {
  remove(Category.Functions, functionName, applicationId);
}
function removeTrigger(type, className, applicationId) {
  remove(Category.Triggers, `${type}.${className}`, applicationId);
}
function _unregisterAll() {
  Object.keys(_triggerStore).forEach(appId => delete _triggerStore[appId]);
}
function toJSONwithObjects(object, className) {
  if (!object || !object.toJSON) {
    return {};
  }
  const toJSON = object.toJSON();
  const stateController = _node.default.CoreManager.getObjectStateController();
  const [pending] = stateController.getPendingOps(object._getStateIdentifier());
  for (const key in pending) {
    const val = object.get(key);
    if (!val || !val._toFullJSON) {
      toJSON[key] = val;
      continue;
    }
    toJSON[key] = val._toFullJSON();
  }
  if (className) {
    toJSON.className = className;
  }
  return toJSON;
}
function getTrigger(className, triggerType, applicationId) {
  if (!applicationId) {
    throw 'Missing ApplicationID';
  }
  return get(Category.Triggers, `${triggerType}.${className}`, applicationId);
}
async function runTrigger(trigger, name, request, auth) {
  if (!trigger) {
    return;
  }
  await maybeRunValidator(request, name, auth);
  if (request.skipWithMasterKey) {
    return;
  }
  return await trigger(request);
}
function triggerExists(className, type, applicationId) {
  return getTrigger(className, type, applicationId) != undefined;
}
function getFunction(functionName, applicationId) {
  return get(Category.Functions, functionName, applicationId);
}
function getFunctionNames(applicationId) {
  const store = _triggerStore[applicationId] && _triggerStore[applicationId][Category.Functions] || {};
  const functionNames = [];
  const extractFunctionNames = (namespace, store) => {
    Object.keys(store).forEach(name => {
      const value = store[name];
      if (namespace) {
        name = `${namespace}.${name}`;
      }
      if (typeof value === 'function') {
        functionNames.push(name);
      } else {
        extractFunctionNames(name, value);
      }
    });
  };
  extractFunctionNames(null, store);
  return functionNames;
}
function getJob(jobName, applicationId) {
  return get(Category.Jobs, jobName, applicationId);
}
function getJobs(applicationId) {
  var manager = _triggerStore[applicationId];
  if (manager && manager.Jobs) {
    return manager.Jobs;
  }
  return undefined;
}
function getValidator(functionName, applicationId) {
  return get(Category.Validators, functionName, applicationId);
}
function getRequestObject(triggerType, auth, parseObject, originalParseObject, config, context) {
  const request = {
    triggerName: triggerType,
    object: parseObject,
    master: false,
    log: config.loggerController,
    headers: config.headers,
    ip: config.ip
  };
  if (originalParseObject) {
    request.original = originalParseObject;
  }
  if (triggerType === Types.beforeSave || triggerType === Types.afterSave || triggerType === Types.beforeDelete || triggerType === Types.afterDelete || triggerType === Types.beforeLogin || triggerType === Types.afterLogin || triggerType === Types.afterFind) {
    // Set a copy of the context on the request object.
    request.context = Object.assign({}, context);
  }
  if (!auth) {
    return request;
  }
  if (auth.isMaster) {
    request['master'] = true;
  }
  if (auth.user) {
    request['user'] = auth.user;
  }
  if (auth.installationId) {
    request['installationId'] = auth.installationId;
  }
  return request;
}
function getRequestQueryObject(triggerType, auth, query, count, config, context, isGet) {
  isGet = !!isGet;
  var request = {
    triggerName: triggerType,
    query,
    master: false,
    count,
    log: config.loggerController,
    isGet,
    headers: config.headers,
    ip: config.ip,
    context: context || {}
  };
  if (!auth) {
    return request;
  }
  if (auth.isMaster) {
    request['master'] = true;
  }
  if (auth.user) {
    request['user'] = auth.user;
  }
  if (auth.installationId) {
    request['installationId'] = auth.installationId;
  }
  return request;
}

// Creates the response object, and uses the request object to pass data
// The API will call this with REST API formatted objects, this will
// transform them to Parse.Object instances expected by Cloud Code.
// Any changes made to the object in a beforeSave will be included.
function getResponseObject(request, resolve, reject) {
  return {
    success: function (response) {
      if (request.triggerName === Types.afterFind) {
        if (!response) {
          response = request.objects;
        }
        response = response.map(object => {
          return toJSONwithObjects(object);
        });
        return resolve(response);
      }
      // Use the JSON response
      if (response && typeof response === 'object' && !request.object.equals(response) && request.triggerName === Types.beforeSave) {
        return resolve(response);
      }
      if (response && typeof response === 'object' && request.triggerName === Types.afterSave) {
        return resolve(response);
      }
      if (request.triggerName === Types.afterSave) {
        return resolve();
      }
      response = {};
      if (request.triggerName === Types.beforeSave) {
        response['object'] = request.object._getSaveJSON();
        response['object']['objectId'] = request.object.id;
      }
      return resolve(response);
    },
    error: function (error) {
      const e = resolveError(error, {
        code: _node.default.Error.SCRIPT_FAILED,
        message: 'Script failed. Unknown error.'
      });
      reject(e);
    }
  };
}
function userIdForLog(auth) {
  return auth && auth.user ? auth.user.id : undefined;
}
function logTriggerAfterHook(triggerType, className, input, auth, logLevel) {
  const cleanInput = _logger.logger.truncateLogMessage(JSON.stringify(input));
  _logger.logger[logLevel](`${triggerType} triggered for ${className} for user ${userIdForLog(auth)}:\n  Input: ${cleanInput}`, {
    className,
    triggerType,
    user: userIdForLog(auth)
  });
}
function logTriggerSuccessBeforeHook(triggerType, className, input, result, auth, logLevel) {
  const cleanInput = _logger.logger.truncateLogMessage(JSON.stringify(input));
  const cleanResult = _logger.logger.truncateLogMessage(JSON.stringify(result));
  _logger.logger[logLevel](`${triggerType} triggered for ${className} for user ${userIdForLog(auth)}:\n  Input: ${cleanInput}\n  Result: ${cleanResult}`, {
    className,
    triggerType,
    user: userIdForLog(auth)
  });
}
function logTriggerErrorBeforeHook(triggerType, className, input, auth, error, logLevel) {
  const cleanInput = _logger.logger.truncateLogMessage(JSON.stringify(input));
  _logger.logger[logLevel](`${triggerType} failed for ${className} for user ${userIdForLog(auth)}:\n  Input: ${cleanInput}\n  Error: ${JSON.stringify(error)}`, {
    className,
    triggerType,
    error,
    user: userIdForLog(auth)
  });
}
function maybeRunAfterFindTrigger(triggerType, auth, className, objects, config, query, context) {
  return new Promise((resolve, reject) => {
    const trigger = getTrigger(className, triggerType, config.applicationId);
    if (!trigger) {
      return resolve();
    }
    const request = getRequestObject(triggerType, auth, null, null, config, context);
    if (query) {
      request.query = query;
    }
    const {
      success,
      error
    } = getResponseObject(request, object => {
      resolve(object);
    }, error => {
      reject(error);
    });
    logTriggerSuccessBeforeHook(triggerType, className, 'AfterFind', JSON.stringify(objects), auth, config.logLevels.triggerBeforeSuccess);
    request.objects = objects.map(object => {
      //setting the class name to transform into parse object
      object.className = className;
      return _node.default.Object.fromJSON(object);
    });
    return Promise.resolve().then(() => {
      return maybeRunValidator(request, `${triggerType}.${className}`, auth);
    }).then(() => {
      if (request.skipWithMasterKey) {
        return request.objects;
      }
      const response = trigger(request);
      if (response && typeof response.then === 'function') {
        return response.then(results => {
          return results;
        });
      }
      return response;
    }).then(success, error);
  }).then(results => {
    logTriggerAfterHook(triggerType, className, JSON.stringify(results), auth, config.logLevels.triggerAfter);
    return results;
  });
}
function maybeRunQueryTrigger(triggerType, className, restWhere, restOptions, config, auth, context, isGet) {
  const trigger = getTrigger(className, triggerType, config.applicationId);
  if (!trigger) {
    return Promise.resolve({
      restWhere,
      restOptions
    });
  }
  const json = Object.assign({}, restOptions);
  json.where = restWhere;
  const parseQuery = new _node.default.Query(className);
  parseQuery.withJSON(json);
  let count = false;
  if (restOptions) {
    count = !!restOptions.count;
  }
  const requestObject = getRequestQueryObject(triggerType, auth, parseQuery, count, config, context, isGet);
  return Promise.resolve().then(() => {
    return maybeRunValidator(requestObject, `${triggerType}.${className}`, auth);
  }).then(() => {
    if (requestObject.skipWithMasterKey) {
      return requestObject.query;
    }
    return trigger(requestObject);
  }).then(result => {
    let queryResult = parseQuery;
    if (result && result instanceof _node.default.Query) {
      queryResult = result;
    }
    const jsonQuery = queryResult.toJSON();
    if (jsonQuery.where) {
      restWhere = jsonQuery.where;
    }
    if (jsonQuery.limit) {
      restOptions = restOptions || {};
      restOptions.limit = jsonQuery.limit;
    }
    if (jsonQuery.skip) {
      restOptions = restOptions || {};
      restOptions.skip = jsonQuery.skip;
    }
    if (jsonQuery.include) {
      restOptions = restOptions || {};
      restOptions.include = jsonQuery.include;
    }
    if (jsonQuery.excludeKeys) {
      restOptions = restOptions || {};
      restOptions.excludeKeys = jsonQuery.excludeKeys;
    }
    if (jsonQuery.explain) {
      restOptions = restOptions || {};
      restOptions.explain = jsonQuery.explain;
    }
    if (jsonQuery.keys) {
      restOptions = restOptions || {};
      restOptions.keys = jsonQuery.keys;
    }
    if (jsonQuery.order) {
      restOptions = restOptions || {};
      restOptions.order = jsonQuery.order;
    }
    if (jsonQuery.hint) {
      restOptions = restOptions || {};
      restOptions.hint = jsonQuery.hint;
    }
    if (requestObject.readPreference) {
      restOptions = restOptions || {};
      restOptions.readPreference = requestObject.readPreference;
    }
    if (requestObject.includeReadPreference) {
      restOptions = restOptions || {};
      restOptions.includeReadPreference = requestObject.includeReadPreference;
    }
    if (requestObject.subqueryReadPreference) {
      restOptions = restOptions || {};
      restOptions.subqueryReadPreference = requestObject.subqueryReadPreference;
    }
    return {
      restWhere,
      restOptions
    };
  }, err => {
    const error = resolveError(err, {
      code: _node.default.Error.SCRIPT_FAILED,
      message: 'Script failed. Unknown error.'
    });
    throw error;
  });
}
function resolveError(message, defaultOpts) {
  if (!defaultOpts) {
    defaultOpts = {};
  }
  if (!message) {
    return new _node.default.Error(defaultOpts.code || _node.default.Error.SCRIPT_FAILED, defaultOpts.message || 'Script failed.');
  }
  if (message instanceof _node.default.Error) {
    return message;
  }
  const code = defaultOpts.code || _node.default.Error.SCRIPT_FAILED;
  // If it's an error, mark it as a script failed
  if (typeof message === 'string') {
    return new _node.default.Error(code, message);
  }
  const error = new _node.default.Error(code, message.message || message);
  if (message instanceof Error) {
    error.stack = message.stack;
  }
  return error;
}
function maybeRunValidator(request, functionName, auth) {
  const theValidator = getValidator(functionName, _node.default.applicationId);
  if (!theValidator) {
    return;
  }
  if (typeof theValidator === 'object' && theValidator.skipWithMasterKey && request.master) {
    request.skipWithMasterKey = true;
  }
  return new Promise((resolve, reject) => {
    return Promise.resolve().then(() => {
      return typeof theValidator === 'object' ? builtInTriggerValidator(theValidator, request, auth) : theValidator(request);
    }).then(() => {
      resolve();
    }).catch(e => {
      const error = resolveError(e, {
        code: _node.default.Error.VALIDATION_ERROR,
        message: 'Validation failed.'
      });
      reject(error);
    });
  });
}
async function builtInTriggerValidator(options, request, auth) {
  if (request.master && !options.validateMasterKey) {
    return;
  }
  let reqUser = request.user;
  if (!reqUser && request.object && request.object.className === '_User' && !request.object.existed()) {
    reqUser = request.object;
  }
  if ((options.requireUser || options.requireAnyUserRoles || options.requireAllUserRoles) && !reqUser) {
    throw 'Validation failed. Please login to continue.';
  }
  if (options.requireMaster && !request.master) {
    throw 'Validation failed. Master key is required to complete this request.';
  }
  let params = request.params || {};
  if (request.object) {
    params = request.object.toJSON();
  }
  const requiredParam = key => {
    const value = params[key];
    if (value == null) {
      throw `Validation failed. Please specify data for ${key}.`;
    }
  };
  const validateOptions = async (opt, key, val) => {
    let opts = opt.options;
    if (typeof opts === 'function') {
      try {
        const result = await opts(val);
        if (!result && result != null) {
          throw opt.error || `Validation failed. Invalid value for ${key}.`;
        }
      } catch (e) {
        if (!e) {
          throw opt.error || `Validation failed. Invalid value for ${key}.`;
        }
        throw opt.error || e.message || e;
      }
      return;
    }
    if (!Array.isArray(opts)) {
      opts = [opt.options];
    }
    if (!opts.includes(val)) {
      throw opt.error || `Validation failed. Invalid option for ${key}. Expected: ${opts.join(', ')}`;
    }
  };
  const getType = fn => {
    const match = fn && fn.toString().match(/^\s*function (\w+)/);
    return (match ? match[1] : '').toLowerCase();
  };
  if (Array.isArray(options.fields)) {
    for (const key of options.fields) {
      requiredParam(key);
    }
  } else {
    const optionPromises = [];
    for (const key in options.fields) {
      const opt = options.fields[key];
      let val = params[key];
      if (typeof opt === 'string') {
        requiredParam(opt);
      }
      if (typeof opt === 'object') {
        if (opt.default != null && val == null) {
          val = opt.default;
          params[key] = val;
          if (request.object) {
            request.object.set(key, val);
          }
        }
        if (opt.constant && request.object) {
          if (request.original) {
            request.object.revert(key);
          } else if (opt.default != null) {
            request.object.set(key, opt.default);
          }
        }
        if (opt.required) {
          requiredParam(key);
        }
        const optional = !opt.required && val === undefined;
        if (!optional) {
          if (opt.type) {
            const type = getType(opt.type);
            const valType = Array.isArray(val) ? 'array' : typeof val;
            if (valType !== type) {
              throw `Validation failed. Invalid type for ${key}. Expected: ${type}`;
            }
          }
          if (opt.options) {
            optionPromises.push(validateOptions(opt, key, val));
          }
        }
      }
    }
    await Promise.all(optionPromises);
  }
  let userRoles = options.requireAnyUserRoles;
  let requireAllRoles = options.requireAllUserRoles;
  const promises = [Promise.resolve(), Promise.resolve(), Promise.resolve()];
  if (userRoles || requireAllRoles) {
    promises[0] = auth.getUserRoles();
  }
  if (typeof userRoles === 'function') {
    promises[1] = userRoles();
  }
  if (typeof requireAllRoles === 'function') {
    promises[2] = requireAllRoles();
  }
  const [roles, resolvedUserRoles, resolvedRequireAll] = await Promise.all(promises);
  if (resolvedUserRoles && Array.isArray(resolvedUserRoles)) {
    userRoles = resolvedUserRoles;
  }
  if (resolvedRequireAll && Array.isArray(resolvedRequireAll)) {
    requireAllRoles = resolvedRequireAll;
  }
  if (userRoles) {
    const hasRole = userRoles.some(requiredRole => roles.includes(`role:${requiredRole}`));
    if (!hasRole) {
      throw `Validation failed. User does not match the required roles.`;
    }
  }
  if (requireAllRoles) {
    for (const requiredRole of requireAllRoles) {
      if (!roles.includes(`role:${requiredRole}`)) {
        throw `Validation failed. User does not match all the required roles.`;
      }
    }
  }
  const userKeys = options.requireUserKeys || [];
  if (Array.isArray(userKeys)) {
    for (const key of userKeys) {
      if (!reqUser) {
        throw 'Please login to make this request.';
      }
      if (reqUser.get(key) == null) {
        throw `Validation failed. Please set data for ${key} on your account.`;
      }
    }
  } else if (typeof userKeys === 'object') {
    const optionPromises = [];
    for (const key in options.requireUserKeys) {
      const opt = options.requireUserKeys[key];
      if (opt.options) {
        optionPromises.push(validateOptions(opt, key, reqUser.get(key)));
      }
    }
    await Promise.all(optionPromises);
  }
}

// To be used as part of the promise chain when saving/deleting an object
// Will resolve successfully if no trigger is configured
// Resolves to an object, empty or containing an object key. A beforeSave
// trigger will set the object key to the rest format object to save.
// originalParseObject is optional, we only need that for before/afterSave functions
function maybeRunTrigger(triggerType, auth, parseObject, originalParseObject, config, context) {
  if (!parseObject) {
    return Promise.resolve({});
  }
  return new Promise(function (resolve, reject) {
    var trigger = getTrigger(parseObject.className, triggerType, config.applicationId);
    if (!trigger) return resolve();
    var request = getRequestObject(triggerType, auth, parseObject, originalParseObject, config, context);
    var {
      success,
      error
    } = getResponseObject(request, object => {
      logTriggerSuccessBeforeHook(triggerType, parseObject.className, parseObject.toJSON(), object, auth, triggerType.startsWith('after') ? config.logLevels.triggerAfter : config.logLevels.triggerBeforeSuccess);
      if (triggerType === Types.beforeSave || triggerType === Types.afterSave || triggerType === Types.beforeDelete || triggerType === Types.afterDelete) {
        Object.assign(context, request.context);
      }
      resolve(object);
    }, error => {
      logTriggerErrorBeforeHook(triggerType, parseObject.className, parseObject.toJSON(), auth, error, config.logLevels.triggerBeforeError);
      reject(error);
    });

    // AfterSave and afterDelete triggers can return a promise, which if they
    // do, needs to be resolved before this promise is resolved,
    // so trigger execution is synced with RestWrite.execute() call.
    // If triggers do not return a promise, they can run async code parallel
    // to the RestWrite.execute() call.
    return Promise.resolve().then(() => {
      return maybeRunValidator(request, `${triggerType}.${parseObject.className}`, auth);
    }).then(() => {
      if (request.skipWithMasterKey) {
        return Promise.resolve();
      }
      const promise = trigger(request);
      if (triggerType === Types.afterSave || triggerType === Types.afterDelete || triggerType === Types.afterLogin) {
        logTriggerAfterHook(triggerType, parseObject.className, parseObject.toJSON(), auth, config.logLevels.triggerAfter);
      }
      // beforeSave is expected to return null (nothing)
      if (triggerType === Types.beforeSave) {
        if (promise && typeof promise.then === 'function') {
          return promise.then(response => {
            // response.object may come from express routing before hook
            if (response && response.object) {
              return response;
            }
            return null;
          });
        }
        return null;
      }
      return promise;
    }).then(success, error);
  });
}

// Converts a REST-format object to a Parse.Object
// data is either className or an object
function inflate(data, restObject) {
  var copy = typeof data == 'object' ? data : {
    className: data
  };
  for (var key in restObject) {
    copy[key] = restObject[key];
  }
  return _node.default.Object.fromJSON(copy);
}
function runLiveQueryEventHandlers(data, applicationId = _node.default.applicationId) {
  if (!_triggerStore || !_triggerStore[applicationId] || !_triggerStore[applicationId].LiveQuery) {
    return;
  }
  _triggerStore[applicationId].LiveQuery.forEach(handler => handler(data));
}
function getRequestFileObject(triggerType, auth, fileObject, config) {
  const request = _objectSpread(_objectSpread({}, fileObject), {}, {
    triggerName: triggerType,
    master: false,
    log: config.loggerController,
    headers: config.headers,
    ip: config.ip
  });
  if (!auth) {
    return request;
  }
  if (auth.isMaster) {
    request['master'] = true;
  }
  if (auth.user) {
    request['user'] = auth.user;
  }
  if (auth.installationId) {
    request['installationId'] = auth.installationId;
  }
  return request;
}
async function maybeRunFileTrigger(triggerType, fileObject, config, auth) {
  const FileClassName = getClassName(_node.default.File);
  const fileTrigger = getTrigger(FileClassName, triggerType, config.applicationId);
  if (typeof fileTrigger === 'function') {
    try {
      const request = getRequestFileObject(triggerType, auth, fileObject, config);
      await maybeRunValidator(request, `${triggerType}.${FileClassName}`, auth);
      if (request.skipWithMasterKey) {
        return fileObject;
      }
      const result = await fileTrigger(request);
      logTriggerSuccessBeforeHook(triggerType, 'Parse.File', _objectSpread(_objectSpread({}, fileObject.file.toJSON()), {}, {
        fileSize: fileObject.fileSize
      }), result, auth, config.logLevels.triggerBeforeSuccess);
      return result || fileObject;
    } catch (error) {
      logTriggerErrorBeforeHook(triggerType, 'Parse.File', _objectSpread(_objectSpread({}, fileObject.file.toJSON()), {}, {
        fileSize: fileObject.fileSize
      }), auth, error, config.logLevels.triggerBeforeError);
      throw error;
    }
  }
  return fileObject;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbm9kZSIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJyZXF1aXJlIiwiX2xvZ2dlciIsIm9iaiIsIl9fZXNNb2R1bGUiLCJkZWZhdWx0Iiwib3duS2V5cyIsIm9iamVjdCIsImVudW1lcmFibGVPbmx5Iiwia2V5cyIsIk9iamVjdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJmaWx0ZXIiLCJzeW0iLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwicHVzaCIsImFwcGx5IiwiX29iamVjdFNwcmVhZCIsInRhcmdldCIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJzb3VyY2UiLCJmb3JFYWNoIiwia2V5IiwiX2RlZmluZVByb3BlcnR5IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsImRlZmluZVByb3BlcnRpZXMiLCJkZWZpbmVQcm9wZXJ0eSIsInZhbHVlIiwiX3RvUHJvcGVydHlLZXkiLCJjb25maWd1cmFibGUiLCJ3cml0YWJsZSIsImFyZyIsIl90b1ByaW1pdGl2ZSIsIlN0cmluZyIsImlucHV0IiwiaGludCIsInByaW0iLCJTeW1ib2wiLCJ0b1ByaW1pdGl2ZSIsInVuZGVmaW5lZCIsInJlcyIsImNhbGwiLCJUeXBlRXJyb3IiLCJOdW1iZXIiLCJUeXBlcyIsImJlZm9yZUxvZ2luIiwiYWZ0ZXJMb2dpbiIsImFmdGVyTG9nb3V0IiwiYmVmb3JlU2F2ZSIsImFmdGVyU2F2ZSIsImJlZm9yZURlbGV0ZSIsImFmdGVyRGVsZXRlIiwiYmVmb3JlRmluZCIsImFmdGVyRmluZCIsImJlZm9yZUNvbm5lY3QiLCJiZWZvcmVTdWJzY3JpYmUiLCJhZnRlckV2ZW50IiwiZXhwb3J0cyIsIkNvbm5lY3RDbGFzc05hbWUiLCJiYXNlU3RvcmUiLCJWYWxpZGF0b3JzIiwicmVkdWNlIiwiYmFzZSIsIkZ1bmN0aW9ucyIsIkpvYnMiLCJMaXZlUXVlcnkiLCJUcmlnZ2VycyIsImZyZWV6ZSIsImdldENsYXNzTmFtZSIsInBhcnNlQ2xhc3MiLCJjbGFzc05hbWUiLCJuYW1lIiwicmVwbGFjZSIsInZhbGlkYXRlQ2xhc3NOYW1lRm9yVHJpZ2dlcnMiLCJ0eXBlIiwiX3RyaWdnZXJTdG9yZSIsIkNhdGVnb3J5IiwiZ2V0U3RvcmUiLCJjYXRlZ29yeSIsImFwcGxpY2F0aW9uSWQiLCJpbnZhbGlkTmFtZVJlZ2V4IiwidGVzdCIsInBhdGgiLCJzcGxpdCIsInNwbGljZSIsIlBhcnNlIiwic3RvcmUiLCJjb21wb25lbnQiLCJhZGQiLCJoYW5kbGVyIiwibGFzdENvbXBvbmVudCIsImxvZ2dlciIsIndhcm4iLCJyZW1vdmUiLCJnZXQiLCJhZGRGdW5jdGlvbiIsImZ1bmN0aW9uTmFtZSIsInZhbGlkYXRpb25IYW5kbGVyIiwiYWRkSm9iIiwiam9iTmFtZSIsImFkZFRyaWdnZXIiLCJhZGRDb25uZWN0VHJpZ2dlciIsImFkZExpdmVRdWVyeUV2ZW50SGFuZGxlciIsInJlbW92ZUZ1bmN0aW9uIiwicmVtb3ZlVHJpZ2dlciIsIl91bnJlZ2lzdGVyQWxsIiwiYXBwSWQiLCJ0b0pTT053aXRoT2JqZWN0cyIsInRvSlNPTiIsInN0YXRlQ29udHJvbGxlciIsIkNvcmVNYW5hZ2VyIiwiZ2V0T2JqZWN0U3RhdGVDb250cm9sbGVyIiwicGVuZGluZyIsImdldFBlbmRpbmdPcHMiLCJfZ2V0U3RhdGVJZGVudGlmaWVyIiwidmFsIiwiX3RvRnVsbEpTT04iLCJnZXRUcmlnZ2VyIiwidHJpZ2dlclR5cGUiLCJydW5UcmlnZ2VyIiwidHJpZ2dlciIsInJlcXVlc3QiLCJhdXRoIiwibWF5YmVSdW5WYWxpZGF0b3IiLCJza2lwV2l0aE1hc3RlcktleSIsInRyaWdnZXJFeGlzdHMiLCJnZXRGdW5jdGlvbiIsImdldEZ1bmN0aW9uTmFtZXMiLCJmdW5jdGlvbk5hbWVzIiwiZXh0cmFjdEZ1bmN0aW9uTmFtZXMiLCJuYW1lc3BhY2UiLCJnZXRKb2IiLCJnZXRKb2JzIiwibWFuYWdlciIsImdldFZhbGlkYXRvciIsImdldFJlcXVlc3RPYmplY3QiLCJwYXJzZU9iamVjdCIsIm9yaWdpbmFsUGFyc2VPYmplY3QiLCJjb25maWciLCJjb250ZXh0IiwidHJpZ2dlck5hbWUiLCJtYXN0ZXIiLCJsb2ciLCJsb2dnZXJDb250cm9sbGVyIiwiaGVhZGVycyIsImlwIiwib3JpZ2luYWwiLCJhc3NpZ24iLCJpc01hc3RlciIsInVzZXIiLCJpbnN0YWxsYXRpb25JZCIsImdldFJlcXVlc3RRdWVyeU9iamVjdCIsInF1ZXJ5IiwiY291bnQiLCJpc0dldCIsImdldFJlc3BvbnNlT2JqZWN0IiwicmVzb2x2ZSIsInJlamVjdCIsInN1Y2Nlc3MiLCJyZXNwb25zZSIsIm9iamVjdHMiLCJtYXAiLCJlcXVhbHMiLCJfZ2V0U2F2ZUpTT04iLCJpZCIsImVycm9yIiwiZSIsInJlc29sdmVFcnJvciIsImNvZGUiLCJFcnJvciIsIlNDUklQVF9GQUlMRUQiLCJtZXNzYWdlIiwidXNlcklkRm9yTG9nIiwibG9nVHJpZ2dlckFmdGVySG9vayIsImxvZ0xldmVsIiwiY2xlYW5JbnB1dCIsInRydW5jYXRlTG9nTWVzc2FnZSIsIkpTT04iLCJzdHJpbmdpZnkiLCJsb2dUcmlnZ2VyU3VjY2Vzc0JlZm9yZUhvb2siLCJyZXN1bHQiLCJjbGVhblJlc3VsdCIsImxvZ1RyaWdnZXJFcnJvckJlZm9yZUhvb2siLCJtYXliZVJ1bkFmdGVyRmluZFRyaWdnZXIiLCJQcm9taXNlIiwibG9nTGV2ZWxzIiwidHJpZ2dlckJlZm9yZVN1Y2Nlc3MiLCJmcm9tSlNPTiIsInRoZW4iLCJyZXN1bHRzIiwidHJpZ2dlckFmdGVyIiwibWF5YmVSdW5RdWVyeVRyaWdnZXIiLCJyZXN0V2hlcmUiLCJyZXN0T3B0aW9ucyIsImpzb24iLCJ3aGVyZSIsInBhcnNlUXVlcnkiLCJRdWVyeSIsIndpdGhKU09OIiwicmVxdWVzdE9iamVjdCIsInF1ZXJ5UmVzdWx0IiwianNvblF1ZXJ5IiwibGltaXQiLCJza2lwIiwiaW5jbHVkZSIsImV4Y2x1ZGVLZXlzIiwiZXhwbGFpbiIsIm9yZGVyIiwicmVhZFByZWZlcmVuY2UiLCJpbmNsdWRlUmVhZFByZWZlcmVuY2UiLCJzdWJxdWVyeVJlYWRQcmVmZXJlbmNlIiwiZXJyIiwiZGVmYXVsdE9wdHMiLCJzdGFjayIsInRoZVZhbGlkYXRvciIsImJ1aWx0SW5UcmlnZ2VyVmFsaWRhdG9yIiwiY2F0Y2giLCJWQUxJREFUSU9OX0VSUk9SIiwib3B0aW9ucyIsInZhbGlkYXRlTWFzdGVyS2V5IiwicmVxVXNlciIsImV4aXN0ZWQiLCJyZXF1aXJlVXNlciIsInJlcXVpcmVBbnlVc2VyUm9sZXMiLCJyZXF1aXJlQWxsVXNlclJvbGVzIiwicmVxdWlyZU1hc3RlciIsInBhcmFtcyIsInJlcXVpcmVkUGFyYW0iLCJ2YWxpZGF0ZU9wdGlvbnMiLCJvcHQiLCJvcHRzIiwiQXJyYXkiLCJpc0FycmF5IiwiaW5jbHVkZXMiLCJqb2luIiwiZ2V0VHlwZSIsImZuIiwibWF0Y2giLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiZmllbGRzIiwib3B0aW9uUHJvbWlzZXMiLCJzZXQiLCJjb25zdGFudCIsInJldmVydCIsInJlcXVpcmVkIiwib3B0aW9uYWwiLCJ2YWxUeXBlIiwiYWxsIiwidXNlclJvbGVzIiwicmVxdWlyZUFsbFJvbGVzIiwicHJvbWlzZXMiLCJnZXRVc2VyUm9sZXMiLCJyb2xlcyIsInJlc29sdmVkVXNlclJvbGVzIiwicmVzb2x2ZWRSZXF1aXJlQWxsIiwiaGFzUm9sZSIsInNvbWUiLCJyZXF1aXJlZFJvbGUiLCJ1c2VyS2V5cyIsInJlcXVpcmVVc2VyS2V5cyIsIm1heWJlUnVuVHJpZ2dlciIsInN0YXJ0c1dpdGgiLCJ0cmlnZ2VyQmVmb3JlRXJyb3IiLCJwcm9taXNlIiwiaW5mbGF0ZSIsImRhdGEiLCJyZXN0T2JqZWN0IiwiY29weSIsInJ1bkxpdmVRdWVyeUV2ZW50SGFuZGxlcnMiLCJnZXRSZXF1ZXN0RmlsZU9iamVjdCIsImZpbGVPYmplY3QiLCJtYXliZVJ1bkZpbGVUcmlnZ2VyIiwiRmlsZUNsYXNzTmFtZSIsIkZpbGUiLCJmaWxlVHJpZ2dlciIsImZpbGUiLCJmaWxlU2l6ZSJdLCJzb3VyY2VzIjpbIi4uL3NyYy90cmlnZ2Vycy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0cmlnZ2Vycy5qc1xuaW1wb3J0IFBhcnNlIGZyb20gJ3BhcnNlL25vZGUnO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi9sb2dnZXInO1xuXG5leHBvcnQgY29uc3QgVHlwZXMgPSB7XG4gIGJlZm9yZUxvZ2luOiAnYmVmb3JlTG9naW4nLFxuICBhZnRlckxvZ2luOiAnYWZ0ZXJMb2dpbicsXG4gIGFmdGVyTG9nb3V0OiAnYWZ0ZXJMb2dvdXQnLFxuICBiZWZvcmVTYXZlOiAnYmVmb3JlU2F2ZScsXG4gIGFmdGVyU2F2ZTogJ2FmdGVyU2F2ZScsXG4gIGJlZm9yZURlbGV0ZTogJ2JlZm9yZURlbGV0ZScsXG4gIGFmdGVyRGVsZXRlOiAnYWZ0ZXJEZWxldGUnLFxuICBiZWZvcmVGaW5kOiAnYmVmb3JlRmluZCcsXG4gIGFmdGVyRmluZDogJ2FmdGVyRmluZCcsXG4gIGJlZm9yZUNvbm5lY3Q6ICdiZWZvcmVDb25uZWN0JyxcbiAgYmVmb3JlU3Vic2NyaWJlOiAnYmVmb3JlU3Vic2NyaWJlJyxcbiAgYWZ0ZXJFdmVudDogJ2FmdGVyRXZlbnQnLFxufTtcblxuY29uc3QgQ29ubmVjdENsYXNzTmFtZSA9ICdAQ29ubmVjdCc7XG5cbmNvbnN0IGJhc2VTdG9yZSA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc3QgVmFsaWRhdG9ycyA9IE9iamVjdC5rZXlzKFR5cGVzKS5yZWR1Y2UoZnVuY3Rpb24gKGJhc2UsIGtleSkge1xuICAgIGJhc2Vba2V5XSA9IHt9O1xuICAgIHJldHVybiBiYXNlO1xuICB9LCB7fSk7XG4gIGNvbnN0IEZ1bmN0aW9ucyA9IHt9O1xuICBjb25zdCBKb2JzID0ge307XG4gIGNvbnN0IExpdmVRdWVyeSA9IFtdO1xuICBjb25zdCBUcmlnZ2VycyA9IE9iamVjdC5rZXlzKFR5cGVzKS5yZWR1Y2UoZnVuY3Rpb24gKGJhc2UsIGtleSkge1xuICAgIGJhc2Vba2V5XSA9IHt9O1xuICAgIHJldHVybiBiYXNlO1xuICB9LCB7fSk7XG5cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUoe1xuICAgIEZ1bmN0aW9ucyxcbiAgICBKb2JzLFxuICAgIFZhbGlkYXRvcnMsXG4gICAgVHJpZ2dlcnMsXG4gICAgTGl2ZVF1ZXJ5LFxuICB9KTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDbGFzc05hbWUocGFyc2VDbGFzcykge1xuICBpZiAocGFyc2VDbGFzcyAmJiBwYXJzZUNsYXNzLmNsYXNzTmFtZSkge1xuICAgIHJldHVybiBwYXJzZUNsYXNzLmNsYXNzTmFtZTtcbiAgfVxuICBpZiAocGFyc2VDbGFzcyAmJiBwYXJzZUNsYXNzLm5hbWUpIHtcbiAgICByZXR1cm4gcGFyc2VDbGFzcy5uYW1lLnJlcGxhY2UoJ1BhcnNlJywgJ0AnKTtcbiAgfVxuICByZXR1cm4gcGFyc2VDbGFzcztcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVDbGFzc05hbWVGb3JUcmlnZ2VycyhjbGFzc05hbWUsIHR5cGUpIHtcbiAgaWYgKHR5cGUgPT0gVHlwZXMuYmVmb3JlU2F2ZSAmJiBjbGFzc05hbWUgPT09ICdfUHVzaFN0YXR1cycpIHtcbiAgICAvLyBfUHVzaFN0YXR1cyB1c2VzIHVuZG9jdW1lbnRlZCBuZXN0ZWQga2V5IGluY3JlbWVudCBvcHNcbiAgICAvLyBhbGxvd2luZyBiZWZvcmVTYXZlIHdvdWxkIG1lc3MgdXAgdGhlIG9iamVjdHMgYmlnIHRpbWVcbiAgICAvLyBUT0RPOiBBbGxvdyBwcm9wZXIgZG9jdW1lbnRlZCB3YXkgb2YgdXNpbmcgbmVzdGVkIGluY3JlbWVudCBvcHNcbiAgICB0aHJvdyAnT25seSBhZnRlclNhdmUgaXMgYWxsb3dlZCBvbiBfUHVzaFN0YXR1cyc7XG4gIH1cbiAgaWYgKCh0eXBlID09PSBUeXBlcy5iZWZvcmVMb2dpbiB8fCB0eXBlID09PSBUeXBlcy5hZnRlckxvZ2luKSAmJiBjbGFzc05hbWUgIT09ICdfVXNlcicpIHtcbiAgICAvLyBUT0RPOiBjaGVjayBpZiB1cHN0cmVhbSBjb2RlIHdpbGwgaGFuZGxlIGBFcnJvcmAgaW5zdGFuY2UgcmF0aGVyXG4gICAgLy8gdGhhbiB0aGlzIGFudGktcGF0dGVybiBvZiB0aHJvd2luZyBzdHJpbmdzXG4gICAgdGhyb3cgJ09ubHkgdGhlIF9Vc2VyIGNsYXNzIGlzIGFsbG93ZWQgZm9yIHRoZSBiZWZvcmVMb2dpbiBhbmQgYWZ0ZXJMb2dpbiB0cmlnZ2Vycyc7XG4gIH1cbiAgaWYgKHR5cGUgPT09IFR5cGVzLmFmdGVyTG9nb3V0ICYmIGNsYXNzTmFtZSAhPT0gJ19TZXNzaW9uJykge1xuICAgIC8vIFRPRE86IGNoZWNrIGlmIHVwc3RyZWFtIGNvZGUgd2lsbCBoYW5kbGUgYEVycm9yYCBpbnN0YW5jZSByYXRoZXJcbiAgICAvLyB0aGFuIHRoaXMgYW50aS1wYXR0ZXJuIG9mIHRocm93aW5nIHN0cmluZ3NcbiAgICB0aHJvdyAnT25seSB0aGUgX1Nlc3Npb24gY2xhc3MgaXMgYWxsb3dlZCBmb3IgdGhlIGFmdGVyTG9nb3V0IHRyaWdnZXIuJztcbiAgfVxuICBpZiAoY2xhc3NOYW1lID09PSAnX1Nlc3Npb24nICYmIHR5cGUgIT09IFR5cGVzLmFmdGVyTG9nb3V0KSB7XG4gICAgLy8gVE9ETzogY2hlY2sgaWYgdXBzdHJlYW0gY29kZSB3aWxsIGhhbmRsZSBgRXJyb3JgIGluc3RhbmNlIHJhdGhlclxuICAgIC8vIHRoYW4gdGhpcyBhbnRpLXBhdHRlcm4gb2YgdGhyb3dpbmcgc3RyaW5nc1xuICAgIHRocm93ICdPbmx5IHRoZSBhZnRlckxvZ291dCB0cmlnZ2VyIGlzIGFsbG93ZWQgZm9yIHRoZSBfU2Vzc2lvbiBjbGFzcy4nO1xuICB9XG4gIHJldHVybiBjbGFzc05hbWU7XG59XG5cbmNvbnN0IF90cmlnZ2VyU3RvcmUgPSB7fTtcblxuY29uc3QgQ2F0ZWdvcnkgPSB7XG4gIEZ1bmN0aW9uczogJ0Z1bmN0aW9ucycsXG4gIFZhbGlkYXRvcnM6ICdWYWxpZGF0b3JzJyxcbiAgSm9iczogJ0pvYnMnLFxuICBUcmlnZ2VyczogJ1RyaWdnZXJzJyxcbn07XG5cbmZ1bmN0aW9uIGdldFN0b3JlKGNhdGVnb3J5LCBuYW1lLCBhcHBsaWNhdGlvbklkKSB7XG4gIGNvbnN0IGludmFsaWROYW1lUmVnZXggPSAvWydcImBdLztcbiAgaWYgKGludmFsaWROYW1lUmVnZXgudGVzdChuYW1lKSkge1xuICAgIC8vIFByZXZlbnQgYSBtYWxpY2lvdXMgdXNlciBmcm9tIGluamVjdGluZyBwcm9wZXJ0aWVzIGludG8gdGhlIHN0b3JlXG4gICAgcmV0dXJuIHt9O1xuICB9XG5cbiAgY29uc3QgcGF0aCA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgcGF0aC5zcGxpY2UoLTEpOyAvLyByZW1vdmUgbGFzdCBjb21wb25lbnRcbiAgYXBwbGljYXRpb25JZCA9IGFwcGxpY2F0aW9uSWQgfHwgUGFyc2UuYXBwbGljYXRpb25JZDtcbiAgX3RyaWdnZXJTdG9yZVthcHBsaWNhdGlvbklkXSA9IF90cmlnZ2VyU3RvcmVbYXBwbGljYXRpb25JZF0gfHwgYmFzZVN0b3JlKCk7XG4gIGxldCBzdG9yZSA9IF90cmlnZ2VyU3RvcmVbYXBwbGljYXRpb25JZF1bY2F0ZWdvcnldO1xuICBmb3IgKGNvbnN0IGNvbXBvbmVudCBvZiBwYXRoKSB7XG4gICAgc3RvcmUgPSBzdG9yZVtjb21wb25lbnRdO1xuICAgIGlmICghc3RvcmUpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHN0b3JlO1xufVxuXG5mdW5jdGlvbiBhZGQoY2F0ZWdvcnksIG5hbWUsIGhhbmRsZXIsIGFwcGxpY2F0aW9uSWQpIHtcbiAgY29uc3QgbGFzdENvbXBvbmVudCA9IG5hbWUuc3BsaXQoJy4nKS5zcGxpY2UoLTEpO1xuICBjb25zdCBzdG9yZSA9IGdldFN0b3JlKGNhdGVnb3J5LCBuYW1lLCBhcHBsaWNhdGlvbklkKTtcbiAgaWYgKHN0b3JlW2xhc3RDb21wb25lbnRdKSB7XG4gICAgbG9nZ2VyLndhcm4oXG4gICAgICBgV2FybmluZzogRHVwbGljYXRlIGNsb3VkIGZ1bmN0aW9ucyBleGlzdCBmb3IgJHtsYXN0Q29tcG9uZW50fS4gT25seSB0aGUgbGFzdCBvbmUgd2lsbCBiZSB1c2VkIGFuZCB0aGUgb3RoZXJzIHdpbGwgYmUgaWdub3JlZC5gXG4gICAgKTtcbiAgfVxuICBzdG9yZVtsYXN0Q29tcG9uZW50XSA9IGhhbmRsZXI7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZShjYXRlZ29yeSwgbmFtZSwgYXBwbGljYXRpb25JZCkge1xuICBjb25zdCBsYXN0Q29tcG9uZW50ID0gbmFtZS5zcGxpdCgnLicpLnNwbGljZSgtMSk7XG4gIGNvbnN0IHN0b3JlID0gZ2V0U3RvcmUoY2F0ZWdvcnksIG5hbWUsIGFwcGxpY2F0aW9uSWQpO1xuICBkZWxldGUgc3RvcmVbbGFzdENvbXBvbmVudF07XG59XG5cbmZ1bmN0aW9uIGdldChjYXRlZ29yeSwgbmFtZSwgYXBwbGljYXRpb25JZCkge1xuICBjb25zdCBsYXN0Q29tcG9uZW50ID0gbmFtZS5zcGxpdCgnLicpLnNwbGljZSgtMSk7XG4gIGNvbnN0IHN0b3JlID0gZ2V0U3RvcmUoY2F0ZWdvcnksIG5hbWUsIGFwcGxpY2F0aW9uSWQpO1xuICByZXR1cm4gc3RvcmVbbGFzdENvbXBvbmVudF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRGdW5jdGlvbihmdW5jdGlvbk5hbWUsIGhhbmRsZXIsIHZhbGlkYXRpb25IYW5kbGVyLCBhcHBsaWNhdGlvbklkKSB7XG4gIGFkZChDYXRlZ29yeS5GdW5jdGlvbnMsIGZ1bmN0aW9uTmFtZSwgaGFuZGxlciwgYXBwbGljYXRpb25JZCk7XG4gIGFkZChDYXRlZ29yeS5WYWxpZGF0b3JzLCBmdW5jdGlvbk5hbWUsIHZhbGlkYXRpb25IYW5kbGVyLCBhcHBsaWNhdGlvbklkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZEpvYihqb2JOYW1lLCBoYW5kbGVyLCBhcHBsaWNhdGlvbklkKSB7XG4gIGFkZChDYXRlZ29yeS5Kb2JzLCBqb2JOYW1lLCBoYW5kbGVyLCBhcHBsaWNhdGlvbklkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRyaWdnZXIodHlwZSwgY2xhc3NOYW1lLCBoYW5kbGVyLCBhcHBsaWNhdGlvbklkLCB2YWxpZGF0aW9uSGFuZGxlcikge1xuICB2YWxpZGF0ZUNsYXNzTmFtZUZvclRyaWdnZXJzKGNsYXNzTmFtZSwgdHlwZSk7XG4gIGFkZChDYXRlZ29yeS5UcmlnZ2VycywgYCR7dHlwZX0uJHtjbGFzc05hbWV9YCwgaGFuZGxlciwgYXBwbGljYXRpb25JZCk7XG4gIGFkZChDYXRlZ29yeS5WYWxpZGF0b3JzLCBgJHt0eXBlfS4ke2NsYXNzTmFtZX1gLCB2YWxpZGF0aW9uSGFuZGxlciwgYXBwbGljYXRpb25JZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRDb25uZWN0VHJpZ2dlcih0eXBlLCBoYW5kbGVyLCBhcHBsaWNhdGlvbklkLCB2YWxpZGF0aW9uSGFuZGxlcikge1xuICBhZGQoQ2F0ZWdvcnkuVHJpZ2dlcnMsIGAke3R5cGV9LiR7Q29ubmVjdENsYXNzTmFtZX1gLCBoYW5kbGVyLCBhcHBsaWNhdGlvbklkKTtcbiAgYWRkKENhdGVnb3J5LlZhbGlkYXRvcnMsIGAke3R5cGV9LiR7Q29ubmVjdENsYXNzTmFtZX1gLCB2YWxpZGF0aW9uSGFuZGxlciwgYXBwbGljYXRpb25JZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRMaXZlUXVlcnlFdmVudEhhbmRsZXIoaGFuZGxlciwgYXBwbGljYXRpb25JZCkge1xuICBhcHBsaWNhdGlvbklkID0gYXBwbGljYXRpb25JZCB8fCBQYXJzZS5hcHBsaWNhdGlvbklkO1xuICBfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdID0gX3RyaWdnZXJTdG9yZVthcHBsaWNhdGlvbklkXSB8fCBiYXNlU3RvcmUoKTtcbiAgX3RyaWdnZXJTdG9yZVthcHBsaWNhdGlvbklkXS5MaXZlUXVlcnkucHVzaChoYW5kbGVyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZUZ1bmN0aW9uKGZ1bmN0aW9uTmFtZSwgYXBwbGljYXRpb25JZCkge1xuICByZW1vdmUoQ2F0ZWdvcnkuRnVuY3Rpb25zLCBmdW5jdGlvbk5hbWUsIGFwcGxpY2F0aW9uSWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlVHJpZ2dlcih0eXBlLCBjbGFzc05hbWUsIGFwcGxpY2F0aW9uSWQpIHtcbiAgcmVtb3ZlKENhdGVnb3J5LlRyaWdnZXJzLCBgJHt0eXBlfS4ke2NsYXNzTmFtZX1gLCBhcHBsaWNhdGlvbklkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF91bnJlZ2lzdGVyQWxsKCkge1xuICBPYmplY3Qua2V5cyhfdHJpZ2dlclN0b3JlKS5mb3JFYWNoKGFwcElkID0+IGRlbGV0ZSBfdHJpZ2dlclN0b3JlW2FwcElkXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b0pTT053aXRoT2JqZWN0cyhvYmplY3QsIGNsYXNzTmFtZSkge1xuICBpZiAoIW9iamVjdCB8fCAhb2JqZWN0LnRvSlNPTikge1xuICAgIHJldHVybiB7fTtcbiAgfVxuICBjb25zdCB0b0pTT04gPSBvYmplY3QudG9KU09OKCk7XG4gIGNvbnN0IHN0YXRlQ29udHJvbGxlciA9IFBhcnNlLkNvcmVNYW5hZ2VyLmdldE9iamVjdFN0YXRlQ29udHJvbGxlcigpO1xuICBjb25zdCBbcGVuZGluZ10gPSBzdGF0ZUNvbnRyb2xsZXIuZ2V0UGVuZGluZ09wcyhvYmplY3QuX2dldFN0YXRlSWRlbnRpZmllcigpKTtcbiAgZm9yIChjb25zdCBrZXkgaW4gcGVuZGluZykge1xuICAgIGNvbnN0IHZhbCA9IG9iamVjdC5nZXQoa2V5KTtcbiAgICBpZiAoIXZhbCB8fCAhdmFsLl90b0Z1bGxKU09OKSB7XG4gICAgICB0b0pTT05ba2V5XSA9IHZhbDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICB0b0pTT05ba2V5XSA9IHZhbC5fdG9GdWxsSlNPTigpO1xuICB9XG4gIGlmIChjbGFzc05hbWUpIHtcbiAgICB0b0pTT04uY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xuICB9XG4gIHJldHVybiB0b0pTT047XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUcmlnZ2VyKGNsYXNzTmFtZSwgdHJpZ2dlclR5cGUsIGFwcGxpY2F0aW9uSWQpIHtcbiAgaWYgKCFhcHBsaWNhdGlvbklkKSB7XG4gICAgdGhyb3cgJ01pc3NpbmcgQXBwbGljYXRpb25JRCc7XG4gIH1cbiAgcmV0dXJuIGdldChDYXRlZ29yeS5UcmlnZ2VycywgYCR7dHJpZ2dlclR5cGV9LiR7Y2xhc3NOYW1lfWAsIGFwcGxpY2F0aW9uSWQpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuVHJpZ2dlcih0cmlnZ2VyLCBuYW1lLCByZXF1ZXN0LCBhdXRoKSB7XG4gIGlmICghdHJpZ2dlcikge1xuICAgIHJldHVybjtcbiAgfVxuICBhd2FpdCBtYXliZVJ1blZhbGlkYXRvcihyZXF1ZXN0LCBuYW1lLCBhdXRoKTtcbiAgaWYgKHJlcXVlc3Quc2tpcFdpdGhNYXN0ZXJLZXkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgcmV0dXJuIGF3YWl0IHRyaWdnZXIocmVxdWVzdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmlnZ2VyRXhpc3RzKGNsYXNzTmFtZTogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIGFwcGxpY2F0aW9uSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gZ2V0VHJpZ2dlcihjbGFzc05hbWUsIHR5cGUsIGFwcGxpY2F0aW9uSWQpICE9IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZ1bmN0aW9uKGZ1bmN0aW9uTmFtZSwgYXBwbGljYXRpb25JZCkge1xuICByZXR1cm4gZ2V0KENhdGVnb3J5LkZ1bmN0aW9ucywgZnVuY3Rpb25OYW1lLCBhcHBsaWNhdGlvbklkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZ1bmN0aW9uTmFtZXMoYXBwbGljYXRpb25JZCkge1xuICBjb25zdCBzdG9yZSA9XG4gICAgKF90cmlnZ2VyU3RvcmVbYXBwbGljYXRpb25JZF0gJiYgX3RyaWdnZXJTdG9yZVthcHBsaWNhdGlvbklkXVtDYXRlZ29yeS5GdW5jdGlvbnNdKSB8fCB7fTtcbiAgY29uc3QgZnVuY3Rpb25OYW1lcyA9IFtdO1xuICBjb25zdCBleHRyYWN0RnVuY3Rpb25OYW1lcyA9IChuYW1lc3BhY2UsIHN0b3JlKSA9PiB7XG4gICAgT2JqZWN0LmtleXMoc3RvcmUpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHN0b3JlW25hbWVdO1xuICAgICAgaWYgKG5hbWVzcGFjZSkge1xuICAgICAgICBuYW1lID0gYCR7bmFtZXNwYWNlfS4ke25hbWV9YDtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZnVuY3Rpb25OYW1lcy5wdXNoKG5hbWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXh0cmFjdEZ1bmN0aW9uTmFtZXMobmFtZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuICBleHRyYWN0RnVuY3Rpb25OYW1lcyhudWxsLCBzdG9yZSk7XG4gIHJldHVybiBmdW5jdGlvbk5hbWVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Sm9iKGpvYk5hbWUsIGFwcGxpY2F0aW9uSWQpIHtcbiAgcmV0dXJuIGdldChDYXRlZ29yeS5Kb2JzLCBqb2JOYW1lLCBhcHBsaWNhdGlvbklkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEpvYnMoYXBwbGljYXRpb25JZCkge1xuICB2YXIgbWFuYWdlciA9IF90cmlnZ2VyU3RvcmVbYXBwbGljYXRpb25JZF07XG4gIGlmIChtYW5hZ2VyICYmIG1hbmFnZXIuSm9icykge1xuICAgIHJldHVybiBtYW5hZ2VyLkpvYnM7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFZhbGlkYXRvcihmdW5jdGlvbk5hbWUsIGFwcGxpY2F0aW9uSWQpIHtcbiAgcmV0dXJuIGdldChDYXRlZ29yeS5WYWxpZGF0b3JzLCBmdW5jdGlvbk5hbWUsIGFwcGxpY2F0aW9uSWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVxdWVzdE9iamVjdChcbiAgdHJpZ2dlclR5cGUsXG4gIGF1dGgsXG4gIHBhcnNlT2JqZWN0LFxuICBvcmlnaW5hbFBhcnNlT2JqZWN0LFxuICBjb25maWcsXG4gIGNvbnRleHRcbikge1xuICBjb25zdCByZXF1ZXN0ID0ge1xuICAgIHRyaWdnZXJOYW1lOiB0cmlnZ2VyVHlwZSxcbiAgICBvYmplY3Q6IHBhcnNlT2JqZWN0LFxuICAgIG1hc3RlcjogZmFsc2UsXG4gICAgbG9nOiBjb25maWcubG9nZ2VyQ29udHJvbGxlcixcbiAgICBoZWFkZXJzOiBjb25maWcuaGVhZGVycyxcbiAgICBpcDogY29uZmlnLmlwLFxuICB9O1xuXG4gIGlmIChvcmlnaW5hbFBhcnNlT2JqZWN0KSB7XG4gICAgcmVxdWVzdC5vcmlnaW5hbCA9IG9yaWdpbmFsUGFyc2VPYmplY3Q7XG4gIH1cbiAgaWYgKFxuICAgIHRyaWdnZXJUeXBlID09PSBUeXBlcy5iZWZvcmVTYXZlIHx8XG4gICAgdHJpZ2dlclR5cGUgPT09IFR5cGVzLmFmdGVyU2F2ZSB8fFxuICAgIHRyaWdnZXJUeXBlID09PSBUeXBlcy5iZWZvcmVEZWxldGUgfHxcbiAgICB0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYWZ0ZXJEZWxldGUgfHxcbiAgICB0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYmVmb3JlTG9naW4gfHxcbiAgICB0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYWZ0ZXJMb2dpbiB8fFxuICAgIHRyaWdnZXJUeXBlID09PSBUeXBlcy5hZnRlckZpbmRcbiAgKSB7XG4gICAgLy8gU2V0IGEgY29weSBvZiB0aGUgY29udGV4dCBvbiB0aGUgcmVxdWVzdCBvYmplY3QuXG4gICAgcmVxdWVzdC5jb250ZXh0ID0gT2JqZWN0LmFzc2lnbih7fSwgY29udGV4dCk7XG4gIH1cblxuICBpZiAoIWF1dGgpIHtcbiAgICByZXR1cm4gcmVxdWVzdDtcbiAgfVxuICBpZiAoYXV0aC5pc01hc3Rlcikge1xuICAgIHJlcXVlc3RbJ21hc3RlciddID0gdHJ1ZTtcbiAgfVxuICBpZiAoYXV0aC51c2VyKSB7XG4gICAgcmVxdWVzdFsndXNlciddID0gYXV0aC51c2VyO1xuICB9XG4gIGlmIChhdXRoLmluc3RhbGxhdGlvbklkKSB7XG4gICAgcmVxdWVzdFsnaW5zdGFsbGF0aW9uSWQnXSA9IGF1dGguaW5zdGFsbGF0aW9uSWQ7XG4gIH1cbiAgcmV0dXJuIHJlcXVlc3Q7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0UXVlcnlPYmplY3QodHJpZ2dlclR5cGUsIGF1dGgsIHF1ZXJ5LCBjb3VudCwgY29uZmlnLCBjb250ZXh0LCBpc0dldCkge1xuICBpc0dldCA9ICEhaXNHZXQ7XG5cbiAgdmFyIHJlcXVlc3QgPSB7XG4gICAgdHJpZ2dlck5hbWU6IHRyaWdnZXJUeXBlLFxuICAgIHF1ZXJ5LFxuICAgIG1hc3RlcjogZmFsc2UsXG4gICAgY291bnQsXG4gICAgbG9nOiBjb25maWcubG9nZ2VyQ29udHJvbGxlcixcbiAgICBpc0dldCxcbiAgICBoZWFkZXJzOiBjb25maWcuaGVhZGVycyxcbiAgICBpcDogY29uZmlnLmlwLFxuICAgIGNvbnRleHQ6IGNvbnRleHQgfHwge30sXG4gIH07XG5cbiAgaWYgKCFhdXRoKSB7XG4gICAgcmV0dXJuIHJlcXVlc3Q7XG4gIH1cbiAgaWYgKGF1dGguaXNNYXN0ZXIpIHtcbiAgICByZXF1ZXN0WydtYXN0ZXInXSA9IHRydWU7XG4gIH1cbiAgaWYgKGF1dGgudXNlcikge1xuICAgIHJlcXVlc3RbJ3VzZXInXSA9IGF1dGgudXNlcjtcbiAgfVxuICBpZiAoYXV0aC5pbnN0YWxsYXRpb25JZCkge1xuICAgIHJlcXVlc3RbJ2luc3RhbGxhdGlvbklkJ10gPSBhdXRoLmluc3RhbGxhdGlvbklkO1xuICB9XG4gIHJldHVybiByZXF1ZXN0O1xufVxuXG4vLyBDcmVhdGVzIHRoZSByZXNwb25zZSBvYmplY3QsIGFuZCB1c2VzIHRoZSByZXF1ZXN0IG9iamVjdCB0byBwYXNzIGRhdGFcbi8vIFRoZSBBUEkgd2lsbCBjYWxsIHRoaXMgd2l0aCBSRVNUIEFQSSBmb3JtYXR0ZWQgb2JqZWN0cywgdGhpcyB3aWxsXG4vLyB0cmFuc2Zvcm0gdGhlbSB0byBQYXJzZS5PYmplY3QgaW5zdGFuY2VzIGV4cGVjdGVkIGJ5IENsb3VkIENvZGUuXG4vLyBBbnkgY2hhbmdlcyBtYWRlIHRvIHRoZSBvYmplY3QgaW4gYSBiZWZvcmVTYXZlIHdpbGwgYmUgaW5jbHVkZWQuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVzcG9uc2VPYmplY3QocmVxdWVzdCwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gIHJldHVybiB7XG4gICAgc3VjY2VzczogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICBpZiAocmVxdWVzdC50cmlnZ2VyTmFtZSA9PT0gVHlwZXMuYWZ0ZXJGaW5kKSB7XG4gICAgICAgIGlmICghcmVzcG9uc2UpIHtcbiAgICAgICAgICByZXNwb25zZSA9IHJlcXVlc3Qub2JqZWN0cztcbiAgICAgICAgfVxuICAgICAgICByZXNwb25zZSA9IHJlc3BvbnNlLm1hcChvYmplY3QgPT4ge1xuICAgICAgICAgIHJldHVybiB0b0pTT053aXRoT2JqZWN0cyhvYmplY3QpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgfVxuICAgICAgLy8gVXNlIHRoZSBKU09OIHJlc3BvbnNlXG4gICAgICBpZiAoXG4gICAgICAgIHJlc3BvbnNlICYmXG4gICAgICAgIHR5cGVvZiByZXNwb25zZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgIXJlcXVlc3Qub2JqZWN0LmVxdWFscyhyZXNwb25zZSkgJiZcbiAgICAgICAgcmVxdWVzdC50cmlnZ2VyTmFtZSA9PT0gVHlwZXMuYmVmb3JlU2F2ZVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXNwb25zZSAmJiB0eXBlb2YgcmVzcG9uc2UgPT09ICdvYmplY3QnICYmIHJlcXVlc3QudHJpZ2dlck5hbWUgPT09IFR5cGVzLmFmdGVyU2F2ZSkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICB9XG4gICAgICBpZiAocmVxdWVzdC50cmlnZ2VyTmFtZSA9PT0gVHlwZXMuYWZ0ZXJTYXZlKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICB9XG4gICAgICByZXNwb25zZSA9IHt9O1xuICAgICAgaWYgKHJlcXVlc3QudHJpZ2dlck5hbWUgPT09IFR5cGVzLmJlZm9yZVNhdmUpIHtcbiAgICAgICAgcmVzcG9uc2VbJ29iamVjdCddID0gcmVxdWVzdC5vYmplY3QuX2dldFNhdmVKU09OKCk7XG4gICAgICAgIHJlc3BvbnNlWydvYmplY3QnXVsnb2JqZWN0SWQnXSA9IHJlcXVlc3Qub2JqZWN0LmlkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc29sdmUocmVzcG9uc2UpO1xuICAgIH0sXG4gICAgZXJyb3I6IGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgY29uc3QgZSA9IHJlc29sdmVFcnJvcihlcnJvciwge1xuICAgICAgICBjb2RlOiBQYXJzZS5FcnJvci5TQ1JJUFRfRkFJTEVELFxuICAgICAgICBtZXNzYWdlOiAnU2NyaXB0IGZhaWxlZC4gVW5rbm93biBlcnJvci4nLFxuICAgICAgfSk7XG4gICAgICByZWplY3QoZSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlcklkRm9yTG9nKGF1dGgpIHtcbiAgcmV0dXJuIGF1dGggJiYgYXV0aC51c2VyID8gYXV0aC51c2VyLmlkIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBsb2dUcmlnZ2VyQWZ0ZXJIb29rKHRyaWdnZXJUeXBlLCBjbGFzc05hbWUsIGlucHV0LCBhdXRoLCBsb2dMZXZlbCkge1xuICBjb25zdCBjbGVhbklucHV0ID0gbG9nZ2VyLnRydW5jYXRlTG9nTWVzc2FnZShKU09OLnN0cmluZ2lmeShpbnB1dCkpO1xuICBsb2dnZXJbbG9nTGV2ZWxdKFxuICAgIGAke3RyaWdnZXJUeXBlfSB0cmlnZ2VyZWQgZm9yICR7Y2xhc3NOYW1lfSBmb3IgdXNlciAke3VzZXJJZEZvckxvZyhcbiAgICAgIGF1dGhcbiAgICApfTpcXG4gIElucHV0OiAke2NsZWFuSW5wdXR9YCxcbiAgICB7XG4gICAgICBjbGFzc05hbWUsXG4gICAgICB0cmlnZ2VyVHlwZSxcbiAgICAgIHVzZXI6IHVzZXJJZEZvckxvZyhhdXRoKSxcbiAgICB9XG4gICk7XG59XG5cbmZ1bmN0aW9uIGxvZ1RyaWdnZXJTdWNjZXNzQmVmb3JlSG9vayh0cmlnZ2VyVHlwZSwgY2xhc3NOYW1lLCBpbnB1dCwgcmVzdWx0LCBhdXRoLCBsb2dMZXZlbCkge1xuICBjb25zdCBjbGVhbklucHV0ID0gbG9nZ2VyLnRydW5jYXRlTG9nTWVzc2FnZShKU09OLnN0cmluZ2lmeShpbnB1dCkpO1xuICBjb25zdCBjbGVhblJlc3VsdCA9IGxvZ2dlci50cnVuY2F0ZUxvZ01lc3NhZ2UoSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gIGxvZ2dlcltsb2dMZXZlbF0oXG4gICAgYCR7dHJpZ2dlclR5cGV9IHRyaWdnZXJlZCBmb3IgJHtjbGFzc05hbWV9IGZvciB1c2VyICR7dXNlcklkRm9yTG9nKFxuICAgICAgYXV0aFxuICAgICl9OlxcbiAgSW5wdXQ6ICR7Y2xlYW5JbnB1dH1cXG4gIFJlc3VsdDogJHtjbGVhblJlc3VsdH1gLFxuICAgIHtcbiAgICAgIGNsYXNzTmFtZSxcbiAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgdXNlcjogdXNlcklkRm9yTG9nKGF1dGgpLFxuICAgIH1cbiAgKTtcbn1cblxuZnVuY3Rpb24gbG9nVHJpZ2dlckVycm9yQmVmb3JlSG9vayh0cmlnZ2VyVHlwZSwgY2xhc3NOYW1lLCBpbnB1dCwgYXV0aCwgZXJyb3IsIGxvZ0xldmVsKSB7XG4gIGNvbnN0IGNsZWFuSW5wdXQgPSBsb2dnZXIudHJ1bmNhdGVMb2dNZXNzYWdlKEpTT04uc3RyaW5naWZ5KGlucHV0KSk7XG4gIGxvZ2dlcltsb2dMZXZlbF0oXG4gICAgYCR7dHJpZ2dlclR5cGV9IGZhaWxlZCBmb3IgJHtjbGFzc05hbWV9IGZvciB1c2VyICR7dXNlcklkRm9yTG9nKFxuICAgICAgYXV0aFxuICAgICl9OlxcbiAgSW5wdXQ6ICR7Y2xlYW5JbnB1dH1cXG4gIEVycm9yOiAke0pTT04uc3RyaW5naWZ5KGVycm9yKX1gLFxuICAgIHtcbiAgICAgIGNsYXNzTmFtZSxcbiAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgZXJyb3IsXG4gICAgICB1c2VyOiB1c2VySWRGb3JMb2coYXV0aCksXG4gICAgfVxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVSdW5BZnRlckZpbmRUcmlnZ2VyKFxuICB0cmlnZ2VyVHlwZSxcbiAgYXV0aCxcbiAgY2xhc3NOYW1lLFxuICBvYmplY3RzLFxuICBjb25maWcsXG4gIHF1ZXJ5LFxuICBjb250ZXh0XG4pIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCB0cmlnZ2VyID0gZ2V0VHJpZ2dlcihjbGFzc05hbWUsIHRyaWdnZXJUeXBlLCBjb25maWcuYXBwbGljYXRpb25JZCk7XG4gICAgaWYgKCF0cmlnZ2VyKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgIH1cbiAgICBjb25zdCByZXF1ZXN0ID0gZ2V0UmVxdWVzdE9iamVjdCh0cmlnZ2VyVHlwZSwgYXV0aCwgbnVsbCwgbnVsbCwgY29uZmlnLCBjb250ZXh0KTtcbiAgICBpZiAocXVlcnkpIHtcbiAgICAgIHJlcXVlc3QucXVlcnkgPSBxdWVyeTtcbiAgICB9XG4gICAgY29uc3QgeyBzdWNjZXNzLCBlcnJvciB9ID0gZ2V0UmVzcG9uc2VPYmplY3QoXG4gICAgICByZXF1ZXN0LFxuICAgICAgb2JqZWN0ID0+IHtcbiAgICAgICAgcmVzb2x2ZShvYmplY3QpO1xuICAgICAgfSxcbiAgICAgIGVycm9yID0+IHtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICApO1xuICAgIGxvZ1RyaWdnZXJTdWNjZXNzQmVmb3JlSG9vayhcbiAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgY2xhc3NOYW1lLFxuICAgICAgJ0FmdGVyRmluZCcsXG4gICAgICBKU09OLnN0cmluZ2lmeShvYmplY3RzKSxcbiAgICAgIGF1dGgsXG4gICAgICBjb25maWcubG9nTGV2ZWxzLnRyaWdnZXJCZWZvcmVTdWNjZXNzXG4gICAgKTtcbiAgICByZXF1ZXN0Lm9iamVjdHMgPSBvYmplY3RzLm1hcChvYmplY3QgPT4ge1xuICAgICAgLy9zZXR0aW5nIHRoZSBjbGFzcyBuYW1lIHRvIHRyYW5zZm9ybSBpbnRvIHBhcnNlIG9iamVjdFxuICAgICAgb2JqZWN0LmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbiAgICAgIHJldHVybiBQYXJzZS5PYmplY3QuZnJvbUpTT04ob2JqZWN0KTtcbiAgICB9KTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIG1heWJlUnVuVmFsaWRhdG9yKHJlcXVlc3QsIGAke3RyaWdnZXJUeXBlfS4ke2NsYXNzTmFtZX1gLCBhdXRoKTtcbiAgICAgIH0pXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIGlmIChyZXF1ZXN0LnNraXBXaXRoTWFzdGVyS2V5KSB7XG4gICAgICAgICAgcmV0dXJuIHJlcXVlc3Qub2JqZWN0cztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXNwb25zZSA9IHRyaWdnZXIocmVxdWVzdCk7XG4gICAgICAgIGlmIChyZXNwb25zZSAmJiB0eXBlb2YgcmVzcG9uc2UudGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHJldHVybiByZXNwb25zZS50aGVuKHJlc3VsdHMgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgICAgfSlcbiAgICAgIC50aGVuKHN1Y2Nlc3MsIGVycm9yKTtcbiAgfSkudGhlbihyZXN1bHRzID0+IHtcbiAgICBsb2dUcmlnZ2VyQWZ0ZXJIb29rKFxuICAgICAgdHJpZ2dlclR5cGUsXG4gICAgICBjbGFzc05hbWUsXG4gICAgICBKU09OLnN0cmluZ2lmeShyZXN1bHRzKSxcbiAgICAgIGF1dGgsXG4gICAgICBjb25maWcubG9nTGV2ZWxzLnRyaWdnZXJBZnRlclxuICAgICk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVSdW5RdWVyeVRyaWdnZXIoXG4gIHRyaWdnZXJUeXBlLFxuICBjbGFzc05hbWUsXG4gIHJlc3RXaGVyZSxcbiAgcmVzdE9wdGlvbnMsXG4gIGNvbmZpZyxcbiAgYXV0aCxcbiAgY29udGV4dCxcbiAgaXNHZXRcbikge1xuICBjb25zdCB0cmlnZ2VyID0gZ2V0VHJpZ2dlcihjbGFzc05hbWUsIHRyaWdnZXJUeXBlLCBjb25maWcuYXBwbGljYXRpb25JZCk7XG4gIGlmICghdHJpZ2dlcikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe1xuICAgICAgcmVzdFdoZXJlLFxuICAgICAgcmVzdE9wdGlvbnMsXG4gICAgfSk7XG4gIH1cbiAgY29uc3QganNvbiA9IE9iamVjdC5hc3NpZ24oe30sIHJlc3RPcHRpb25zKTtcbiAganNvbi53aGVyZSA9IHJlc3RXaGVyZTtcblxuICBjb25zdCBwYXJzZVF1ZXJ5ID0gbmV3IFBhcnNlLlF1ZXJ5KGNsYXNzTmFtZSk7XG4gIHBhcnNlUXVlcnkud2l0aEpTT04oanNvbik7XG5cbiAgbGV0IGNvdW50ID0gZmFsc2U7XG4gIGlmIChyZXN0T3B0aW9ucykge1xuICAgIGNvdW50ID0gISFyZXN0T3B0aW9ucy5jb3VudDtcbiAgfVxuICBjb25zdCByZXF1ZXN0T2JqZWN0ID0gZ2V0UmVxdWVzdFF1ZXJ5T2JqZWN0KFxuICAgIHRyaWdnZXJUeXBlLFxuICAgIGF1dGgsXG4gICAgcGFyc2VRdWVyeSxcbiAgICBjb3VudCxcbiAgICBjb25maWcsXG4gICAgY29udGV4dCxcbiAgICBpc0dldFxuICApO1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gbWF5YmVSdW5WYWxpZGF0b3IocmVxdWVzdE9iamVjdCwgYCR7dHJpZ2dlclR5cGV9LiR7Y2xhc3NOYW1lfWAsIGF1dGgpO1xuICAgIH0pXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKHJlcXVlc3RPYmplY3Quc2tpcFdpdGhNYXN0ZXJLZXkpIHtcbiAgICAgICAgcmV0dXJuIHJlcXVlc3RPYmplY3QucXVlcnk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJpZ2dlcihyZXF1ZXN0T2JqZWN0KTtcbiAgICB9KVxuICAgIC50aGVuKFxuICAgICAgcmVzdWx0ID0+IHtcbiAgICAgICAgbGV0IHF1ZXJ5UmVzdWx0ID0gcGFyc2VRdWVyeTtcbiAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQgaW5zdGFuY2VvZiBQYXJzZS5RdWVyeSkge1xuICAgICAgICAgIHF1ZXJ5UmVzdWx0ID0gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGpzb25RdWVyeSA9IHF1ZXJ5UmVzdWx0LnRvSlNPTigpO1xuICAgICAgICBpZiAoanNvblF1ZXJ5LndoZXJlKSB7XG4gICAgICAgICAgcmVzdFdoZXJlID0ganNvblF1ZXJ5LndoZXJlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkubGltaXQpIHtcbiAgICAgICAgICByZXN0T3B0aW9ucyA9IHJlc3RPcHRpb25zIHx8IHt9O1xuICAgICAgICAgIHJlc3RPcHRpb25zLmxpbWl0ID0ganNvblF1ZXJ5LmxpbWl0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuc2tpcCkge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMuc2tpcCA9IGpzb25RdWVyeS5za2lwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuaW5jbHVkZSkge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMuaW5jbHVkZSA9IGpzb25RdWVyeS5pbmNsdWRlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuZXhjbHVkZUtleXMpIHtcbiAgICAgICAgICByZXN0T3B0aW9ucyA9IHJlc3RPcHRpb25zIHx8IHt9O1xuICAgICAgICAgIHJlc3RPcHRpb25zLmV4Y2x1ZGVLZXlzID0ganNvblF1ZXJ5LmV4Y2x1ZGVLZXlzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuZXhwbGFpbikge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMuZXhwbGFpbiA9IGpzb25RdWVyeS5leHBsYWluO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkua2V5cykge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMua2V5cyA9IGpzb25RdWVyeS5rZXlzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkub3JkZXIpIHtcbiAgICAgICAgICByZXN0T3B0aW9ucyA9IHJlc3RPcHRpb25zIHx8IHt9O1xuICAgICAgICAgIHJlc3RPcHRpb25zLm9yZGVyID0ganNvblF1ZXJ5Lm9yZGVyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuaGludCkge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMuaGludCA9IGpzb25RdWVyeS5oaW50O1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXF1ZXN0T2JqZWN0LnJlYWRQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgcmVzdE9wdGlvbnMgPSByZXN0T3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICByZXN0T3B0aW9ucy5yZWFkUHJlZmVyZW5jZSA9IHJlcXVlc3RPYmplY3QucmVhZFByZWZlcmVuY2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlcXVlc3RPYmplY3QuaW5jbHVkZVJlYWRQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgcmVzdE9wdGlvbnMgPSByZXN0T3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICByZXN0T3B0aW9ucy5pbmNsdWRlUmVhZFByZWZlcmVuY2UgPSByZXF1ZXN0T2JqZWN0LmluY2x1ZGVSZWFkUHJlZmVyZW5jZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVxdWVzdE9iamVjdC5zdWJxdWVyeVJlYWRQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgcmVzdE9wdGlvbnMgPSByZXN0T3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICByZXN0T3B0aW9ucy5zdWJxdWVyeVJlYWRQcmVmZXJlbmNlID0gcmVxdWVzdE9iamVjdC5zdWJxdWVyeVJlYWRQcmVmZXJlbmNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcmVzdFdoZXJlLFxuICAgICAgICAgIHJlc3RPcHRpb25zLFxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIGVyciA9PiB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gcmVzb2x2ZUVycm9yKGVyciwge1xuICAgICAgICAgIGNvZGU6IFBhcnNlLkVycm9yLlNDUklQVF9GQUlMRUQsXG4gICAgICAgICAgbWVzc2FnZTogJ1NjcmlwdCBmYWlsZWQuIFVua25vd24gZXJyb3IuJyxcbiAgICAgICAgfSk7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlRXJyb3IobWVzc2FnZSwgZGVmYXVsdE9wdHMpIHtcbiAgaWYgKCFkZWZhdWx0T3B0cykge1xuICAgIGRlZmF1bHRPcHRzID0ge307XG4gIH1cbiAgaWYgKCFtZXNzYWdlKSB7XG4gICAgcmV0dXJuIG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIGRlZmF1bHRPcHRzLmNvZGUgfHwgUGFyc2UuRXJyb3IuU0NSSVBUX0ZBSUxFRCxcbiAgICAgIGRlZmF1bHRPcHRzLm1lc3NhZ2UgfHwgJ1NjcmlwdCBmYWlsZWQuJ1xuICAgICk7XG4gIH1cbiAgaWYgKG1lc3NhZ2UgaW5zdGFuY2VvZiBQYXJzZS5FcnJvcikge1xuICAgIHJldHVybiBtZXNzYWdlO1xuICB9XG5cbiAgY29uc3QgY29kZSA9IGRlZmF1bHRPcHRzLmNvZGUgfHwgUGFyc2UuRXJyb3IuU0NSSVBUX0ZBSUxFRDtcbiAgLy8gSWYgaXQncyBhbiBlcnJvciwgbWFyayBpdCBhcyBhIHNjcmlwdCBmYWlsZWRcbiAgaWYgKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBuZXcgUGFyc2UuRXJyb3IoY29kZSwgbWVzc2FnZSk7XG4gIH1cbiAgY29uc3QgZXJyb3IgPSBuZXcgUGFyc2UuRXJyb3IoY29kZSwgbWVzc2FnZS5tZXNzYWdlIHx8IG1lc3NhZ2UpO1xuICBpZiAobWVzc2FnZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgZXJyb3Iuc3RhY2sgPSBtZXNzYWdlLnN0YWNrO1xuICB9XG4gIHJldHVybiBlcnJvcjtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtYXliZVJ1blZhbGlkYXRvcihyZXF1ZXN0LCBmdW5jdGlvbk5hbWUsIGF1dGgpIHtcbiAgY29uc3QgdGhlVmFsaWRhdG9yID0gZ2V0VmFsaWRhdG9yKGZ1bmN0aW9uTmFtZSwgUGFyc2UuYXBwbGljYXRpb25JZCk7XG4gIGlmICghdGhlVmFsaWRhdG9yKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0eXBlb2YgdGhlVmFsaWRhdG9yID09PSAnb2JqZWN0JyAmJiB0aGVWYWxpZGF0b3Iuc2tpcFdpdGhNYXN0ZXJLZXkgJiYgcmVxdWVzdC5tYXN0ZXIpIHtcbiAgICByZXF1ZXN0LnNraXBXaXRoTWFzdGVyS2V5ID0gdHJ1ZTtcbiAgfVxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdHlwZW9mIHRoZVZhbGlkYXRvciA9PT0gJ29iamVjdCdcbiAgICAgICAgICA/IGJ1aWx0SW5UcmlnZ2VyVmFsaWRhdG9yKHRoZVZhbGlkYXRvciwgcmVxdWVzdCwgYXV0aClcbiAgICAgICAgICA6IHRoZVZhbGlkYXRvcihyZXF1ZXN0KTtcbiAgICAgIH0pXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZSA9PiB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gcmVzb2x2ZUVycm9yKGUsIHtcbiAgICAgICAgICBjb2RlOiBQYXJzZS5FcnJvci5WQUxJREFUSU9OX0VSUk9SLFxuICAgICAgICAgIG1lc3NhZ2U6ICdWYWxpZGF0aW9uIGZhaWxlZC4nLFxuICAgICAgICB9KTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH0pO1xuICB9KTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGJ1aWx0SW5UcmlnZ2VyVmFsaWRhdG9yKG9wdGlvbnMsIHJlcXVlc3QsIGF1dGgpIHtcbiAgaWYgKHJlcXVlc3QubWFzdGVyICYmICFvcHRpb25zLnZhbGlkYXRlTWFzdGVyS2V5KSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGxldCByZXFVc2VyID0gcmVxdWVzdC51c2VyO1xuICBpZiAoXG4gICAgIXJlcVVzZXIgJiZcbiAgICByZXF1ZXN0Lm9iamVjdCAmJlxuICAgIHJlcXVlc3Qub2JqZWN0LmNsYXNzTmFtZSA9PT0gJ19Vc2VyJyAmJlxuICAgICFyZXF1ZXN0Lm9iamVjdC5leGlzdGVkKClcbiAgKSB7XG4gICAgcmVxVXNlciA9IHJlcXVlc3Qub2JqZWN0O1xuICB9XG4gIGlmIChcbiAgICAob3B0aW9ucy5yZXF1aXJlVXNlciB8fCBvcHRpb25zLnJlcXVpcmVBbnlVc2VyUm9sZXMgfHwgb3B0aW9ucy5yZXF1aXJlQWxsVXNlclJvbGVzKSAmJlxuICAgICFyZXFVc2VyXG4gICkge1xuICAgIHRocm93ICdWYWxpZGF0aW9uIGZhaWxlZC4gUGxlYXNlIGxvZ2luIHRvIGNvbnRpbnVlLic7XG4gIH1cbiAgaWYgKG9wdGlvbnMucmVxdWlyZU1hc3RlciAmJiAhcmVxdWVzdC5tYXN0ZXIpIHtcbiAgICB0aHJvdyAnVmFsaWRhdGlvbiBmYWlsZWQuIE1hc3RlciBrZXkgaXMgcmVxdWlyZWQgdG8gY29tcGxldGUgdGhpcyByZXF1ZXN0Lic7XG4gIH1cbiAgbGV0IHBhcmFtcyA9IHJlcXVlc3QucGFyYW1zIHx8IHt9O1xuICBpZiAocmVxdWVzdC5vYmplY3QpIHtcbiAgICBwYXJhbXMgPSByZXF1ZXN0Lm9iamVjdC50b0pTT04oKTtcbiAgfVxuICBjb25zdCByZXF1aXJlZFBhcmFtID0ga2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IHBhcmFtc1trZXldO1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICB0aHJvdyBgVmFsaWRhdGlvbiBmYWlsZWQuIFBsZWFzZSBzcGVjaWZ5IGRhdGEgZm9yICR7a2V5fS5gO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCB2YWxpZGF0ZU9wdGlvbnMgPSBhc3luYyAob3B0LCBrZXksIHZhbCkgPT4ge1xuICAgIGxldCBvcHRzID0gb3B0Lm9wdGlvbnM7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBvcHRzKHZhbCk7XG4gICAgICAgIGlmICghcmVzdWx0ICYmIHJlc3VsdCAhPSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgb3B0LmVycm9yIHx8IGBWYWxpZGF0aW9uIGZhaWxlZC4gSW52YWxpZCB2YWx1ZSBmb3IgJHtrZXl9LmA7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKCFlKSB7XG4gICAgICAgICAgdGhyb3cgb3B0LmVycm9yIHx8IGBWYWxpZGF0aW9uIGZhaWxlZC4gSW52YWxpZCB2YWx1ZSBmb3IgJHtrZXl9LmA7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBvcHQuZXJyb3IgfHwgZS5tZXNzYWdlIHx8IGU7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShvcHRzKSkge1xuICAgICAgb3B0cyA9IFtvcHQub3B0aW9uc107XG4gICAgfVxuXG4gICAgaWYgKCFvcHRzLmluY2x1ZGVzKHZhbCkpIHtcbiAgICAgIHRocm93IChcbiAgICAgICAgb3B0LmVycm9yIHx8IGBWYWxpZGF0aW9uIGZhaWxlZC4gSW52YWxpZCBvcHRpb24gZm9yICR7a2V5fS4gRXhwZWN0ZWQ6ICR7b3B0cy5qb2luKCcsICcpfWBcbiAgICAgICk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGdldFR5cGUgPSBmbiA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBmbiAmJiBmbi50b1N0cmluZygpLm1hdGNoKC9eXFxzKmZ1bmN0aW9uIChcXHcrKS8pO1xuICAgIHJldHVybiAobWF0Y2ggPyBtYXRjaFsxXSA6ICcnKS50b0xvd2VyQ2FzZSgpO1xuICB9O1xuICBpZiAoQXJyYXkuaXNBcnJheShvcHRpb25zLmZpZWxkcykpIHtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBvcHRpb25zLmZpZWxkcykge1xuICAgICAgcmVxdWlyZWRQYXJhbShrZXkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zdCBvcHRpb25Qcm9taXNlcyA9IFtdO1xuICAgIGZvciAoY29uc3Qga2V5IGluIG9wdGlvbnMuZmllbGRzKSB7XG4gICAgICBjb25zdCBvcHQgPSBvcHRpb25zLmZpZWxkc1trZXldO1xuICAgICAgbGV0IHZhbCA9IHBhcmFtc1trZXldO1xuICAgICAgaWYgKHR5cGVvZiBvcHQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJlcXVpcmVkUGFyYW0ob3B0KTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb3B0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAob3B0LmRlZmF1bHQgIT0gbnVsbCAmJiB2YWwgPT0gbnVsbCkge1xuICAgICAgICAgIHZhbCA9IG9wdC5kZWZhdWx0O1xuICAgICAgICAgIHBhcmFtc1trZXldID0gdmFsO1xuICAgICAgICAgIGlmIChyZXF1ZXN0Lm9iamVjdCkge1xuICAgICAgICAgICAgcmVxdWVzdC5vYmplY3Quc2V0KGtleSwgdmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdC5jb25zdGFudCAmJiByZXF1ZXN0Lm9iamVjdCkge1xuICAgICAgICAgIGlmIChyZXF1ZXN0Lm9yaWdpbmFsKSB7XG4gICAgICAgICAgICByZXF1ZXN0Lm9iamVjdC5yZXZlcnQoa2V5KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG9wdC5kZWZhdWx0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJlcXVlc3Qub2JqZWN0LnNldChrZXksIG9wdC5kZWZhdWx0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdC5yZXF1aXJlZCkge1xuICAgICAgICAgIHJlcXVpcmVkUGFyYW0oa2V5KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvcHRpb25hbCA9ICFvcHQucmVxdWlyZWQgJiYgdmFsID09PSB1bmRlZmluZWQ7XG4gICAgICAgIGlmICghb3B0aW9uYWwpIHtcbiAgICAgICAgICBpZiAob3B0LnR5cGUpIHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBnZXRUeXBlKG9wdC50eXBlKTtcbiAgICAgICAgICAgIGNvbnN0IHZhbFR5cGUgPSBBcnJheS5pc0FycmF5KHZhbCkgPyAnYXJyYXknIDogdHlwZW9mIHZhbDtcbiAgICAgICAgICAgIGlmICh2YWxUeXBlICE9PSB0eXBlKSB7XG4gICAgICAgICAgICAgIHRocm93IGBWYWxpZGF0aW9uIGZhaWxlZC4gSW52YWxpZCB0eXBlIGZvciAke2tleX0uIEV4cGVjdGVkOiAke3R5cGV9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wdC5vcHRpb25zKSB7XG4gICAgICAgICAgICBvcHRpb25Qcm9taXNlcy5wdXNoKHZhbGlkYXRlT3B0aW9ucyhvcHQsIGtleSwgdmFsKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGF3YWl0IFByb21pc2UuYWxsKG9wdGlvblByb21pc2VzKTtcbiAgfVxuICBsZXQgdXNlclJvbGVzID0gb3B0aW9ucy5yZXF1aXJlQW55VXNlclJvbGVzO1xuICBsZXQgcmVxdWlyZUFsbFJvbGVzID0gb3B0aW9ucy5yZXF1aXJlQWxsVXNlclJvbGVzO1xuICBjb25zdCBwcm9taXNlcyA9IFtQcm9taXNlLnJlc29sdmUoKSwgUHJvbWlzZS5yZXNvbHZlKCksIFByb21pc2UucmVzb2x2ZSgpXTtcbiAgaWYgKHVzZXJSb2xlcyB8fCByZXF1aXJlQWxsUm9sZXMpIHtcbiAgICBwcm9taXNlc1swXSA9IGF1dGguZ2V0VXNlclJvbGVzKCk7XG4gIH1cbiAgaWYgKHR5cGVvZiB1c2VyUm9sZXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBwcm9taXNlc1sxXSA9IHVzZXJSb2xlcygpO1xuICB9XG4gIGlmICh0eXBlb2YgcmVxdWlyZUFsbFJvbGVzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcHJvbWlzZXNbMl0gPSByZXF1aXJlQWxsUm9sZXMoKTtcbiAgfVxuICBjb25zdCBbcm9sZXMsIHJlc29sdmVkVXNlclJvbGVzLCByZXNvbHZlZFJlcXVpcmVBbGxdID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuICBpZiAocmVzb2x2ZWRVc2VyUm9sZXMgJiYgQXJyYXkuaXNBcnJheShyZXNvbHZlZFVzZXJSb2xlcykpIHtcbiAgICB1c2VyUm9sZXMgPSByZXNvbHZlZFVzZXJSb2xlcztcbiAgfVxuICBpZiAocmVzb2x2ZWRSZXF1aXJlQWxsICYmIEFycmF5LmlzQXJyYXkocmVzb2x2ZWRSZXF1aXJlQWxsKSkge1xuICAgIHJlcXVpcmVBbGxSb2xlcyA9IHJlc29sdmVkUmVxdWlyZUFsbDtcbiAgfVxuICBpZiAodXNlclJvbGVzKSB7XG4gICAgY29uc3QgaGFzUm9sZSA9IHVzZXJSb2xlcy5zb21lKHJlcXVpcmVkUm9sZSA9PiByb2xlcy5pbmNsdWRlcyhgcm9sZToke3JlcXVpcmVkUm9sZX1gKSk7XG4gICAgaWYgKCFoYXNSb2xlKSB7XG4gICAgICB0aHJvdyBgVmFsaWRhdGlvbiBmYWlsZWQuIFVzZXIgZG9lcyBub3QgbWF0Y2ggdGhlIHJlcXVpcmVkIHJvbGVzLmA7XG4gICAgfVxuICB9XG4gIGlmIChyZXF1aXJlQWxsUm9sZXMpIHtcbiAgICBmb3IgKGNvbnN0IHJlcXVpcmVkUm9sZSBvZiByZXF1aXJlQWxsUm9sZXMpIHtcbiAgICAgIGlmICghcm9sZXMuaW5jbHVkZXMoYHJvbGU6JHtyZXF1aXJlZFJvbGV9YCkpIHtcbiAgICAgICAgdGhyb3cgYFZhbGlkYXRpb24gZmFpbGVkLiBVc2VyIGRvZXMgbm90IG1hdGNoIGFsbCB0aGUgcmVxdWlyZWQgcm9sZXMuYDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29uc3QgdXNlcktleXMgPSBvcHRpb25zLnJlcXVpcmVVc2VyS2V5cyB8fCBbXTtcbiAgaWYgKEFycmF5LmlzQXJyYXkodXNlcktleXMpKSB7XG4gICAgZm9yIChjb25zdCBrZXkgb2YgdXNlcktleXMpIHtcbiAgICAgIGlmICghcmVxVXNlcikge1xuICAgICAgICB0aHJvdyAnUGxlYXNlIGxvZ2luIHRvIG1ha2UgdGhpcyByZXF1ZXN0Lic7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXFVc2VyLmdldChrZXkpID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgYFZhbGlkYXRpb24gZmFpbGVkLiBQbGVhc2Ugc2V0IGRhdGEgZm9yICR7a2V5fSBvbiB5b3VyIGFjY291bnQuYDtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHVzZXJLZXlzID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IG9wdGlvblByb21pc2VzID0gW107XG4gICAgZm9yIChjb25zdCBrZXkgaW4gb3B0aW9ucy5yZXF1aXJlVXNlcktleXMpIHtcbiAgICAgIGNvbnN0IG9wdCA9IG9wdGlvbnMucmVxdWlyZVVzZXJLZXlzW2tleV07XG4gICAgICBpZiAob3B0Lm9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9uUHJvbWlzZXMucHVzaCh2YWxpZGF0ZU9wdGlvbnMob3B0LCBrZXksIHJlcVVzZXIuZ2V0KGtleSkpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwob3B0aW9uUHJvbWlzZXMpO1xuICB9XG59XG5cbi8vIFRvIGJlIHVzZWQgYXMgcGFydCBvZiB0aGUgcHJvbWlzZSBjaGFpbiB3aGVuIHNhdmluZy9kZWxldGluZyBhbiBvYmplY3Rcbi8vIFdpbGwgcmVzb2x2ZSBzdWNjZXNzZnVsbHkgaWYgbm8gdHJpZ2dlciBpcyBjb25maWd1cmVkXG4vLyBSZXNvbHZlcyB0byBhbiBvYmplY3QsIGVtcHR5IG9yIGNvbnRhaW5pbmcgYW4gb2JqZWN0IGtleS4gQSBiZWZvcmVTYXZlXG4vLyB0cmlnZ2VyIHdpbGwgc2V0IHRoZSBvYmplY3Qga2V5IHRvIHRoZSByZXN0IGZvcm1hdCBvYmplY3QgdG8gc2F2ZS5cbi8vIG9yaWdpbmFsUGFyc2VPYmplY3QgaXMgb3B0aW9uYWwsIHdlIG9ubHkgbmVlZCB0aGF0IGZvciBiZWZvcmUvYWZ0ZXJTYXZlIGZ1bmN0aW9uc1xuZXhwb3J0IGZ1bmN0aW9uIG1heWJlUnVuVHJpZ2dlcihcbiAgdHJpZ2dlclR5cGUsXG4gIGF1dGgsXG4gIHBhcnNlT2JqZWN0LFxuICBvcmlnaW5hbFBhcnNlT2JqZWN0LFxuICBjb25maWcsXG4gIGNvbnRleHRcbikge1xuICBpZiAoIXBhcnNlT2JqZWN0KSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7fSk7XG4gIH1cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgdHJpZ2dlciA9IGdldFRyaWdnZXIocGFyc2VPYmplY3QuY2xhc3NOYW1lLCB0cmlnZ2VyVHlwZSwgY29uZmlnLmFwcGxpY2F0aW9uSWQpO1xuICAgIGlmICghdHJpZ2dlcikgcmV0dXJuIHJlc29sdmUoKTtcbiAgICB2YXIgcmVxdWVzdCA9IGdldFJlcXVlc3RPYmplY3QoXG4gICAgICB0cmlnZ2VyVHlwZSxcbiAgICAgIGF1dGgsXG4gICAgICBwYXJzZU9iamVjdCxcbiAgICAgIG9yaWdpbmFsUGFyc2VPYmplY3QsXG4gICAgICBjb25maWcsXG4gICAgICBjb250ZXh0XG4gICAgKTtcbiAgICB2YXIgeyBzdWNjZXNzLCBlcnJvciB9ID0gZ2V0UmVzcG9uc2VPYmplY3QoXG4gICAgICByZXF1ZXN0LFxuICAgICAgb2JqZWN0ID0+IHtcbiAgICAgICAgbG9nVHJpZ2dlclN1Y2Nlc3NCZWZvcmVIb29rKFxuICAgICAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgICAgIHBhcnNlT2JqZWN0LmNsYXNzTmFtZSxcbiAgICAgICAgICBwYXJzZU9iamVjdC50b0pTT04oKSxcbiAgICAgICAgICBvYmplY3QsXG4gICAgICAgICAgYXV0aCxcbiAgICAgICAgICB0cmlnZ2VyVHlwZS5zdGFydHNXaXRoKCdhZnRlcicpXG4gICAgICAgICAgICA/IGNvbmZpZy5sb2dMZXZlbHMudHJpZ2dlckFmdGVyXG4gICAgICAgICAgICA6IGNvbmZpZy5sb2dMZXZlbHMudHJpZ2dlckJlZm9yZVN1Y2Nlc3NcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHRyaWdnZXJUeXBlID09PSBUeXBlcy5iZWZvcmVTYXZlIHx8XG4gICAgICAgICAgdHJpZ2dlclR5cGUgPT09IFR5cGVzLmFmdGVyU2F2ZSB8fFxuICAgICAgICAgIHRyaWdnZXJUeXBlID09PSBUeXBlcy5iZWZvcmVEZWxldGUgfHxcbiAgICAgICAgICB0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYWZ0ZXJEZWxldGVcbiAgICAgICAgKSB7XG4gICAgICAgICAgT2JqZWN0LmFzc2lnbihjb250ZXh0LCByZXF1ZXN0LmNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUob2JqZWN0KTtcbiAgICAgIH0sXG4gICAgICBlcnJvciA9PiB7XG4gICAgICAgIGxvZ1RyaWdnZXJFcnJvckJlZm9yZUhvb2soXG4gICAgICAgICAgdHJpZ2dlclR5cGUsXG4gICAgICAgICAgcGFyc2VPYmplY3QuY2xhc3NOYW1lLFxuICAgICAgICAgIHBhcnNlT2JqZWN0LnRvSlNPTigpLFxuICAgICAgICAgIGF1dGgsXG4gICAgICAgICAgZXJyb3IsXG4gICAgICAgICAgY29uZmlnLmxvZ0xldmVscy50cmlnZ2VyQmVmb3JlRXJyb3JcbiAgICAgICAgKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQWZ0ZXJTYXZlIGFuZCBhZnRlckRlbGV0ZSB0cmlnZ2VycyBjYW4gcmV0dXJuIGEgcHJvbWlzZSwgd2hpY2ggaWYgdGhleVxuICAgIC8vIGRvLCBuZWVkcyB0byBiZSByZXNvbHZlZCBiZWZvcmUgdGhpcyBwcm9taXNlIGlzIHJlc29sdmVkLFxuICAgIC8vIHNvIHRyaWdnZXIgZXhlY3V0aW9uIGlzIHN5bmNlZCB3aXRoIFJlc3RXcml0ZS5leGVjdXRlKCkgY2FsbC5cbiAgICAvLyBJZiB0cmlnZ2VycyBkbyBub3QgcmV0dXJuIGEgcHJvbWlzZSwgdGhleSBjYW4gcnVuIGFzeW5jIGNvZGUgcGFyYWxsZWxcbiAgICAvLyB0byB0aGUgUmVzdFdyaXRlLmV4ZWN1dGUoKSBjYWxsLlxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gbWF5YmVSdW5WYWxpZGF0b3IocmVxdWVzdCwgYCR7dHJpZ2dlclR5cGV9LiR7cGFyc2VPYmplY3QuY2xhc3NOYW1lfWAsIGF1dGgpO1xuICAgICAgfSlcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKHJlcXVlc3Quc2tpcFdpdGhNYXN0ZXJLZXkpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcHJvbWlzZSA9IHRyaWdnZXIocmVxdWVzdCk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYWZ0ZXJTYXZlIHx8XG4gICAgICAgICAgdHJpZ2dlclR5cGUgPT09IFR5cGVzLmFmdGVyRGVsZXRlIHx8XG4gICAgICAgICAgdHJpZ2dlclR5cGUgPT09IFR5cGVzLmFmdGVyTG9naW5cbiAgICAgICAgKSB7XG4gICAgICAgICAgbG9nVHJpZ2dlckFmdGVySG9vayhcbiAgICAgICAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgICAgICAgcGFyc2VPYmplY3QuY2xhc3NOYW1lLFxuICAgICAgICAgICAgcGFyc2VPYmplY3QudG9KU09OKCksXG4gICAgICAgICAgICBhdXRoLFxuICAgICAgICAgICAgY29uZmlnLmxvZ0xldmVscy50cmlnZ2VyQWZ0ZXJcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGJlZm9yZVNhdmUgaXMgZXhwZWN0ZWQgdG8gcmV0dXJuIG51bGwgKG5vdGhpbmcpXG4gICAgICAgIGlmICh0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYmVmb3JlU2F2ZSkge1xuICAgICAgICAgIGlmIChwcm9taXNlICYmIHR5cGVvZiBwcm9taXNlLnRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAvLyByZXNwb25zZS5vYmplY3QgbWF5IGNvbWUgZnJvbSBleHByZXNzIHJvdXRpbmcgYmVmb3JlIGhvb2tcbiAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLm9iamVjdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgICAgfSlcbiAgICAgIC50aGVuKHN1Y2Nlc3MsIGVycm9yKTtcbiAgfSk7XG59XG5cbi8vIENvbnZlcnRzIGEgUkVTVC1mb3JtYXQgb2JqZWN0IHRvIGEgUGFyc2UuT2JqZWN0XG4vLyBkYXRhIGlzIGVpdGhlciBjbGFzc05hbWUgb3IgYW4gb2JqZWN0XG5leHBvcnQgZnVuY3Rpb24gaW5mbGF0ZShkYXRhLCByZXN0T2JqZWN0KSB7XG4gIHZhciBjb3B5ID0gdHlwZW9mIGRhdGEgPT0gJ29iamVjdCcgPyBkYXRhIDogeyBjbGFzc05hbWU6IGRhdGEgfTtcbiAgZm9yICh2YXIga2V5IGluIHJlc3RPYmplY3QpIHtcbiAgICBjb3B5W2tleV0gPSByZXN0T2JqZWN0W2tleV07XG4gIH1cbiAgcmV0dXJuIFBhcnNlLk9iamVjdC5mcm9tSlNPTihjb3B5KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bkxpdmVRdWVyeUV2ZW50SGFuZGxlcnMoZGF0YSwgYXBwbGljYXRpb25JZCA9IFBhcnNlLmFwcGxpY2F0aW9uSWQpIHtcbiAgaWYgKCFfdHJpZ2dlclN0b3JlIHx8ICFfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdIHx8ICFfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdLkxpdmVRdWVyeSkge1xuICAgIHJldHVybjtcbiAgfVxuICBfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdLkxpdmVRdWVyeS5mb3JFYWNoKGhhbmRsZXIgPT4gaGFuZGxlcihkYXRhKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0RmlsZU9iamVjdCh0cmlnZ2VyVHlwZSwgYXV0aCwgZmlsZU9iamVjdCwgY29uZmlnKSB7XG4gIGNvbnN0IHJlcXVlc3QgPSB7XG4gICAgLi4uZmlsZU9iamVjdCxcbiAgICB0cmlnZ2VyTmFtZTogdHJpZ2dlclR5cGUsXG4gICAgbWFzdGVyOiBmYWxzZSxcbiAgICBsb2c6IGNvbmZpZy5sb2dnZXJDb250cm9sbGVyLFxuICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzLFxuICAgIGlwOiBjb25maWcuaXAsXG4gIH07XG5cbiAgaWYgKCFhdXRoKSB7XG4gICAgcmV0dXJuIHJlcXVlc3Q7XG4gIH1cbiAgaWYgKGF1dGguaXNNYXN0ZXIpIHtcbiAgICByZXF1ZXN0WydtYXN0ZXInXSA9IHRydWU7XG4gIH1cbiAgaWYgKGF1dGgudXNlcikge1xuICAgIHJlcXVlc3RbJ3VzZXInXSA9IGF1dGgudXNlcjtcbiAgfVxuICBpZiAoYXV0aC5pbnN0YWxsYXRpb25JZCkge1xuICAgIHJlcXVlc3RbJ2luc3RhbGxhdGlvbklkJ10gPSBhdXRoLmluc3RhbGxhdGlvbklkO1xuICB9XG4gIHJldHVybiByZXF1ZXN0O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWF5YmVSdW5GaWxlVHJpZ2dlcih0cmlnZ2VyVHlwZSwgZmlsZU9iamVjdCwgY29uZmlnLCBhdXRoKSB7XG4gIGNvbnN0IEZpbGVDbGFzc05hbWUgPSBnZXRDbGFzc05hbWUoUGFyc2UuRmlsZSk7XG4gIGNvbnN0IGZpbGVUcmlnZ2VyID0gZ2V0VHJpZ2dlcihGaWxlQ2xhc3NOYW1lLCB0cmlnZ2VyVHlwZSwgY29uZmlnLmFwcGxpY2F0aW9uSWQpO1xuICBpZiAodHlwZW9mIGZpbGVUcmlnZ2VyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcXVlc3QgPSBnZXRSZXF1ZXN0RmlsZU9iamVjdCh0cmlnZ2VyVHlwZSwgYXV0aCwgZmlsZU9iamVjdCwgY29uZmlnKTtcbiAgICAgIGF3YWl0IG1heWJlUnVuVmFsaWRhdG9yKHJlcXVlc3QsIGAke3RyaWdnZXJUeXBlfS4ke0ZpbGVDbGFzc05hbWV9YCwgYXV0aCk7XG4gICAgICBpZiAocmVxdWVzdC5za2lwV2l0aE1hc3RlcktleSkge1xuICAgICAgICByZXR1cm4gZmlsZU9iamVjdDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZpbGVUcmlnZ2VyKHJlcXVlc3QpO1xuICAgICAgbG9nVHJpZ2dlclN1Y2Nlc3NCZWZvcmVIb29rKFxuICAgICAgICB0cmlnZ2VyVHlwZSxcbiAgICAgICAgJ1BhcnNlLkZpbGUnLFxuICAgICAgICB7IC4uLmZpbGVPYmplY3QuZmlsZS50b0pTT04oKSwgZmlsZVNpemU6IGZpbGVPYmplY3QuZmlsZVNpemUgfSxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICBhdXRoLFxuICAgICAgICBjb25maWcubG9nTGV2ZWxzLnRyaWdnZXJCZWZvcmVTdWNjZXNzXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdCB8fCBmaWxlT2JqZWN0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dUcmlnZ2VyRXJyb3JCZWZvcmVIb29rKFxuICAgICAgICB0cmlnZ2VyVHlwZSxcbiAgICAgICAgJ1BhcnNlLkZpbGUnLFxuICAgICAgICB7IC4uLmZpbGVPYmplY3QuZmlsZS50b0pTT04oKSwgZmlsZVNpemU6IGZpbGVPYmplY3QuZmlsZVNpemUgfSxcbiAgICAgICAgYXV0aCxcbiAgICAgICAgZXJyb3IsXG4gICAgICAgIGNvbmZpZy5sb2dMZXZlbHMudHJpZ2dlckJlZm9yZUVycm9yXG4gICAgICApO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG4gIHJldHVybiBmaWxlT2JqZWN0O1xufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSxJQUFBQSxLQUFBLEdBQUFDLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBQyxPQUFBLEdBQUFELE9BQUE7QUFBa0MsU0FBQUQsdUJBQUFHLEdBQUEsV0FBQUEsR0FBQSxJQUFBQSxHQUFBLENBQUFDLFVBQUEsR0FBQUQsR0FBQSxLQUFBRSxPQUFBLEVBQUFGLEdBQUE7QUFBQSxTQUFBRyxRQUFBQyxNQUFBLEVBQUFDLGNBQUEsUUFBQUMsSUFBQSxHQUFBQyxNQUFBLENBQUFELElBQUEsQ0FBQUYsTUFBQSxPQUFBRyxNQUFBLENBQUFDLHFCQUFBLFFBQUFDLE9BQUEsR0FBQUYsTUFBQSxDQUFBQyxxQkFBQSxDQUFBSixNQUFBLEdBQUFDLGNBQUEsS0FBQUksT0FBQSxHQUFBQSxPQUFBLENBQUFDLE1BQUEsV0FBQUMsR0FBQSxXQUFBSixNQUFBLENBQUFLLHdCQUFBLENBQUFSLE1BQUEsRUFBQU8sR0FBQSxFQUFBRSxVQUFBLE9BQUFQLElBQUEsQ0FBQVEsSUFBQSxDQUFBQyxLQUFBLENBQUFULElBQUEsRUFBQUcsT0FBQSxZQUFBSCxJQUFBO0FBQUEsU0FBQVUsY0FBQUMsTUFBQSxhQUFBQyxDQUFBLE1BQUFBLENBQUEsR0FBQUMsU0FBQSxDQUFBQyxNQUFBLEVBQUFGLENBQUEsVUFBQUcsTUFBQSxXQUFBRixTQUFBLENBQUFELENBQUEsSUFBQUMsU0FBQSxDQUFBRCxDQUFBLFFBQUFBLENBQUEsT0FBQWYsT0FBQSxDQUFBSSxNQUFBLENBQUFjLE1BQUEsT0FBQUMsT0FBQSxXQUFBQyxHQUFBLElBQUFDLGVBQUEsQ0FBQVAsTUFBQSxFQUFBTSxHQUFBLEVBQUFGLE1BQUEsQ0FBQUUsR0FBQSxTQUFBaEIsTUFBQSxDQUFBa0IseUJBQUEsR0FBQWxCLE1BQUEsQ0FBQW1CLGdCQUFBLENBQUFULE1BQUEsRUFBQVYsTUFBQSxDQUFBa0IseUJBQUEsQ0FBQUosTUFBQSxLQUFBbEIsT0FBQSxDQUFBSSxNQUFBLENBQUFjLE1BQUEsR0FBQUMsT0FBQSxXQUFBQyxHQUFBLElBQUFoQixNQUFBLENBQUFvQixjQUFBLENBQUFWLE1BQUEsRUFBQU0sR0FBQSxFQUFBaEIsTUFBQSxDQUFBSyx3QkFBQSxDQUFBUyxNQUFBLEVBQUFFLEdBQUEsaUJBQUFOLE1BQUE7QUFBQSxTQUFBTyxnQkFBQXhCLEdBQUEsRUFBQXVCLEdBQUEsRUFBQUssS0FBQSxJQUFBTCxHQUFBLEdBQUFNLGNBQUEsQ0FBQU4sR0FBQSxPQUFBQSxHQUFBLElBQUF2QixHQUFBLElBQUFPLE1BQUEsQ0FBQW9CLGNBQUEsQ0FBQTNCLEdBQUEsRUFBQXVCLEdBQUEsSUFBQUssS0FBQSxFQUFBQSxLQUFBLEVBQUFmLFVBQUEsUUFBQWlCLFlBQUEsUUFBQUMsUUFBQSxvQkFBQS9CLEdBQUEsQ0FBQXVCLEdBQUEsSUFBQUssS0FBQSxXQUFBNUIsR0FBQTtBQUFBLFNBQUE2QixlQUFBRyxHQUFBLFFBQUFULEdBQUEsR0FBQVUsWUFBQSxDQUFBRCxHQUFBLDJCQUFBVCxHQUFBLGdCQUFBQSxHQUFBLEdBQUFXLE1BQUEsQ0FBQVgsR0FBQTtBQUFBLFNBQUFVLGFBQUFFLEtBQUEsRUFBQUMsSUFBQSxlQUFBRCxLQUFBLGlCQUFBQSxLQUFBLGtCQUFBQSxLQUFBLE1BQUFFLElBQUEsR0FBQUYsS0FBQSxDQUFBRyxNQUFBLENBQUFDLFdBQUEsT0FBQUYsSUFBQSxLQUFBRyxTQUFBLFFBQUFDLEdBQUEsR0FBQUosSUFBQSxDQUFBSyxJQUFBLENBQUFQLEtBQUEsRUFBQUMsSUFBQSwyQkFBQUssR0FBQSxzQkFBQUEsR0FBQSxZQUFBRSxTQUFBLDREQUFBUCxJQUFBLGdCQUFBRixNQUFBLEdBQUFVLE1BQUEsRUFBQVQsS0FBQSxLQUZsQztBQUlPLE1BQU1VLEtBQUssR0FBRztFQUNuQkMsV0FBVyxFQUFFLGFBQWE7RUFDMUJDLFVBQVUsRUFBRSxZQUFZO0VBQ3hCQyxXQUFXLEVBQUUsYUFBYTtFQUMxQkMsVUFBVSxFQUFFLFlBQVk7RUFDeEJDLFNBQVMsRUFBRSxXQUFXO0VBQ3RCQyxZQUFZLEVBQUUsY0FBYztFQUM1QkMsV0FBVyxFQUFFLGFBQWE7RUFDMUJDLFVBQVUsRUFBRSxZQUFZO0VBQ3hCQyxTQUFTLEVBQUUsV0FBVztFQUN0QkMsYUFBYSxFQUFFLGVBQWU7RUFDOUJDLGVBQWUsRUFBRSxpQkFBaUI7RUFDbENDLFVBQVUsRUFBRTtBQUNkLENBQUM7QUFBQ0MsT0FBQSxDQUFBYixLQUFBLEdBQUFBLEtBQUE7QUFFRixNQUFNYyxnQkFBZ0IsR0FBRyxVQUFVO0FBRW5DLE1BQU1DLFNBQVMsR0FBRyxTQUFBQSxDQUFBLEVBQVk7RUFDNUIsTUFBTUMsVUFBVSxHQUFHdEQsTUFBTSxDQUFDRCxJQUFJLENBQUN1QyxLQUFLLENBQUMsQ0FBQ2lCLE1BQU0sQ0FBQyxVQUFVQyxJQUFJLEVBQUV4QyxHQUFHLEVBQUU7SUFDaEV3QyxJQUFJLENBQUN4QyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDZCxPQUFPd0MsSUFBSTtFQUNiLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztFQUNOLE1BQU1DLFNBQVMsR0FBRyxDQUFDLENBQUM7RUFDcEIsTUFBTUMsSUFBSSxHQUFHLENBQUMsQ0FBQztFQUNmLE1BQU1DLFNBQVMsR0FBRyxFQUFFO0VBQ3BCLE1BQU1DLFFBQVEsR0FBRzVELE1BQU0sQ0FBQ0QsSUFBSSxDQUFDdUMsS0FBSyxDQUFDLENBQUNpQixNQUFNLENBQUMsVUFBVUMsSUFBSSxFQUFFeEMsR0FBRyxFQUFFO0lBQzlEd0MsSUFBSSxDQUFDeEMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2QsT0FBT3dDLElBQUk7RUFDYixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7RUFFTixPQUFPeEQsTUFBTSxDQUFDNkQsTUFBTSxDQUFDO0lBQ25CSixTQUFTO0lBQ1RDLElBQUk7SUFDSkosVUFBVTtJQUNWTSxRQUFRO0lBQ1JEO0VBQ0YsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVNLFNBQVNHLFlBQVlBLENBQUNDLFVBQVUsRUFBRTtFQUN2QyxJQUFJQSxVQUFVLElBQUlBLFVBQVUsQ0FBQ0MsU0FBUyxFQUFFO0lBQ3RDLE9BQU9ELFVBQVUsQ0FBQ0MsU0FBUztFQUM3QjtFQUNBLElBQUlELFVBQVUsSUFBSUEsVUFBVSxDQUFDRSxJQUFJLEVBQUU7SUFDakMsT0FBT0YsVUFBVSxDQUFDRSxJQUFJLENBQUNDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDO0VBQzlDO0VBQ0EsT0FBT0gsVUFBVTtBQUNuQjtBQUVBLFNBQVNJLDRCQUE0QkEsQ0FBQ0gsU0FBUyxFQUFFSSxJQUFJLEVBQUU7RUFDckQsSUFBSUEsSUFBSSxJQUFJOUIsS0FBSyxDQUFDSSxVQUFVLElBQUlzQixTQUFTLEtBQUssYUFBYSxFQUFFO0lBQzNEO0lBQ0E7SUFDQTtJQUNBLE1BQU0sMENBQTBDO0VBQ2xEO0VBQ0EsSUFBSSxDQUFDSSxJQUFJLEtBQUs5QixLQUFLLENBQUNDLFdBQVcsSUFBSTZCLElBQUksS0FBSzlCLEtBQUssQ0FBQ0UsVUFBVSxLQUFLd0IsU0FBUyxLQUFLLE9BQU8sRUFBRTtJQUN0RjtJQUNBO0lBQ0EsTUFBTSw2RUFBNkU7RUFDckY7RUFDQSxJQUFJSSxJQUFJLEtBQUs5QixLQUFLLENBQUNHLFdBQVcsSUFBSXVCLFNBQVMsS0FBSyxVQUFVLEVBQUU7SUFDMUQ7SUFDQTtJQUNBLE1BQU0saUVBQWlFO0VBQ3pFO0VBQ0EsSUFBSUEsU0FBUyxLQUFLLFVBQVUsSUFBSUksSUFBSSxLQUFLOUIsS0FBSyxDQUFDRyxXQUFXLEVBQUU7SUFDMUQ7SUFDQTtJQUNBLE1BQU0saUVBQWlFO0VBQ3pFO0VBQ0EsT0FBT3VCLFNBQVM7QUFDbEI7QUFFQSxNQUFNSyxhQUFhLEdBQUcsQ0FBQyxDQUFDO0FBRXhCLE1BQU1DLFFBQVEsR0FBRztFQUNmYixTQUFTLEVBQUUsV0FBVztFQUN0QkgsVUFBVSxFQUFFLFlBQVk7RUFDeEJJLElBQUksRUFBRSxNQUFNO0VBQ1pFLFFBQVEsRUFBRTtBQUNaLENBQUM7QUFFRCxTQUFTVyxRQUFRQSxDQUFDQyxRQUFRLEVBQUVQLElBQUksRUFBRVEsYUFBYSxFQUFFO0VBQy9DLE1BQU1DLGdCQUFnQixHQUFHLE9BQU87RUFDaEMsSUFBSUEsZ0JBQWdCLENBQUNDLElBQUksQ0FBQ1YsSUFBSSxDQUFDLEVBQUU7SUFDL0I7SUFDQSxPQUFPLENBQUMsQ0FBQztFQUNYO0VBRUEsTUFBTVcsSUFBSSxHQUFHWCxJQUFJLENBQUNZLEtBQUssQ0FBQyxHQUFHLENBQUM7RUFDNUJELElBQUksQ0FBQ0UsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNqQkwsYUFBYSxHQUFHQSxhQUFhLElBQUlNLGFBQUssQ0FBQ04sYUFBYTtFQUNwREosYUFBYSxDQUFDSSxhQUFhLENBQUMsR0FBR0osYUFBYSxDQUFDSSxhQUFhLENBQUMsSUFBSXBCLFNBQVMsQ0FBQyxDQUFDO0VBQzFFLElBQUkyQixLQUFLLEdBQUdYLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLENBQUNELFFBQVEsQ0FBQztFQUNsRCxLQUFLLE1BQU1TLFNBQVMsSUFBSUwsSUFBSSxFQUFFO0lBQzVCSSxLQUFLLEdBQUdBLEtBQUssQ0FBQ0MsU0FBUyxDQUFDO0lBQ3hCLElBQUksQ0FBQ0QsS0FBSyxFQUFFO01BQ1YsT0FBTyxDQUFDLENBQUM7SUFDWDtFQUNGO0VBQ0EsT0FBT0EsS0FBSztBQUNkO0FBRUEsU0FBU0UsR0FBR0EsQ0FBQ1YsUUFBUSxFQUFFUCxJQUFJLEVBQUVrQixPQUFPLEVBQUVWLGFBQWEsRUFBRTtFQUNuRCxNQUFNVyxhQUFhLEdBQUduQixJQUFJLENBQUNZLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQ0MsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ2hELE1BQU1FLEtBQUssR0FBR1QsUUFBUSxDQUFDQyxRQUFRLEVBQUVQLElBQUksRUFBRVEsYUFBYSxDQUFDO0VBQ3JELElBQUlPLEtBQUssQ0FBQ0ksYUFBYSxDQUFDLEVBQUU7SUFDeEJDLGNBQU0sQ0FBQ0MsSUFBSSxDQUNSLGdEQUErQ0YsYUFBYyxrRUFDaEUsQ0FBQztFQUNIO0VBQ0FKLEtBQUssQ0FBQ0ksYUFBYSxDQUFDLEdBQUdELE9BQU87QUFDaEM7QUFFQSxTQUFTSSxNQUFNQSxDQUFDZixRQUFRLEVBQUVQLElBQUksRUFBRVEsYUFBYSxFQUFFO0VBQzdDLE1BQU1XLGFBQWEsR0FBR25CLElBQUksQ0FBQ1ksS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDaEQsTUFBTUUsS0FBSyxHQUFHVCxRQUFRLENBQUNDLFFBQVEsRUFBRVAsSUFBSSxFQUFFUSxhQUFhLENBQUM7RUFDckQsT0FBT08sS0FBSyxDQUFDSSxhQUFhLENBQUM7QUFDN0I7QUFFQSxTQUFTSSxHQUFHQSxDQUFDaEIsUUFBUSxFQUFFUCxJQUFJLEVBQUVRLGFBQWEsRUFBRTtFQUMxQyxNQUFNVyxhQUFhLEdBQUduQixJQUFJLENBQUNZLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQ0MsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ2hELE1BQU1FLEtBQUssR0FBR1QsUUFBUSxDQUFDQyxRQUFRLEVBQUVQLElBQUksRUFBRVEsYUFBYSxDQUFDO0VBQ3JELE9BQU9PLEtBQUssQ0FBQ0ksYUFBYSxDQUFDO0FBQzdCO0FBRU8sU0FBU0ssV0FBV0EsQ0FBQ0MsWUFBWSxFQUFFUCxPQUFPLEVBQUVRLGlCQUFpQixFQUFFbEIsYUFBYSxFQUFFO0VBQ25GUyxHQUFHLENBQUNaLFFBQVEsQ0FBQ2IsU0FBUyxFQUFFaUMsWUFBWSxFQUFFUCxPQUFPLEVBQUVWLGFBQWEsQ0FBQztFQUM3RFMsR0FBRyxDQUFDWixRQUFRLENBQUNoQixVQUFVLEVBQUVvQyxZQUFZLEVBQUVDLGlCQUFpQixFQUFFbEIsYUFBYSxDQUFDO0FBQzFFO0FBRU8sU0FBU21CLE1BQU1BLENBQUNDLE9BQU8sRUFBRVYsT0FBTyxFQUFFVixhQUFhLEVBQUU7RUFDdERTLEdBQUcsQ0FBQ1osUUFBUSxDQUFDWixJQUFJLEVBQUVtQyxPQUFPLEVBQUVWLE9BQU8sRUFBRVYsYUFBYSxDQUFDO0FBQ3JEO0FBRU8sU0FBU3FCLFVBQVVBLENBQUMxQixJQUFJLEVBQUVKLFNBQVMsRUFBRW1CLE9BQU8sRUFBRVYsYUFBYSxFQUFFa0IsaUJBQWlCLEVBQUU7RUFDckZ4Qiw0QkFBNEIsQ0FBQ0gsU0FBUyxFQUFFSSxJQUFJLENBQUM7RUFDN0NjLEdBQUcsQ0FBQ1osUUFBUSxDQUFDVixRQUFRLEVBQUcsR0FBRVEsSUFBSyxJQUFHSixTQUFVLEVBQUMsRUFBRW1CLE9BQU8sRUFBRVYsYUFBYSxDQUFDO0VBQ3RFUyxHQUFHLENBQUNaLFFBQVEsQ0FBQ2hCLFVBQVUsRUFBRyxHQUFFYyxJQUFLLElBQUdKLFNBQVUsRUFBQyxFQUFFMkIsaUJBQWlCLEVBQUVsQixhQUFhLENBQUM7QUFDcEY7QUFFTyxTQUFTc0IsaUJBQWlCQSxDQUFDM0IsSUFBSSxFQUFFZSxPQUFPLEVBQUVWLGFBQWEsRUFBRWtCLGlCQUFpQixFQUFFO0VBQ2pGVCxHQUFHLENBQUNaLFFBQVEsQ0FBQ1YsUUFBUSxFQUFHLEdBQUVRLElBQUssSUFBR2hCLGdCQUFpQixFQUFDLEVBQUUrQixPQUFPLEVBQUVWLGFBQWEsQ0FBQztFQUM3RVMsR0FBRyxDQUFDWixRQUFRLENBQUNoQixVQUFVLEVBQUcsR0FBRWMsSUFBSyxJQUFHaEIsZ0JBQWlCLEVBQUMsRUFBRXVDLGlCQUFpQixFQUFFbEIsYUFBYSxDQUFDO0FBQzNGO0FBRU8sU0FBU3VCLHdCQUF3QkEsQ0FBQ2IsT0FBTyxFQUFFVixhQUFhLEVBQUU7RUFDL0RBLGFBQWEsR0FBR0EsYUFBYSxJQUFJTSxhQUFLLENBQUNOLGFBQWE7RUFDcERKLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLEdBQUdKLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLElBQUlwQixTQUFTLENBQUMsQ0FBQztFQUMxRWdCLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLENBQUNkLFNBQVMsQ0FBQ3BELElBQUksQ0FBQzRFLE9BQU8sQ0FBQztBQUN0RDtBQUVPLFNBQVNjLGNBQWNBLENBQUNQLFlBQVksRUFBRWpCLGFBQWEsRUFBRTtFQUMxRGMsTUFBTSxDQUFDakIsUUFBUSxDQUFDYixTQUFTLEVBQUVpQyxZQUFZLEVBQUVqQixhQUFhLENBQUM7QUFDekQ7QUFFTyxTQUFTeUIsYUFBYUEsQ0FBQzlCLElBQUksRUFBRUosU0FBUyxFQUFFUyxhQUFhLEVBQUU7RUFDNURjLE1BQU0sQ0FBQ2pCLFFBQVEsQ0FBQ1YsUUFBUSxFQUFHLEdBQUVRLElBQUssSUFBR0osU0FBVSxFQUFDLEVBQUVTLGFBQWEsQ0FBQztBQUNsRTtBQUVPLFNBQVMwQixjQUFjQSxDQUFBLEVBQUc7RUFDL0JuRyxNQUFNLENBQUNELElBQUksQ0FBQ3NFLGFBQWEsQ0FBQyxDQUFDdEQsT0FBTyxDQUFDcUYsS0FBSyxJQUFJLE9BQU8vQixhQUFhLENBQUMrQixLQUFLLENBQUMsQ0FBQztBQUMxRTtBQUVPLFNBQVNDLGlCQUFpQkEsQ0FBQ3hHLE1BQU0sRUFBRW1FLFNBQVMsRUFBRTtFQUNuRCxJQUFJLENBQUNuRSxNQUFNLElBQUksQ0FBQ0EsTUFBTSxDQUFDeUcsTUFBTSxFQUFFO0lBQzdCLE9BQU8sQ0FBQyxDQUFDO0VBQ1g7RUFDQSxNQUFNQSxNQUFNLEdBQUd6RyxNQUFNLENBQUN5RyxNQUFNLENBQUMsQ0FBQztFQUM5QixNQUFNQyxlQUFlLEdBQUd4QixhQUFLLENBQUN5QixXQUFXLENBQUNDLHdCQUF3QixDQUFDLENBQUM7RUFDcEUsTUFBTSxDQUFDQyxPQUFPLENBQUMsR0FBR0gsZUFBZSxDQUFDSSxhQUFhLENBQUM5RyxNQUFNLENBQUMrRyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7RUFDN0UsS0FBSyxNQUFNNUYsR0FBRyxJQUFJMEYsT0FBTyxFQUFFO0lBQ3pCLE1BQU1HLEdBQUcsR0FBR2hILE1BQU0sQ0FBQzJGLEdBQUcsQ0FBQ3hFLEdBQUcsQ0FBQztJQUMzQixJQUFJLENBQUM2RixHQUFHLElBQUksQ0FBQ0EsR0FBRyxDQUFDQyxXQUFXLEVBQUU7TUFDNUJSLE1BQU0sQ0FBQ3RGLEdBQUcsQ0FBQyxHQUFHNkYsR0FBRztNQUNqQjtJQUNGO0lBQ0FQLE1BQU0sQ0FBQ3RGLEdBQUcsQ0FBQyxHQUFHNkYsR0FBRyxDQUFDQyxXQUFXLENBQUMsQ0FBQztFQUNqQztFQUNBLElBQUk5QyxTQUFTLEVBQUU7SUFDYnNDLE1BQU0sQ0FBQ3RDLFNBQVMsR0FBR0EsU0FBUztFQUM5QjtFQUNBLE9BQU9zQyxNQUFNO0FBQ2Y7QUFFTyxTQUFTUyxVQUFVQSxDQUFDL0MsU0FBUyxFQUFFZ0QsV0FBVyxFQUFFdkMsYUFBYSxFQUFFO0VBQ2hFLElBQUksQ0FBQ0EsYUFBYSxFQUFFO0lBQ2xCLE1BQU0sdUJBQXVCO0VBQy9CO0VBQ0EsT0FBT2UsR0FBRyxDQUFDbEIsUUFBUSxDQUFDVixRQUFRLEVBQUcsR0FBRW9ELFdBQVksSUFBR2hELFNBQVUsRUFBQyxFQUFFUyxhQUFhLENBQUM7QUFDN0U7QUFFTyxlQUFld0MsVUFBVUEsQ0FBQ0MsT0FBTyxFQUFFakQsSUFBSSxFQUFFa0QsT0FBTyxFQUFFQyxJQUFJLEVBQUU7RUFDN0QsSUFBSSxDQUFDRixPQUFPLEVBQUU7SUFDWjtFQUNGO0VBQ0EsTUFBTUcsaUJBQWlCLENBQUNGLE9BQU8sRUFBRWxELElBQUksRUFBRW1ELElBQUksQ0FBQztFQUM1QyxJQUFJRCxPQUFPLENBQUNHLGlCQUFpQixFQUFFO0lBQzdCO0VBQ0Y7RUFDQSxPQUFPLE1BQU1KLE9BQU8sQ0FBQ0MsT0FBTyxDQUFDO0FBQy9CO0FBRU8sU0FBU0ksYUFBYUEsQ0FBQ3ZELFNBQWlCLEVBQUVJLElBQVksRUFBRUssYUFBcUIsRUFBVztFQUM3RixPQUFPc0MsVUFBVSxDQUFDL0MsU0FBUyxFQUFFSSxJQUFJLEVBQUVLLGFBQWEsQ0FBQyxJQUFJeEMsU0FBUztBQUNoRTtBQUVPLFNBQVN1RixXQUFXQSxDQUFDOUIsWUFBWSxFQUFFakIsYUFBYSxFQUFFO0VBQ3ZELE9BQU9lLEdBQUcsQ0FBQ2xCLFFBQVEsQ0FBQ2IsU0FBUyxFQUFFaUMsWUFBWSxFQUFFakIsYUFBYSxDQUFDO0FBQzdEO0FBRU8sU0FBU2dELGdCQUFnQkEsQ0FBQ2hELGFBQWEsRUFBRTtFQUM5QyxNQUFNTyxLQUFLLEdBQ1JYLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLElBQUlKLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLENBQUNILFFBQVEsQ0FBQ2IsU0FBUyxDQUFDLElBQUssQ0FBQyxDQUFDO0VBQzFGLE1BQU1pRSxhQUFhLEdBQUcsRUFBRTtFQUN4QixNQUFNQyxvQkFBb0IsR0FBR0EsQ0FBQ0MsU0FBUyxFQUFFNUMsS0FBSyxLQUFLO0lBQ2pEaEYsTUFBTSxDQUFDRCxJQUFJLENBQUNpRixLQUFLLENBQUMsQ0FBQ2pFLE9BQU8sQ0FBQ2tELElBQUksSUFBSTtNQUNqQyxNQUFNNUMsS0FBSyxHQUFHMkQsS0FBSyxDQUFDZixJQUFJLENBQUM7TUFDekIsSUFBSTJELFNBQVMsRUFBRTtRQUNiM0QsSUFBSSxHQUFJLEdBQUUyRCxTQUFVLElBQUczRCxJQUFLLEVBQUM7TUFDL0I7TUFDQSxJQUFJLE9BQU81QyxLQUFLLEtBQUssVUFBVSxFQUFFO1FBQy9CcUcsYUFBYSxDQUFDbkgsSUFBSSxDQUFDMEQsSUFBSSxDQUFDO01BQzFCLENBQUMsTUFBTTtRQUNMMEQsb0JBQW9CLENBQUMxRCxJQUFJLEVBQUU1QyxLQUFLLENBQUM7TUFDbkM7SUFDRixDQUFDLENBQUM7RUFDSixDQUFDO0VBQ0RzRyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUzQyxLQUFLLENBQUM7RUFDakMsT0FBTzBDLGFBQWE7QUFDdEI7QUFFTyxTQUFTRyxNQUFNQSxDQUFDaEMsT0FBTyxFQUFFcEIsYUFBYSxFQUFFO0VBQzdDLE9BQU9lLEdBQUcsQ0FBQ2xCLFFBQVEsQ0FBQ1osSUFBSSxFQUFFbUMsT0FBTyxFQUFFcEIsYUFBYSxDQUFDO0FBQ25EO0FBRU8sU0FBU3FELE9BQU9BLENBQUNyRCxhQUFhLEVBQUU7RUFDckMsSUFBSXNELE9BQU8sR0FBRzFELGFBQWEsQ0FBQ0ksYUFBYSxDQUFDO0VBQzFDLElBQUlzRCxPQUFPLElBQUlBLE9BQU8sQ0FBQ3JFLElBQUksRUFBRTtJQUMzQixPQUFPcUUsT0FBTyxDQUFDckUsSUFBSTtFQUNyQjtFQUNBLE9BQU96QixTQUFTO0FBQ2xCO0FBRU8sU0FBUytGLFlBQVlBLENBQUN0QyxZQUFZLEVBQUVqQixhQUFhLEVBQUU7RUFDeEQsT0FBT2UsR0FBRyxDQUFDbEIsUUFBUSxDQUFDaEIsVUFBVSxFQUFFb0MsWUFBWSxFQUFFakIsYUFBYSxDQUFDO0FBQzlEO0FBRU8sU0FBU3dELGdCQUFnQkEsQ0FDOUJqQixXQUFXLEVBQ1hJLElBQUksRUFDSmMsV0FBVyxFQUNYQyxtQkFBbUIsRUFDbkJDLE1BQU0sRUFDTkMsT0FBTyxFQUNQO0VBQ0EsTUFBTWxCLE9BQU8sR0FBRztJQUNkbUIsV0FBVyxFQUFFdEIsV0FBVztJQUN4Qm5ILE1BQU0sRUFBRXFJLFdBQVc7SUFDbkJLLE1BQU0sRUFBRSxLQUFLO0lBQ2JDLEdBQUcsRUFBRUosTUFBTSxDQUFDSyxnQkFBZ0I7SUFDNUJDLE9BQU8sRUFBRU4sTUFBTSxDQUFDTSxPQUFPO0lBQ3ZCQyxFQUFFLEVBQUVQLE1BQU0sQ0FBQ087RUFDYixDQUFDO0VBRUQsSUFBSVIsbUJBQW1CLEVBQUU7SUFDdkJoQixPQUFPLENBQUN5QixRQUFRLEdBQUdULG1CQUFtQjtFQUN4QztFQUNBLElBQ0VuQixXQUFXLEtBQUsxRSxLQUFLLENBQUNJLFVBQVUsSUFDaENzRSxXQUFXLEtBQUsxRSxLQUFLLENBQUNLLFNBQVMsSUFDL0JxRSxXQUFXLEtBQUsxRSxLQUFLLENBQUNNLFlBQVksSUFDbENvRSxXQUFXLEtBQUsxRSxLQUFLLENBQUNPLFdBQVcsSUFDakNtRSxXQUFXLEtBQUsxRSxLQUFLLENBQUNDLFdBQVcsSUFDakN5RSxXQUFXLEtBQUsxRSxLQUFLLENBQUNFLFVBQVUsSUFDaEN3RSxXQUFXLEtBQUsxRSxLQUFLLENBQUNTLFNBQVMsRUFDL0I7SUFDQTtJQUNBb0UsT0FBTyxDQUFDa0IsT0FBTyxHQUFHckksTUFBTSxDQUFDNkksTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFUixPQUFPLENBQUM7RUFDOUM7RUFFQSxJQUFJLENBQUNqQixJQUFJLEVBQUU7SUFDVCxPQUFPRCxPQUFPO0VBQ2hCO0VBQ0EsSUFBSUMsSUFBSSxDQUFDMEIsUUFBUSxFQUFFO0lBQ2pCM0IsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUk7RUFDMUI7RUFDQSxJQUFJQyxJQUFJLENBQUMyQixJQUFJLEVBQUU7SUFDYjVCLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBR0MsSUFBSSxDQUFDMkIsSUFBSTtFQUM3QjtFQUNBLElBQUkzQixJQUFJLENBQUM0QixjQUFjLEVBQUU7SUFDdkI3QixPQUFPLENBQUMsZ0JBQWdCLENBQUMsR0FBR0MsSUFBSSxDQUFDNEIsY0FBYztFQUNqRDtFQUNBLE9BQU83QixPQUFPO0FBQ2hCO0FBRU8sU0FBUzhCLHFCQUFxQkEsQ0FBQ2pDLFdBQVcsRUFBRUksSUFBSSxFQUFFOEIsS0FBSyxFQUFFQyxLQUFLLEVBQUVmLE1BQU0sRUFBRUMsT0FBTyxFQUFFZSxLQUFLLEVBQUU7RUFDN0ZBLEtBQUssR0FBRyxDQUFDLENBQUNBLEtBQUs7RUFFZixJQUFJakMsT0FBTyxHQUFHO0lBQ1ptQixXQUFXLEVBQUV0QixXQUFXO0lBQ3hCa0MsS0FBSztJQUNMWCxNQUFNLEVBQUUsS0FBSztJQUNiWSxLQUFLO0lBQ0xYLEdBQUcsRUFBRUosTUFBTSxDQUFDSyxnQkFBZ0I7SUFDNUJXLEtBQUs7SUFDTFYsT0FBTyxFQUFFTixNQUFNLENBQUNNLE9BQU87SUFDdkJDLEVBQUUsRUFBRVAsTUFBTSxDQUFDTyxFQUFFO0lBQ2JOLE9BQU8sRUFBRUEsT0FBTyxJQUFJLENBQUM7RUFDdkIsQ0FBQztFQUVELElBQUksQ0FBQ2pCLElBQUksRUFBRTtJQUNULE9BQU9ELE9BQU87RUFDaEI7RUFDQSxJQUFJQyxJQUFJLENBQUMwQixRQUFRLEVBQUU7SUFDakIzQixPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSTtFQUMxQjtFQUNBLElBQUlDLElBQUksQ0FBQzJCLElBQUksRUFBRTtJQUNiNUIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHQyxJQUFJLENBQUMyQixJQUFJO0VBQzdCO0VBQ0EsSUFBSTNCLElBQUksQ0FBQzRCLGNBQWMsRUFBRTtJQUN2QjdCLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHQyxJQUFJLENBQUM0QixjQUFjO0VBQ2pEO0VBQ0EsT0FBTzdCLE9BQU87QUFDaEI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDTyxTQUFTa0MsaUJBQWlCQSxDQUFDbEMsT0FBTyxFQUFFbUMsT0FBTyxFQUFFQyxNQUFNLEVBQUU7RUFDMUQsT0FBTztJQUNMQyxPQUFPLEVBQUUsU0FBQUEsQ0FBVUMsUUFBUSxFQUFFO01BQzNCLElBQUl0QyxPQUFPLENBQUNtQixXQUFXLEtBQUtoRyxLQUFLLENBQUNTLFNBQVMsRUFBRTtRQUMzQyxJQUFJLENBQUMwRyxRQUFRLEVBQUU7VUFDYkEsUUFBUSxHQUFHdEMsT0FBTyxDQUFDdUMsT0FBTztRQUM1QjtRQUNBRCxRQUFRLEdBQUdBLFFBQVEsQ0FBQ0UsR0FBRyxDQUFDOUosTUFBTSxJQUFJO1VBQ2hDLE9BQU93RyxpQkFBaUIsQ0FBQ3hHLE1BQU0sQ0FBQztRQUNsQyxDQUFDLENBQUM7UUFDRixPQUFPeUosT0FBTyxDQUFDRyxRQUFRLENBQUM7TUFDMUI7TUFDQTtNQUNBLElBQ0VBLFFBQVEsSUFDUixPQUFPQSxRQUFRLEtBQUssUUFBUSxJQUM1QixDQUFDdEMsT0FBTyxDQUFDdEgsTUFBTSxDQUFDK0osTUFBTSxDQUFDSCxRQUFRLENBQUMsSUFDaEN0QyxPQUFPLENBQUNtQixXQUFXLEtBQUtoRyxLQUFLLENBQUNJLFVBQVUsRUFDeEM7UUFDQSxPQUFPNEcsT0FBTyxDQUFDRyxRQUFRLENBQUM7TUFDMUI7TUFDQSxJQUFJQSxRQUFRLElBQUksT0FBT0EsUUFBUSxLQUFLLFFBQVEsSUFBSXRDLE9BQU8sQ0FBQ21CLFdBQVcsS0FBS2hHLEtBQUssQ0FBQ0ssU0FBUyxFQUFFO1FBQ3ZGLE9BQU8yRyxPQUFPLENBQUNHLFFBQVEsQ0FBQztNQUMxQjtNQUNBLElBQUl0QyxPQUFPLENBQUNtQixXQUFXLEtBQUtoRyxLQUFLLENBQUNLLFNBQVMsRUFBRTtRQUMzQyxPQUFPMkcsT0FBTyxDQUFDLENBQUM7TUFDbEI7TUFDQUcsUUFBUSxHQUFHLENBQUMsQ0FBQztNQUNiLElBQUl0QyxPQUFPLENBQUNtQixXQUFXLEtBQUtoRyxLQUFLLENBQUNJLFVBQVUsRUFBRTtRQUM1QytHLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBR3RDLE9BQU8sQ0FBQ3RILE1BQU0sQ0FBQ2dLLFlBQVksQ0FBQyxDQUFDO1FBQ2xESixRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUd0QyxPQUFPLENBQUN0SCxNQUFNLENBQUNpSyxFQUFFO01BQ3BEO01BQ0EsT0FBT1IsT0FBTyxDQUFDRyxRQUFRLENBQUM7SUFDMUIsQ0FBQztJQUNETSxLQUFLLEVBQUUsU0FBQUEsQ0FBVUEsS0FBSyxFQUFFO01BQ3RCLE1BQU1DLENBQUMsR0FBR0MsWUFBWSxDQUFDRixLQUFLLEVBQUU7UUFDNUJHLElBQUksRUFBRW5GLGFBQUssQ0FBQ29GLEtBQUssQ0FBQ0MsYUFBYTtRQUMvQkMsT0FBTyxFQUFFO01BQ1gsQ0FBQyxDQUFDO01BQ0ZkLE1BQU0sQ0FBQ1MsQ0FBQyxDQUFDO0lBQ1g7RUFDRixDQUFDO0FBQ0g7QUFFQSxTQUFTTSxZQUFZQSxDQUFDbEQsSUFBSSxFQUFFO0VBQzFCLE9BQU9BLElBQUksSUFBSUEsSUFBSSxDQUFDMkIsSUFBSSxHQUFHM0IsSUFBSSxDQUFDMkIsSUFBSSxDQUFDZSxFQUFFLEdBQUc3SCxTQUFTO0FBQ3JEO0FBRUEsU0FBU3NJLG1CQUFtQkEsQ0FBQ3ZELFdBQVcsRUFBRWhELFNBQVMsRUFBRXBDLEtBQUssRUFBRXdGLElBQUksRUFBRW9ELFFBQVEsRUFBRTtFQUMxRSxNQUFNQyxVQUFVLEdBQUdwRixjQUFNLENBQUNxRixrQkFBa0IsQ0FBQ0MsSUFBSSxDQUFDQyxTQUFTLENBQUNoSixLQUFLLENBQUMsQ0FBQztFQUNuRXlELGNBQU0sQ0FBQ21GLFFBQVEsQ0FBQyxDQUNiLEdBQUV4RCxXQUFZLGtCQUFpQmhELFNBQVUsYUFBWXNHLFlBQVksQ0FDaEVsRCxJQUNGLENBQUUsZUFBY3FELFVBQVcsRUFBQyxFQUM1QjtJQUNFekcsU0FBUztJQUNUZ0QsV0FBVztJQUNYK0IsSUFBSSxFQUFFdUIsWUFBWSxDQUFDbEQsSUFBSTtFQUN6QixDQUNGLENBQUM7QUFDSDtBQUVBLFNBQVN5RCwyQkFBMkJBLENBQUM3RCxXQUFXLEVBQUVoRCxTQUFTLEVBQUVwQyxLQUFLLEVBQUVrSixNQUFNLEVBQUUxRCxJQUFJLEVBQUVvRCxRQUFRLEVBQUU7RUFDMUYsTUFBTUMsVUFBVSxHQUFHcEYsY0FBTSxDQUFDcUYsa0JBQWtCLENBQUNDLElBQUksQ0FBQ0MsU0FBUyxDQUFDaEosS0FBSyxDQUFDLENBQUM7RUFDbkUsTUFBTW1KLFdBQVcsR0FBRzFGLGNBQU0sQ0FBQ3FGLGtCQUFrQixDQUFDQyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0UsTUFBTSxDQUFDLENBQUM7RUFDckV6RixjQUFNLENBQUNtRixRQUFRLENBQUMsQ0FDYixHQUFFeEQsV0FBWSxrQkFBaUJoRCxTQUFVLGFBQVlzRyxZQUFZLENBQ2hFbEQsSUFDRixDQUFFLGVBQWNxRCxVQUFXLGVBQWNNLFdBQVksRUFBQyxFQUN0RDtJQUNFL0csU0FBUztJQUNUZ0QsV0FBVztJQUNYK0IsSUFBSSxFQUFFdUIsWUFBWSxDQUFDbEQsSUFBSTtFQUN6QixDQUNGLENBQUM7QUFDSDtBQUVBLFNBQVM0RCx5QkFBeUJBLENBQUNoRSxXQUFXLEVBQUVoRCxTQUFTLEVBQUVwQyxLQUFLLEVBQUV3RixJQUFJLEVBQUUyQyxLQUFLLEVBQUVTLFFBQVEsRUFBRTtFQUN2RixNQUFNQyxVQUFVLEdBQUdwRixjQUFNLENBQUNxRixrQkFBa0IsQ0FBQ0MsSUFBSSxDQUFDQyxTQUFTLENBQUNoSixLQUFLLENBQUMsQ0FBQztFQUNuRXlELGNBQU0sQ0FBQ21GLFFBQVEsQ0FBQyxDQUNiLEdBQUV4RCxXQUFZLGVBQWNoRCxTQUFVLGFBQVlzRyxZQUFZLENBQzdEbEQsSUFDRixDQUFFLGVBQWNxRCxVQUFXLGNBQWFFLElBQUksQ0FBQ0MsU0FBUyxDQUFDYixLQUFLLENBQUUsRUFBQyxFQUMvRDtJQUNFL0YsU0FBUztJQUNUZ0QsV0FBVztJQUNYK0MsS0FBSztJQUNMaEIsSUFBSSxFQUFFdUIsWUFBWSxDQUFDbEQsSUFBSTtFQUN6QixDQUNGLENBQUM7QUFDSDtBQUVPLFNBQVM2RCx3QkFBd0JBLENBQ3RDakUsV0FBVyxFQUNYSSxJQUFJLEVBQ0pwRCxTQUFTLEVBQ1QwRixPQUFPLEVBQ1B0QixNQUFNLEVBQ05jLEtBQUssRUFDTGIsT0FBTyxFQUNQO0VBQ0EsT0FBTyxJQUFJNkMsT0FBTyxDQUFDLENBQUM1QixPQUFPLEVBQUVDLE1BQU0sS0FBSztJQUN0QyxNQUFNckMsT0FBTyxHQUFHSCxVQUFVLENBQUMvQyxTQUFTLEVBQUVnRCxXQUFXLEVBQUVvQixNQUFNLENBQUMzRCxhQUFhLENBQUM7SUFDeEUsSUFBSSxDQUFDeUMsT0FBTyxFQUFFO01BQ1osT0FBT29DLE9BQU8sQ0FBQyxDQUFDO0lBQ2xCO0lBQ0EsTUFBTW5DLE9BQU8sR0FBR2MsZ0JBQWdCLENBQUNqQixXQUFXLEVBQUVJLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFZ0IsTUFBTSxFQUFFQyxPQUFPLENBQUM7SUFDaEYsSUFBSWEsS0FBSyxFQUFFO01BQ1QvQixPQUFPLENBQUMrQixLQUFLLEdBQUdBLEtBQUs7SUFDdkI7SUFDQSxNQUFNO01BQUVNLE9BQU87TUFBRU87SUFBTSxDQUFDLEdBQUdWLGlCQUFpQixDQUMxQ2xDLE9BQU8sRUFDUHRILE1BQU0sSUFBSTtNQUNSeUosT0FBTyxDQUFDekosTUFBTSxDQUFDO0lBQ2pCLENBQUMsRUFDRGtLLEtBQUssSUFBSTtNQUNQUixNQUFNLENBQUNRLEtBQUssQ0FBQztJQUNmLENBQ0YsQ0FBQztJQUNEYywyQkFBMkIsQ0FDekI3RCxXQUFXLEVBQ1hoRCxTQUFTLEVBQ1QsV0FBVyxFQUNYMkcsSUFBSSxDQUFDQyxTQUFTLENBQUNsQixPQUFPLENBQUMsRUFDdkJ0QyxJQUFJLEVBQ0pnQixNQUFNLENBQUMrQyxTQUFTLENBQUNDLG9CQUNuQixDQUFDO0lBQ0RqRSxPQUFPLENBQUN1QyxPQUFPLEdBQUdBLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDOUosTUFBTSxJQUFJO01BQ3RDO01BQ0FBLE1BQU0sQ0FBQ21FLFNBQVMsR0FBR0EsU0FBUztNQUM1QixPQUFPZSxhQUFLLENBQUMvRSxNQUFNLENBQUNxTCxRQUFRLENBQUN4TCxNQUFNLENBQUM7SUFDdEMsQ0FBQyxDQUFDO0lBQ0YsT0FBT3FMLE9BQU8sQ0FBQzVCLE9BQU8sQ0FBQyxDQUFDLENBQ3JCZ0MsSUFBSSxDQUFDLE1BQU07TUFDVixPQUFPakUsaUJBQWlCLENBQUNGLE9BQU8sRUFBRyxHQUFFSCxXQUFZLElBQUdoRCxTQUFVLEVBQUMsRUFBRW9ELElBQUksQ0FBQztJQUN4RSxDQUFDLENBQUMsQ0FDRGtFLElBQUksQ0FBQyxNQUFNO01BQ1YsSUFBSW5FLE9BQU8sQ0FBQ0csaUJBQWlCLEVBQUU7UUFDN0IsT0FBT0gsT0FBTyxDQUFDdUMsT0FBTztNQUN4QjtNQUNBLE1BQU1ELFFBQVEsR0FBR3ZDLE9BQU8sQ0FBQ0MsT0FBTyxDQUFDO01BQ2pDLElBQUlzQyxRQUFRLElBQUksT0FBT0EsUUFBUSxDQUFDNkIsSUFBSSxLQUFLLFVBQVUsRUFBRTtRQUNuRCxPQUFPN0IsUUFBUSxDQUFDNkIsSUFBSSxDQUFDQyxPQUFPLElBQUk7VUFDOUIsT0FBT0EsT0FBTztRQUNoQixDQUFDLENBQUM7TUFDSjtNQUNBLE9BQU85QixRQUFRO0lBQ2pCLENBQUMsQ0FBQyxDQUNENkIsSUFBSSxDQUFDOUIsT0FBTyxFQUFFTyxLQUFLLENBQUM7RUFDekIsQ0FBQyxDQUFDLENBQUN1QixJQUFJLENBQUNDLE9BQU8sSUFBSTtJQUNqQmhCLG1CQUFtQixDQUNqQnZELFdBQVcsRUFDWGhELFNBQVMsRUFDVDJHLElBQUksQ0FBQ0MsU0FBUyxDQUFDVyxPQUFPLENBQUMsRUFDdkJuRSxJQUFJLEVBQ0pnQixNQUFNLENBQUMrQyxTQUFTLENBQUNLLFlBQ25CLENBQUM7SUFDRCxPQUFPRCxPQUFPO0VBQ2hCLENBQUMsQ0FBQztBQUNKO0FBRU8sU0FBU0Usb0JBQW9CQSxDQUNsQ3pFLFdBQVcsRUFDWGhELFNBQVMsRUFDVDBILFNBQVMsRUFDVEMsV0FBVyxFQUNYdkQsTUFBTSxFQUNOaEIsSUFBSSxFQUNKaUIsT0FBTyxFQUNQZSxLQUFLLEVBQ0w7RUFDQSxNQUFNbEMsT0FBTyxHQUFHSCxVQUFVLENBQUMvQyxTQUFTLEVBQUVnRCxXQUFXLEVBQUVvQixNQUFNLENBQUMzRCxhQUFhLENBQUM7RUFDeEUsSUFBSSxDQUFDeUMsT0FBTyxFQUFFO0lBQ1osT0FBT2dFLE9BQU8sQ0FBQzVCLE9BQU8sQ0FBQztNQUNyQm9DLFNBQVM7TUFDVEM7SUFDRixDQUFDLENBQUM7RUFDSjtFQUNBLE1BQU1DLElBQUksR0FBRzVMLE1BQU0sQ0FBQzZJLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRThDLFdBQVcsQ0FBQztFQUMzQ0MsSUFBSSxDQUFDQyxLQUFLLEdBQUdILFNBQVM7RUFFdEIsTUFBTUksVUFBVSxHQUFHLElBQUkvRyxhQUFLLENBQUNnSCxLQUFLLENBQUMvSCxTQUFTLENBQUM7RUFDN0M4SCxVQUFVLENBQUNFLFFBQVEsQ0FBQ0osSUFBSSxDQUFDO0VBRXpCLElBQUl6QyxLQUFLLEdBQUcsS0FBSztFQUNqQixJQUFJd0MsV0FBVyxFQUFFO0lBQ2Z4QyxLQUFLLEdBQUcsQ0FBQyxDQUFDd0MsV0FBVyxDQUFDeEMsS0FBSztFQUM3QjtFQUNBLE1BQU04QyxhQUFhLEdBQUdoRCxxQkFBcUIsQ0FDekNqQyxXQUFXLEVBQ1hJLElBQUksRUFDSjBFLFVBQVUsRUFDVjNDLEtBQUssRUFDTGYsTUFBTSxFQUNOQyxPQUFPLEVBQ1BlLEtBQ0YsQ0FBQztFQUNELE9BQU84QixPQUFPLENBQUM1QixPQUFPLENBQUMsQ0FBQyxDQUNyQmdDLElBQUksQ0FBQyxNQUFNO0lBQ1YsT0FBT2pFLGlCQUFpQixDQUFDNEUsYUFBYSxFQUFHLEdBQUVqRixXQUFZLElBQUdoRCxTQUFVLEVBQUMsRUFBRW9ELElBQUksQ0FBQztFQUM5RSxDQUFDLENBQUMsQ0FDRGtFLElBQUksQ0FBQyxNQUFNO0lBQ1YsSUFBSVcsYUFBYSxDQUFDM0UsaUJBQWlCLEVBQUU7TUFDbkMsT0FBTzJFLGFBQWEsQ0FBQy9DLEtBQUs7SUFDNUI7SUFDQSxPQUFPaEMsT0FBTyxDQUFDK0UsYUFBYSxDQUFDO0VBQy9CLENBQUMsQ0FBQyxDQUNEWCxJQUFJLENBQ0hSLE1BQU0sSUFBSTtJQUNSLElBQUlvQixXQUFXLEdBQUdKLFVBQVU7SUFDNUIsSUFBSWhCLE1BQU0sSUFBSUEsTUFBTSxZQUFZL0YsYUFBSyxDQUFDZ0gsS0FBSyxFQUFFO01BQzNDRyxXQUFXLEdBQUdwQixNQUFNO0lBQ3RCO0lBQ0EsTUFBTXFCLFNBQVMsR0FBR0QsV0FBVyxDQUFDNUYsTUFBTSxDQUFDLENBQUM7SUFDdEMsSUFBSTZGLFNBQVMsQ0FBQ04sS0FBSyxFQUFFO01BQ25CSCxTQUFTLEdBQUdTLFNBQVMsQ0FBQ04sS0FBSztJQUM3QjtJQUNBLElBQUlNLFNBQVMsQ0FBQ0MsS0FBSyxFQUFFO01BQ25CVCxXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQ1MsS0FBSyxHQUFHRCxTQUFTLENBQUNDLEtBQUs7SUFDckM7SUFDQSxJQUFJRCxTQUFTLENBQUNFLElBQUksRUFBRTtNQUNsQlYsV0FBVyxHQUFHQSxXQUFXLElBQUksQ0FBQyxDQUFDO01BQy9CQSxXQUFXLENBQUNVLElBQUksR0FBR0YsU0FBUyxDQUFDRSxJQUFJO0lBQ25DO0lBQ0EsSUFBSUYsU0FBUyxDQUFDRyxPQUFPLEVBQUU7TUFDckJYLFdBQVcsR0FBR0EsV0FBVyxJQUFJLENBQUMsQ0FBQztNQUMvQkEsV0FBVyxDQUFDVyxPQUFPLEdBQUdILFNBQVMsQ0FBQ0csT0FBTztJQUN6QztJQUNBLElBQUlILFNBQVMsQ0FBQ0ksV0FBVyxFQUFFO01BQ3pCWixXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQ1ksV0FBVyxHQUFHSixTQUFTLENBQUNJLFdBQVc7SUFDakQ7SUFDQSxJQUFJSixTQUFTLENBQUNLLE9BQU8sRUFBRTtNQUNyQmIsV0FBVyxHQUFHQSxXQUFXLElBQUksQ0FBQyxDQUFDO01BQy9CQSxXQUFXLENBQUNhLE9BQU8sR0FBR0wsU0FBUyxDQUFDSyxPQUFPO0lBQ3pDO0lBQ0EsSUFBSUwsU0FBUyxDQUFDcE0sSUFBSSxFQUFFO01BQ2xCNEwsV0FBVyxHQUFHQSxXQUFXLElBQUksQ0FBQyxDQUFDO01BQy9CQSxXQUFXLENBQUM1TCxJQUFJLEdBQUdvTSxTQUFTLENBQUNwTSxJQUFJO0lBQ25DO0lBQ0EsSUFBSW9NLFNBQVMsQ0FBQ00sS0FBSyxFQUFFO01BQ25CZCxXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQ2MsS0FBSyxHQUFHTixTQUFTLENBQUNNLEtBQUs7SUFDckM7SUFDQSxJQUFJTixTQUFTLENBQUN0SyxJQUFJLEVBQUU7TUFDbEI4SixXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQzlKLElBQUksR0FBR3NLLFNBQVMsQ0FBQ3RLLElBQUk7SUFDbkM7SUFDQSxJQUFJb0ssYUFBYSxDQUFDUyxjQUFjLEVBQUU7TUFDaENmLFdBQVcsR0FBR0EsV0FBVyxJQUFJLENBQUMsQ0FBQztNQUMvQkEsV0FBVyxDQUFDZSxjQUFjLEdBQUdULGFBQWEsQ0FBQ1MsY0FBYztJQUMzRDtJQUNBLElBQUlULGFBQWEsQ0FBQ1UscUJBQXFCLEVBQUU7TUFDdkNoQixXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQ2dCLHFCQUFxQixHQUFHVixhQUFhLENBQUNVLHFCQUFxQjtJQUN6RTtJQUNBLElBQUlWLGFBQWEsQ0FBQ1csc0JBQXNCLEVBQUU7TUFDeENqQixXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQ2lCLHNCQUFzQixHQUFHWCxhQUFhLENBQUNXLHNCQUFzQjtJQUMzRTtJQUNBLE9BQU87TUFDTGxCLFNBQVM7TUFDVEM7SUFDRixDQUFDO0VBQ0gsQ0FBQyxFQUNEa0IsR0FBRyxJQUFJO0lBQ0wsTUFBTTlDLEtBQUssR0FBR0UsWUFBWSxDQUFDNEMsR0FBRyxFQUFFO01BQzlCM0MsSUFBSSxFQUFFbkYsYUFBSyxDQUFDb0YsS0FBSyxDQUFDQyxhQUFhO01BQy9CQyxPQUFPLEVBQUU7SUFDWCxDQUFDLENBQUM7SUFDRixNQUFNTixLQUFLO0VBQ2IsQ0FDRixDQUFDO0FBQ0w7QUFFTyxTQUFTRSxZQUFZQSxDQUFDSSxPQUFPLEVBQUV5QyxXQUFXLEVBQUU7RUFDakQsSUFBSSxDQUFDQSxXQUFXLEVBQUU7SUFDaEJBLFdBQVcsR0FBRyxDQUFDLENBQUM7RUFDbEI7RUFDQSxJQUFJLENBQUN6QyxPQUFPLEVBQUU7SUFDWixPQUFPLElBQUl0RixhQUFLLENBQUNvRixLQUFLLENBQ3BCMkMsV0FBVyxDQUFDNUMsSUFBSSxJQUFJbkYsYUFBSyxDQUFDb0YsS0FBSyxDQUFDQyxhQUFhLEVBQzdDMEMsV0FBVyxDQUFDekMsT0FBTyxJQUFJLGdCQUN6QixDQUFDO0VBQ0g7RUFDQSxJQUFJQSxPQUFPLFlBQVl0RixhQUFLLENBQUNvRixLQUFLLEVBQUU7SUFDbEMsT0FBT0UsT0FBTztFQUNoQjtFQUVBLE1BQU1ILElBQUksR0FBRzRDLFdBQVcsQ0FBQzVDLElBQUksSUFBSW5GLGFBQUssQ0FBQ29GLEtBQUssQ0FBQ0MsYUFBYTtFQUMxRDtFQUNBLElBQUksT0FBT0MsT0FBTyxLQUFLLFFBQVEsRUFBRTtJQUMvQixPQUFPLElBQUl0RixhQUFLLENBQUNvRixLQUFLLENBQUNELElBQUksRUFBRUcsT0FBTyxDQUFDO0VBQ3ZDO0VBQ0EsTUFBTU4sS0FBSyxHQUFHLElBQUloRixhQUFLLENBQUNvRixLQUFLLENBQUNELElBQUksRUFBRUcsT0FBTyxDQUFDQSxPQUFPLElBQUlBLE9BQU8sQ0FBQztFQUMvRCxJQUFJQSxPQUFPLFlBQVlGLEtBQUssRUFBRTtJQUM1QkosS0FBSyxDQUFDZ0QsS0FBSyxHQUFHMUMsT0FBTyxDQUFDMEMsS0FBSztFQUM3QjtFQUNBLE9BQU9oRCxLQUFLO0FBQ2Q7QUFDTyxTQUFTMUMsaUJBQWlCQSxDQUFDRixPQUFPLEVBQUV6QixZQUFZLEVBQUUwQixJQUFJLEVBQUU7RUFDN0QsTUFBTTRGLFlBQVksR0FBR2hGLFlBQVksQ0FBQ3RDLFlBQVksRUFBRVgsYUFBSyxDQUFDTixhQUFhLENBQUM7RUFDcEUsSUFBSSxDQUFDdUksWUFBWSxFQUFFO0lBQ2pCO0VBQ0Y7RUFDQSxJQUFJLE9BQU9BLFlBQVksS0FBSyxRQUFRLElBQUlBLFlBQVksQ0FBQzFGLGlCQUFpQixJQUFJSCxPQUFPLENBQUNvQixNQUFNLEVBQUU7SUFDeEZwQixPQUFPLENBQUNHLGlCQUFpQixHQUFHLElBQUk7RUFDbEM7RUFDQSxPQUFPLElBQUk0RCxPQUFPLENBQUMsQ0FBQzVCLE9BQU8sRUFBRUMsTUFBTSxLQUFLO0lBQ3RDLE9BQU8yQixPQUFPLENBQUM1QixPQUFPLENBQUMsQ0FBQyxDQUNyQmdDLElBQUksQ0FBQyxNQUFNO01BQ1YsT0FBTyxPQUFPMEIsWUFBWSxLQUFLLFFBQVEsR0FDbkNDLHVCQUF1QixDQUFDRCxZQUFZLEVBQUU3RixPQUFPLEVBQUVDLElBQUksQ0FBQyxHQUNwRDRGLFlBQVksQ0FBQzdGLE9BQU8sQ0FBQztJQUMzQixDQUFDLENBQUMsQ0FDRG1FLElBQUksQ0FBQyxNQUFNO01BQ1ZoQyxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUMsQ0FBQyxDQUNENEQsS0FBSyxDQUFDbEQsQ0FBQyxJQUFJO01BQ1YsTUFBTUQsS0FBSyxHQUFHRSxZQUFZLENBQUNELENBQUMsRUFBRTtRQUM1QkUsSUFBSSxFQUFFbkYsYUFBSyxDQUFDb0YsS0FBSyxDQUFDZ0QsZ0JBQWdCO1FBQ2xDOUMsT0FBTyxFQUFFO01BQ1gsQ0FBQyxDQUFDO01BQ0ZkLE1BQU0sQ0FBQ1EsS0FBSyxDQUFDO0lBQ2YsQ0FBQyxDQUFDO0VBQ04sQ0FBQyxDQUFDO0FBQ0o7QUFDQSxlQUFla0QsdUJBQXVCQSxDQUFDRyxPQUFPLEVBQUVqRyxPQUFPLEVBQUVDLElBQUksRUFBRTtFQUM3RCxJQUFJRCxPQUFPLENBQUNvQixNQUFNLElBQUksQ0FBQzZFLE9BQU8sQ0FBQ0MsaUJBQWlCLEVBQUU7SUFDaEQ7RUFDRjtFQUNBLElBQUlDLE9BQU8sR0FBR25HLE9BQU8sQ0FBQzRCLElBQUk7RUFDMUIsSUFDRSxDQUFDdUUsT0FBTyxJQUNSbkcsT0FBTyxDQUFDdEgsTUFBTSxJQUNkc0gsT0FBTyxDQUFDdEgsTUFBTSxDQUFDbUUsU0FBUyxLQUFLLE9BQU8sSUFDcEMsQ0FBQ21ELE9BQU8sQ0FBQ3RILE1BQU0sQ0FBQzBOLE9BQU8sQ0FBQyxDQUFDLEVBQ3pCO0lBQ0FELE9BQU8sR0FBR25HLE9BQU8sQ0FBQ3RILE1BQU07RUFDMUI7RUFDQSxJQUNFLENBQUN1TixPQUFPLENBQUNJLFdBQVcsSUFBSUosT0FBTyxDQUFDSyxtQkFBbUIsSUFBSUwsT0FBTyxDQUFDTSxtQkFBbUIsS0FDbEYsQ0FBQ0osT0FBTyxFQUNSO0lBQ0EsTUFBTSw4Q0FBOEM7RUFDdEQ7RUFDQSxJQUFJRixPQUFPLENBQUNPLGFBQWEsSUFBSSxDQUFDeEcsT0FBTyxDQUFDb0IsTUFBTSxFQUFFO0lBQzVDLE1BQU0scUVBQXFFO0VBQzdFO0VBQ0EsSUFBSXFGLE1BQU0sR0FBR3pHLE9BQU8sQ0FBQ3lHLE1BQU0sSUFBSSxDQUFDLENBQUM7RUFDakMsSUFBSXpHLE9BQU8sQ0FBQ3RILE1BQU0sRUFBRTtJQUNsQitOLE1BQU0sR0FBR3pHLE9BQU8sQ0FBQ3RILE1BQU0sQ0FBQ3lHLE1BQU0sQ0FBQyxDQUFDO0VBQ2xDO0VBQ0EsTUFBTXVILGFBQWEsR0FBRzdNLEdBQUcsSUFBSTtJQUMzQixNQUFNSyxLQUFLLEdBQUd1TSxNQUFNLENBQUM1TSxHQUFHLENBQUM7SUFDekIsSUFBSUssS0FBSyxJQUFJLElBQUksRUFBRTtNQUNqQixNQUFPLDhDQUE2Q0wsR0FBSSxHQUFFO0lBQzVEO0VBQ0YsQ0FBQztFQUVELE1BQU04TSxlQUFlLEdBQUcsTUFBQUEsQ0FBT0MsR0FBRyxFQUFFL00sR0FBRyxFQUFFNkYsR0FBRyxLQUFLO0lBQy9DLElBQUltSCxJQUFJLEdBQUdELEdBQUcsQ0FBQ1gsT0FBTztJQUN0QixJQUFJLE9BQU9ZLElBQUksS0FBSyxVQUFVLEVBQUU7TUFDOUIsSUFBSTtRQUNGLE1BQU1sRCxNQUFNLEdBQUcsTUFBTWtELElBQUksQ0FBQ25ILEdBQUcsQ0FBQztRQUM5QixJQUFJLENBQUNpRSxNQUFNLElBQUlBLE1BQU0sSUFBSSxJQUFJLEVBQUU7VUFDN0IsTUFBTWlELEdBQUcsQ0FBQ2hFLEtBQUssSUFBSyx3Q0FBdUMvSSxHQUFJLEdBQUU7UUFDbkU7TUFDRixDQUFDLENBQUMsT0FBT2dKLENBQUMsRUFBRTtRQUNWLElBQUksQ0FBQ0EsQ0FBQyxFQUFFO1VBQ04sTUFBTStELEdBQUcsQ0FBQ2hFLEtBQUssSUFBSyx3Q0FBdUMvSSxHQUFJLEdBQUU7UUFDbkU7UUFFQSxNQUFNK00sR0FBRyxDQUFDaEUsS0FBSyxJQUFJQyxDQUFDLENBQUNLLE9BQU8sSUFBSUwsQ0FBQztNQUNuQztNQUNBO0lBQ0Y7SUFDQSxJQUFJLENBQUNpRSxLQUFLLENBQUNDLE9BQU8sQ0FBQ0YsSUFBSSxDQUFDLEVBQUU7TUFDeEJBLElBQUksR0FBRyxDQUFDRCxHQUFHLENBQUNYLE9BQU8sQ0FBQztJQUN0QjtJQUVBLElBQUksQ0FBQ1ksSUFBSSxDQUFDRyxRQUFRLENBQUN0SCxHQUFHLENBQUMsRUFBRTtNQUN2QixNQUNFa0gsR0FBRyxDQUFDaEUsS0FBSyxJQUFLLHlDQUF3Qy9JLEdBQUksZUFBY2dOLElBQUksQ0FBQ0ksSUFBSSxDQUFDLElBQUksQ0FBRSxFQUFDO0lBRTdGO0VBQ0YsQ0FBQztFQUVELE1BQU1DLE9BQU8sR0FBR0MsRUFBRSxJQUFJO0lBQ3BCLE1BQU1DLEtBQUssR0FBR0QsRUFBRSxJQUFJQSxFQUFFLENBQUNFLFFBQVEsQ0FBQyxDQUFDLENBQUNELEtBQUssQ0FBQyxvQkFBb0IsQ0FBQztJQUM3RCxPQUFPLENBQUNBLEtBQUssR0FBR0EsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRUUsV0FBVyxDQUFDLENBQUM7RUFDOUMsQ0FBQztFQUNELElBQUlSLEtBQUssQ0FBQ0MsT0FBTyxDQUFDZCxPQUFPLENBQUNzQixNQUFNLENBQUMsRUFBRTtJQUNqQyxLQUFLLE1BQU0xTixHQUFHLElBQUlvTSxPQUFPLENBQUNzQixNQUFNLEVBQUU7TUFDaENiLGFBQWEsQ0FBQzdNLEdBQUcsQ0FBQztJQUNwQjtFQUNGLENBQUMsTUFBTTtJQUNMLE1BQU0yTixjQUFjLEdBQUcsRUFBRTtJQUN6QixLQUFLLE1BQU0zTixHQUFHLElBQUlvTSxPQUFPLENBQUNzQixNQUFNLEVBQUU7TUFDaEMsTUFBTVgsR0FBRyxHQUFHWCxPQUFPLENBQUNzQixNQUFNLENBQUMxTixHQUFHLENBQUM7TUFDL0IsSUFBSTZGLEdBQUcsR0FBRytHLE1BQU0sQ0FBQzVNLEdBQUcsQ0FBQztNQUNyQixJQUFJLE9BQU8rTSxHQUFHLEtBQUssUUFBUSxFQUFFO1FBQzNCRixhQUFhLENBQUNFLEdBQUcsQ0FBQztNQUNwQjtNQUNBLElBQUksT0FBT0EsR0FBRyxLQUFLLFFBQVEsRUFBRTtRQUMzQixJQUFJQSxHQUFHLENBQUNwTyxPQUFPLElBQUksSUFBSSxJQUFJa0gsR0FBRyxJQUFJLElBQUksRUFBRTtVQUN0Q0EsR0FBRyxHQUFHa0gsR0FBRyxDQUFDcE8sT0FBTztVQUNqQmlPLE1BQU0sQ0FBQzVNLEdBQUcsQ0FBQyxHQUFHNkYsR0FBRztVQUNqQixJQUFJTSxPQUFPLENBQUN0SCxNQUFNLEVBQUU7WUFDbEJzSCxPQUFPLENBQUN0SCxNQUFNLENBQUMrTyxHQUFHLENBQUM1TixHQUFHLEVBQUU2RixHQUFHLENBQUM7VUFDOUI7UUFDRjtRQUNBLElBQUlrSCxHQUFHLENBQUNjLFFBQVEsSUFBSTFILE9BQU8sQ0FBQ3RILE1BQU0sRUFBRTtVQUNsQyxJQUFJc0gsT0FBTyxDQUFDeUIsUUFBUSxFQUFFO1lBQ3BCekIsT0FBTyxDQUFDdEgsTUFBTSxDQUFDaVAsTUFBTSxDQUFDOU4sR0FBRyxDQUFDO1VBQzVCLENBQUMsTUFBTSxJQUFJK00sR0FBRyxDQUFDcE8sT0FBTyxJQUFJLElBQUksRUFBRTtZQUM5QndILE9BQU8sQ0FBQ3RILE1BQU0sQ0FBQytPLEdBQUcsQ0FBQzVOLEdBQUcsRUFBRStNLEdBQUcsQ0FBQ3BPLE9BQU8sQ0FBQztVQUN0QztRQUNGO1FBQ0EsSUFBSW9PLEdBQUcsQ0FBQ2dCLFFBQVEsRUFBRTtVQUNoQmxCLGFBQWEsQ0FBQzdNLEdBQUcsQ0FBQztRQUNwQjtRQUNBLE1BQU1nTyxRQUFRLEdBQUcsQ0FBQ2pCLEdBQUcsQ0FBQ2dCLFFBQVEsSUFBSWxJLEdBQUcsS0FBSzVFLFNBQVM7UUFDbkQsSUFBSSxDQUFDK00sUUFBUSxFQUFFO1VBQ2IsSUFBSWpCLEdBQUcsQ0FBQzNKLElBQUksRUFBRTtZQUNaLE1BQU1BLElBQUksR0FBR2lLLE9BQU8sQ0FBQ04sR0FBRyxDQUFDM0osSUFBSSxDQUFDO1lBQzlCLE1BQU02SyxPQUFPLEdBQUdoQixLQUFLLENBQUNDLE9BQU8sQ0FBQ3JILEdBQUcsQ0FBQyxHQUFHLE9BQU8sR0FBRyxPQUFPQSxHQUFHO1lBQ3pELElBQUlvSSxPQUFPLEtBQUs3SyxJQUFJLEVBQUU7Y0FDcEIsTUFBTyx1Q0FBc0NwRCxHQUFJLGVBQWNvRCxJQUFLLEVBQUM7WUFDdkU7VUFDRjtVQUNBLElBQUkySixHQUFHLENBQUNYLE9BQU8sRUFBRTtZQUNmdUIsY0FBYyxDQUFDcE8sSUFBSSxDQUFDdU4sZUFBZSxDQUFDQyxHQUFHLEVBQUUvTSxHQUFHLEVBQUU2RixHQUFHLENBQUMsQ0FBQztVQUNyRDtRQUNGO01BQ0Y7SUFDRjtJQUNBLE1BQU1xRSxPQUFPLENBQUNnRSxHQUFHLENBQUNQLGNBQWMsQ0FBQztFQUNuQztFQUNBLElBQUlRLFNBQVMsR0FBRy9CLE9BQU8sQ0FBQ0ssbUJBQW1CO0VBQzNDLElBQUkyQixlQUFlLEdBQUdoQyxPQUFPLENBQUNNLG1CQUFtQjtFQUNqRCxNQUFNMkIsUUFBUSxHQUFHLENBQUNuRSxPQUFPLENBQUM1QixPQUFPLENBQUMsQ0FBQyxFQUFFNEIsT0FBTyxDQUFDNUIsT0FBTyxDQUFDLENBQUMsRUFBRTRCLE9BQU8sQ0FBQzVCLE9BQU8sQ0FBQyxDQUFDLENBQUM7RUFDMUUsSUFBSTZGLFNBQVMsSUFBSUMsZUFBZSxFQUFFO0lBQ2hDQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUdqSSxJQUFJLENBQUNrSSxZQUFZLENBQUMsQ0FBQztFQUNuQztFQUNBLElBQUksT0FBT0gsU0FBUyxLQUFLLFVBQVUsRUFBRTtJQUNuQ0UsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHRixTQUFTLENBQUMsQ0FBQztFQUMzQjtFQUNBLElBQUksT0FBT0MsZUFBZSxLQUFLLFVBQVUsRUFBRTtJQUN6Q0MsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHRCxlQUFlLENBQUMsQ0FBQztFQUNqQztFQUNBLE1BQU0sQ0FBQ0csS0FBSyxFQUFFQyxpQkFBaUIsRUFBRUMsa0JBQWtCLENBQUMsR0FBRyxNQUFNdkUsT0FBTyxDQUFDZ0UsR0FBRyxDQUFDRyxRQUFRLENBQUM7RUFDbEYsSUFBSUcsaUJBQWlCLElBQUl2QixLQUFLLENBQUNDLE9BQU8sQ0FBQ3NCLGlCQUFpQixDQUFDLEVBQUU7SUFDekRMLFNBQVMsR0FBR0ssaUJBQWlCO0VBQy9CO0VBQ0EsSUFBSUMsa0JBQWtCLElBQUl4QixLQUFLLENBQUNDLE9BQU8sQ0FBQ3VCLGtCQUFrQixDQUFDLEVBQUU7SUFDM0RMLGVBQWUsR0FBR0ssa0JBQWtCO0VBQ3RDO0VBQ0EsSUFBSU4sU0FBUyxFQUFFO0lBQ2IsTUFBTU8sT0FBTyxHQUFHUCxTQUFTLENBQUNRLElBQUksQ0FBQ0MsWUFBWSxJQUFJTCxLQUFLLENBQUNwQixRQUFRLENBQUUsUUFBT3lCLFlBQWEsRUFBQyxDQUFDLENBQUM7SUFDdEYsSUFBSSxDQUFDRixPQUFPLEVBQUU7TUFDWixNQUFPLDREQUEyRDtJQUNwRTtFQUNGO0VBQ0EsSUFBSU4sZUFBZSxFQUFFO0lBQ25CLEtBQUssTUFBTVEsWUFBWSxJQUFJUixlQUFlLEVBQUU7TUFDMUMsSUFBSSxDQUFDRyxLQUFLLENBQUNwQixRQUFRLENBQUUsUUFBT3lCLFlBQWEsRUFBQyxDQUFDLEVBQUU7UUFDM0MsTUFBTyxnRUFBK0Q7TUFDeEU7SUFDRjtFQUNGO0VBQ0EsTUFBTUMsUUFBUSxHQUFHekMsT0FBTyxDQUFDMEMsZUFBZSxJQUFJLEVBQUU7RUFDOUMsSUFBSTdCLEtBQUssQ0FBQ0MsT0FBTyxDQUFDMkIsUUFBUSxDQUFDLEVBQUU7SUFDM0IsS0FBSyxNQUFNN08sR0FBRyxJQUFJNk8sUUFBUSxFQUFFO01BQzFCLElBQUksQ0FBQ3ZDLE9BQU8sRUFBRTtRQUNaLE1BQU0sb0NBQW9DO01BQzVDO01BRUEsSUFBSUEsT0FBTyxDQUFDOUgsR0FBRyxDQUFDeEUsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFO1FBQzVCLE1BQU8sMENBQXlDQSxHQUFJLG1CQUFrQjtNQUN4RTtJQUNGO0VBQ0YsQ0FBQyxNQUFNLElBQUksT0FBTzZPLFFBQVEsS0FBSyxRQUFRLEVBQUU7SUFDdkMsTUFBTWxCLGNBQWMsR0FBRyxFQUFFO0lBQ3pCLEtBQUssTUFBTTNOLEdBQUcsSUFBSW9NLE9BQU8sQ0FBQzBDLGVBQWUsRUFBRTtNQUN6QyxNQUFNL0IsR0FBRyxHQUFHWCxPQUFPLENBQUMwQyxlQUFlLENBQUM5TyxHQUFHLENBQUM7TUFDeEMsSUFBSStNLEdBQUcsQ0FBQ1gsT0FBTyxFQUFFO1FBQ2Z1QixjQUFjLENBQUNwTyxJQUFJLENBQUN1TixlQUFlLENBQUNDLEdBQUcsRUFBRS9NLEdBQUcsRUFBRXNNLE9BQU8sQ0FBQzlILEdBQUcsQ0FBQ3hFLEdBQUcsQ0FBQyxDQUFDLENBQUM7TUFDbEU7SUFDRjtJQUNBLE1BQU1rSyxPQUFPLENBQUNnRSxHQUFHLENBQUNQLGNBQWMsQ0FBQztFQUNuQztBQUNGOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxTQUFTb0IsZUFBZUEsQ0FDN0IvSSxXQUFXLEVBQ1hJLElBQUksRUFDSmMsV0FBVyxFQUNYQyxtQkFBbUIsRUFDbkJDLE1BQU0sRUFDTkMsT0FBTyxFQUNQO0VBQ0EsSUFBSSxDQUFDSCxXQUFXLEVBQUU7SUFDaEIsT0FBT2dELE9BQU8sQ0FBQzVCLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUM1QjtFQUNBLE9BQU8sSUFBSTRCLE9BQU8sQ0FBQyxVQUFVNUIsT0FBTyxFQUFFQyxNQUFNLEVBQUU7SUFDNUMsSUFBSXJDLE9BQU8sR0FBR0gsVUFBVSxDQUFDbUIsV0FBVyxDQUFDbEUsU0FBUyxFQUFFZ0QsV0FBVyxFQUFFb0IsTUFBTSxDQUFDM0QsYUFBYSxDQUFDO0lBQ2xGLElBQUksQ0FBQ3lDLE9BQU8sRUFBRSxPQUFPb0MsT0FBTyxDQUFDLENBQUM7SUFDOUIsSUFBSW5DLE9BQU8sR0FBR2MsZ0JBQWdCLENBQzVCakIsV0FBVyxFQUNYSSxJQUFJLEVBQ0pjLFdBQVcsRUFDWEMsbUJBQW1CLEVBQ25CQyxNQUFNLEVBQ05DLE9BQ0YsQ0FBQztJQUNELElBQUk7TUFBRW1CLE9BQU87TUFBRU87SUFBTSxDQUFDLEdBQUdWLGlCQUFpQixDQUN4Q2xDLE9BQU8sRUFDUHRILE1BQU0sSUFBSTtNQUNSZ0wsMkJBQTJCLENBQ3pCN0QsV0FBVyxFQUNYa0IsV0FBVyxDQUFDbEUsU0FBUyxFQUNyQmtFLFdBQVcsQ0FBQzVCLE1BQU0sQ0FBQyxDQUFDLEVBQ3BCekcsTUFBTSxFQUNOdUgsSUFBSSxFQUNKSixXQUFXLENBQUNnSixVQUFVLENBQUMsT0FBTyxDQUFDLEdBQzNCNUgsTUFBTSxDQUFDK0MsU0FBUyxDQUFDSyxZQUFZLEdBQzdCcEQsTUFBTSxDQUFDK0MsU0FBUyxDQUFDQyxvQkFDdkIsQ0FBQztNQUNELElBQ0VwRSxXQUFXLEtBQUsxRSxLQUFLLENBQUNJLFVBQVUsSUFDaENzRSxXQUFXLEtBQUsxRSxLQUFLLENBQUNLLFNBQVMsSUFDL0JxRSxXQUFXLEtBQUsxRSxLQUFLLENBQUNNLFlBQVksSUFDbENvRSxXQUFXLEtBQUsxRSxLQUFLLENBQUNPLFdBQVcsRUFDakM7UUFDQTdDLE1BQU0sQ0FBQzZJLE1BQU0sQ0FBQ1IsT0FBTyxFQUFFbEIsT0FBTyxDQUFDa0IsT0FBTyxDQUFDO01BQ3pDO01BQ0FpQixPQUFPLENBQUN6SixNQUFNLENBQUM7SUFDakIsQ0FBQyxFQUNEa0ssS0FBSyxJQUFJO01BQ1BpQix5QkFBeUIsQ0FDdkJoRSxXQUFXLEVBQ1hrQixXQUFXLENBQUNsRSxTQUFTLEVBQ3JCa0UsV0FBVyxDQUFDNUIsTUFBTSxDQUFDLENBQUMsRUFDcEJjLElBQUksRUFDSjJDLEtBQUssRUFDTDNCLE1BQU0sQ0FBQytDLFNBQVMsQ0FBQzhFLGtCQUNuQixDQUFDO01BQ0QxRyxNQUFNLENBQUNRLEtBQUssQ0FBQztJQUNmLENBQ0YsQ0FBQzs7SUFFRDtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsT0FBT21CLE9BQU8sQ0FBQzVCLE9BQU8sQ0FBQyxDQUFDLENBQ3JCZ0MsSUFBSSxDQUFDLE1BQU07TUFDVixPQUFPakUsaUJBQWlCLENBQUNGLE9BQU8sRUFBRyxHQUFFSCxXQUFZLElBQUdrQixXQUFXLENBQUNsRSxTQUFVLEVBQUMsRUFBRW9ELElBQUksQ0FBQztJQUNwRixDQUFDLENBQUMsQ0FDRGtFLElBQUksQ0FBQyxNQUFNO01BQ1YsSUFBSW5FLE9BQU8sQ0FBQ0csaUJBQWlCLEVBQUU7UUFDN0IsT0FBTzRELE9BQU8sQ0FBQzVCLE9BQU8sQ0FBQyxDQUFDO01BQzFCO01BQ0EsTUFBTTRHLE9BQU8sR0FBR2hKLE9BQU8sQ0FBQ0MsT0FBTyxDQUFDO01BQ2hDLElBQ0VILFdBQVcsS0FBSzFFLEtBQUssQ0FBQ0ssU0FBUyxJQUMvQnFFLFdBQVcsS0FBSzFFLEtBQUssQ0FBQ08sV0FBVyxJQUNqQ21FLFdBQVcsS0FBSzFFLEtBQUssQ0FBQ0UsVUFBVSxFQUNoQztRQUNBK0gsbUJBQW1CLENBQ2pCdkQsV0FBVyxFQUNYa0IsV0FBVyxDQUFDbEUsU0FBUyxFQUNyQmtFLFdBQVcsQ0FBQzVCLE1BQU0sQ0FBQyxDQUFDLEVBQ3BCYyxJQUFJLEVBQ0pnQixNQUFNLENBQUMrQyxTQUFTLENBQUNLLFlBQ25CLENBQUM7TUFDSDtNQUNBO01BQ0EsSUFBSXhFLFdBQVcsS0FBSzFFLEtBQUssQ0FBQ0ksVUFBVSxFQUFFO1FBQ3BDLElBQUl3TixPQUFPLElBQUksT0FBT0EsT0FBTyxDQUFDNUUsSUFBSSxLQUFLLFVBQVUsRUFBRTtVQUNqRCxPQUFPNEUsT0FBTyxDQUFDNUUsSUFBSSxDQUFDN0IsUUFBUSxJQUFJO1lBQzlCO1lBQ0EsSUFBSUEsUUFBUSxJQUFJQSxRQUFRLENBQUM1SixNQUFNLEVBQUU7Y0FDL0IsT0FBTzRKLFFBQVE7WUFDakI7WUFDQSxPQUFPLElBQUk7VUFDYixDQUFDLENBQUM7UUFDSjtRQUNBLE9BQU8sSUFBSTtNQUNiO01BRUEsT0FBT3lHLE9BQU87SUFDaEIsQ0FBQyxDQUFDLENBQ0Q1RSxJQUFJLENBQUM5QixPQUFPLEVBQUVPLEtBQUssQ0FBQztFQUN6QixDQUFDLENBQUM7QUFDSjs7QUFFQTtBQUNBO0FBQ08sU0FBU29HLE9BQU9BLENBQUNDLElBQUksRUFBRUMsVUFBVSxFQUFFO0VBQ3hDLElBQUlDLElBQUksR0FBRyxPQUFPRixJQUFJLElBQUksUUFBUSxHQUFHQSxJQUFJLEdBQUc7SUFBRXBNLFNBQVMsRUFBRW9NO0VBQUssQ0FBQztFQUMvRCxLQUFLLElBQUlwUCxHQUFHLElBQUlxUCxVQUFVLEVBQUU7SUFDMUJDLElBQUksQ0FBQ3RQLEdBQUcsQ0FBQyxHQUFHcVAsVUFBVSxDQUFDclAsR0FBRyxDQUFDO0VBQzdCO0VBQ0EsT0FBTytELGFBQUssQ0FBQy9FLE1BQU0sQ0FBQ3FMLFFBQVEsQ0FBQ2lGLElBQUksQ0FBQztBQUNwQztBQUVPLFNBQVNDLHlCQUF5QkEsQ0FBQ0gsSUFBSSxFQUFFM0wsYUFBYSxHQUFHTSxhQUFLLENBQUNOLGFBQWEsRUFBRTtFQUNuRixJQUFJLENBQUNKLGFBQWEsSUFBSSxDQUFDQSxhQUFhLENBQUNJLGFBQWEsQ0FBQyxJQUFJLENBQUNKLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLENBQUNkLFNBQVMsRUFBRTtJQUM5RjtFQUNGO0VBQ0FVLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLENBQUNkLFNBQVMsQ0FBQzVDLE9BQU8sQ0FBQ29FLE9BQU8sSUFBSUEsT0FBTyxDQUFDaUwsSUFBSSxDQUFDLENBQUM7QUFDMUU7QUFFTyxTQUFTSSxvQkFBb0JBLENBQUN4SixXQUFXLEVBQUVJLElBQUksRUFBRXFKLFVBQVUsRUFBRXJJLE1BQU0sRUFBRTtFQUMxRSxNQUFNakIsT0FBTyxHQUFBMUcsYUFBQSxDQUFBQSxhQUFBLEtBQ1JnUSxVQUFVO0lBQ2JuSSxXQUFXLEVBQUV0QixXQUFXO0lBQ3hCdUIsTUFBTSxFQUFFLEtBQUs7SUFDYkMsR0FBRyxFQUFFSixNQUFNLENBQUNLLGdCQUFnQjtJQUM1QkMsT0FBTyxFQUFFTixNQUFNLENBQUNNLE9BQU87SUFDdkJDLEVBQUUsRUFBRVAsTUFBTSxDQUFDTztFQUFFLEVBQ2Q7RUFFRCxJQUFJLENBQUN2QixJQUFJLEVBQUU7SUFDVCxPQUFPRCxPQUFPO0VBQ2hCO0VBQ0EsSUFBSUMsSUFBSSxDQUFDMEIsUUFBUSxFQUFFO0lBQ2pCM0IsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUk7RUFDMUI7RUFDQSxJQUFJQyxJQUFJLENBQUMyQixJQUFJLEVBQUU7SUFDYjVCLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBR0MsSUFBSSxDQUFDMkIsSUFBSTtFQUM3QjtFQUNBLElBQUkzQixJQUFJLENBQUM0QixjQUFjLEVBQUU7SUFDdkI3QixPQUFPLENBQUMsZ0JBQWdCLENBQUMsR0FBR0MsSUFBSSxDQUFDNEIsY0FBYztFQUNqRDtFQUNBLE9BQU83QixPQUFPO0FBQ2hCO0FBRU8sZUFBZXVKLG1CQUFtQkEsQ0FBQzFKLFdBQVcsRUFBRXlKLFVBQVUsRUFBRXJJLE1BQU0sRUFBRWhCLElBQUksRUFBRTtFQUMvRSxNQUFNdUosYUFBYSxHQUFHN00sWUFBWSxDQUFDaUIsYUFBSyxDQUFDNkwsSUFBSSxDQUFDO0VBQzlDLE1BQU1DLFdBQVcsR0FBRzlKLFVBQVUsQ0FBQzRKLGFBQWEsRUFBRTNKLFdBQVcsRUFBRW9CLE1BQU0sQ0FBQzNELGFBQWEsQ0FBQztFQUNoRixJQUFJLE9BQU9vTSxXQUFXLEtBQUssVUFBVSxFQUFFO0lBQ3JDLElBQUk7TUFDRixNQUFNMUosT0FBTyxHQUFHcUosb0JBQW9CLENBQUN4SixXQUFXLEVBQUVJLElBQUksRUFBRXFKLFVBQVUsRUFBRXJJLE1BQU0sQ0FBQztNQUMzRSxNQUFNZixpQkFBaUIsQ0FBQ0YsT0FBTyxFQUFHLEdBQUVILFdBQVksSUFBRzJKLGFBQWMsRUFBQyxFQUFFdkosSUFBSSxDQUFDO01BQ3pFLElBQUlELE9BQU8sQ0FBQ0csaUJBQWlCLEVBQUU7UUFDN0IsT0FBT21KLFVBQVU7TUFDbkI7TUFDQSxNQUFNM0YsTUFBTSxHQUFHLE1BQU0rRixXQUFXLENBQUMxSixPQUFPLENBQUM7TUFDekMwRCwyQkFBMkIsQ0FDekI3RCxXQUFXLEVBQ1gsWUFBWSxFQUFBdkcsYUFBQSxDQUFBQSxhQUFBLEtBQ1BnUSxVQUFVLENBQUNLLElBQUksQ0FBQ3hLLE1BQU0sQ0FBQyxDQUFDO1FBQUV5SyxRQUFRLEVBQUVOLFVBQVUsQ0FBQ007TUFBUSxJQUM1RGpHLE1BQU0sRUFDTjFELElBQUksRUFDSmdCLE1BQU0sQ0FBQytDLFNBQVMsQ0FBQ0Msb0JBQ25CLENBQUM7TUFDRCxPQUFPTixNQUFNLElBQUkyRixVQUFVO0lBQzdCLENBQUMsQ0FBQyxPQUFPMUcsS0FBSyxFQUFFO01BQ2RpQix5QkFBeUIsQ0FDdkJoRSxXQUFXLEVBQ1gsWUFBWSxFQUFBdkcsYUFBQSxDQUFBQSxhQUFBLEtBQ1BnUSxVQUFVLENBQUNLLElBQUksQ0FBQ3hLLE1BQU0sQ0FBQyxDQUFDO1FBQUV5SyxRQUFRLEVBQUVOLFVBQVUsQ0FBQ007TUFBUSxJQUM1RDNKLElBQUksRUFDSjJDLEtBQUssRUFDTDNCLE1BQU0sQ0FBQytDLFNBQVMsQ0FBQzhFLGtCQUNuQixDQUFDO01BQ0QsTUFBTWxHLEtBQUs7SUFDYjtFQUNGO0VBQ0EsT0FBTzBHLFVBQVU7QUFDbkIifQ==