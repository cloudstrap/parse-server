"use strict";

var _util = require("util");
var _triggers = require("./triggers");
var _Deprecator = _interopRequireDefault(require("./Deprecator/Deprecator"));
var _logger = require("./logger");
var _RestQuery = _interopRequireDefault(require("./RestQuery"));
var _RestWrite = _interopRequireDefault(require("./RestWrite"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
const Parse = require('parse/node');
// An Auth object tells you who is requesting something and whether
// the master key was used.
// userObject is a Parse.User and can be null if there's no user.
function Auth({
  config,
  cacheController = undefined,
  isMaster = false,
  isMaintenance = false,
  isReadOnly = false,
  user,
  installationId
}) {
  this.config = config;
  this.cacheController = cacheController || config && config.cacheController;
  this.installationId = installationId;
  this.isMaster = isMaster;
  this.isMaintenance = isMaintenance;
  this.user = user;
  this.isReadOnly = isReadOnly;

  // Assuming a users roles won't change during a single request, we'll
  // only load them once.
  this.userRoles = [];
  this.fetchedRoles = false;
  this.rolePromise = null;
}

// Whether this auth could possibly modify the given user id.
// It still could be forbidden via ACLs even if this returns true.
Auth.prototype.isUnauthenticated = function () {
  if (this.isMaster) {
    return false;
  }
  if (this.isMaintenance) {
    return false;
  }
  if (this.user) {
    return false;
  }
  return true;
};

// A helper to get a master-level Auth object
function master(config) {
  return new Auth({
    config,
    isMaster: true
  });
}

// A helper to get a maintenance-level Auth object
function maintenance(config) {
  return new Auth({
    config,
    isMaintenance: true
  });
}

// A helper to get a master-level Auth object
function readOnly(config) {
  return new Auth({
    config,
    isMaster: true,
    isReadOnly: true
  });
}

// A helper to get a nobody-level Auth object
function nobody(config) {
  return new Auth({
    config,
    isMaster: false
  });
}
const throttle = {};
const renewSessionIfNeeded = async ({
  config,
  session,
  sessionToken
}) => {
  if (!(config !== null && config !== void 0 && config.extendSessionOnUse)) {
    return;
  }
  clearTimeout(throttle[sessionToken]);
  throttle[sessionToken] = setTimeout(async () => {
    try {
      var _session;
      if (!session) {
        const query = await (0, _RestQuery.default)({
          method: _RestQuery.default.Method.get,
          config,
          auth: master(config),
          runBeforeFind: false,
          className: '_Session',
          restWhere: {
            sessionToken
          },
          restOptions: {
            limit: 1
          }
        });
        const {
          results
        } = await query.execute();
        session = results[0];
      }
      const lastUpdated = new Date((_session = session) === null || _session === void 0 ? void 0 : _session.updatedAt);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastUpdated > yesterday || !session) {
        return;
      }
      const expiresAt = config.generateSessionExpiresAt();
      await new _RestWrite.default(config, master(config), '_Session', {
        objectId: session.objectId
      }, {
        expiresAt: Parse._encode(expiresAt)
      }).execute();
    } catch (e) {
      if ((e === null || e === void 0 ? void 0 : e.code) !== Parse.Error.OBJECT_NOT_FOUND) {
        _logger.logger.error('Could not update session expiry: ', e);
      }
    }
  }, 500);
};

// Returns a promise that resolves to an Auth object
const getAuthForSessionToken = async function ({
  config,
  cacheController,
  sessionToken,
  installationId
}) {
  cacheController = cacheController || config && config.cacheController;
  if (cacheController) {
    const userJSON = await cacheController.user.get(sessionToken);
    if (userJSON) {
      const cachedUser = Parse.Object.fromJSON(userJSON);
      renewSessionIfNeeded({
        config,
        sessionToken
      });
      return Promise.resolve(new Auth({
        config,
        cacheController,
        isMaster: false,
        installationId,
        user: cachedUser
      }));
    }
  }
  let results;
  if (config) {
    const restOptions = {
      limit: 1,
      include: 'user'
    };
    const RestQuery = require('./RestQuery');
    const query = await RestQuery({
      method: RestQuery.Method.get,
      config,
      runBeforeFind: false,
      auth: master(config),
      className: '_Session',
      restWhere: {
        sessionToken
      },
      restOptions
    });
    results = (await query.execute()).results;
  } else {
    results = (await new Parse.Query(Parse.Session).limit(1).include('user').equalTo('sessionToken', sessionToken).find({
      useMasterKey: true
    })).map(obj => obj.toJSON());
  }
  if (results.length !== 1 || !results[0]['user']) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'Invalid session token');
  }
  const session = results[0];
  const now = new Date(),
    expiresAt = session.expiresAt ? new Date(session.expiresAt.iso) : undefined;
  if (expiresAt < now) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'Session token is expired.');
  }
  const obj = session.user;
  if (typeof obj['objectId'] === 'string' && obj['objectId'].startsWith('role:')) {
    throw new Parse.Error(Parse.Error.INTERNAL_SERVER_ERROR, 'Invalid object ID.');
  }
  delete obj.password;
  obj['className'] = '_User';
  obj['sessionToken'] = sessionToken;
  if (cacheController) {
    cacheController.user.put(sessionToken, obj);
  }
  renewSessionIfNeeded({
    config,
    session,
    sessionToken
  });
  const userObject = Parse.Object.fromJSON(obj);
  return new Auth({
    config,
    cacheController,
    isMaster: false,
    installationId,
    user: userObject
  });
};
var getAuthForLegacySessionToken = async function ({
  config,
  sessionToken,
  installationId
}) {
  var restOptions = {
    limit: 1
  };
  const RestQuery = require('./RestQuery');
  var query = await RestQuery({
    method: RestQuery.Method.get,
    config,
    runBeforeFind: false,
    auth: master(config),
    className: '_User',
    restWhere: {
      _session_token: sessionToken
    },
    restOptions
  });
  return query.execute().then(response => {
    var results = response.results;
    if (results.length !== 1) {
      throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'invalid legacy session token');
    }
    const obj = results[0];
    obj.className = '_User';
    const userObject = Parse.Object.fromJSON(obj);
    return new Auth({
      config,
      isMaster: false,
      installationId,
      user: userObject
    });
  });
};

// Returns a promise that resolves to an array of role names
Auth.prototype.getUserRoles = function () {
  if (this.isMaster || this.isMaintenance || !this.user) {
    return Promise.resolve([]);
  }
  if (this.fetchedRoles) {
    return Promise.resolve(this.userRoles);
  }
  if (this.rolePromise) {
    return this.rolePromise;
  }
  this.rolePromise = this._loadRoles();
  return this.rolePromise;
};
Auth.prototype.getRolesForUser = async function () {
  //Stack all Parse.Role
  const results = [];
  if (this.config) {
    const restWhere = {
      users: {
        __type: 'Pointer',
        className: '_User',
        objectId: this.user.id
      }
    };
    const RestQuery = require('./RestQuery');
    const query = await RestQuery({
      method: RestQuery.Method.find,
      runBeforeFind: false,
      config: this.config,
      auth: master(this.config),
      className: '_Role',
      restWhere
    });
    await query.each(result => results.push(result));
  } else {
    await new Parse.Query(Parse.Role).equalTo('users', this.user).each(result => results.push(result.toJSON()), {
      useMasterKey: true
    });
  }
  return results;
};

// Iterates through the role tree and compiles a user's roles
Auth.prototype._loadRoles = async function () {
  if (this.cacheController) {
    const cachedRoles = await this.cacheController.role.get(this.user.id);
    if (cachedRoles != null) {
      this.fetchedRoles = true;
      this.userRoles = cachedRoles;
      return cachedRoles;
    }
  }

  // First get the role ids this user is directly a member of
  const results = await this.getRolesForUser();
  if (!results.length) {
    this.userRoles = [];
    this.fetchedRoles = true;
    this.rolePromise = null;
    this.cacheRoles();
    return this.userRoles;
  }
  const rolesMap = results.reduce((m, r) => {
    m.names.push(r.name);
    m.ids.push(r.objectId);
    return m;
  }, {
    ids: [],
    names: []
  });

  // run the recursive finding
  const roleNames = await this._getAllRolesNamesForRoleIds(rolesMap.ids, rolesMap.names);
  this.userRoles = roleNames.map(r => {
    return 'role:' + r;
  });
  this.fetchedRoles = true;
  this.rolePromise = null;
  this.cacheRoles();
  return this.userRoles;
};
Auth.prototype.cacheRoles = function () {
  if (!this.cacheController) {
    return false;
  }
  this.cacheController.role.put(this.user.id, Array(...this.userRoles));
  return true;
};
Auth.prototype.clearRoleCache = function (sessionToken) {
  if (!this.cacheController) {
    return false;
  }
  this.cacheController.role.del(this.user.id);
  this.cacheController.user.del(sessionToken);
  return true;
};
Auth.prototype.getRolesByIds = async function (ins) {
  const results = [];
  // Build an OR query across all parentRoles
  if (!this.config) {
    await new Parse.Query(Parse.Role).containedIn('roles', ins.map(id => {
      const role = new Parse.Object(Parse.Role);
      role.id = id;
      return role;
    })).each(result => results.push(result.toJSON()), {
      useMasterKey: true
    });
  } else {
    const roles = ins.map(id => {
      return {
        __type: 'Pointer',
        className: '_Role',
        objectId: id
      };
    });
    const restWhere = {
      roles: {
        $in: roles
      }
    };
    const RestQuery = require('./RestQuery');
    const query = await RestQuery({
      method: RestQuery.Method.find,
      config: this.config,
      runBeforeFind: false,
      auth: master(this.config),
      className: '_Role',
      restWhere
    });
    await query.each(result => results.push(result));
  }
  return results;
};

// Given a list of roleIds, find all the parent roles, returns a promise with all names
Auth.prototype._getAllRolesNamesForRoleIds = function (roleIDs, names = [], queriedRoles = {}) {
  const ins = roleIDs.filter(roleID => {
    const wasQueried = queriedRoles[roleID] !== true;
    queriedRoles[roleID] = true;
    return wasQueried;
  });

  // all roles are accounted for, return the names
  if (ins.length == 0) {
    return Promise.resolve([...new Set(names)]);
  }
  return this.getRolesByIds(ins).then(results => {
    // Nothing found
    if (!results.length) {
      return Promise.resolve(names);
    }
    // Map the results with all Ids and names
    const resultMap = results.reduce((memo, role) => {
      memo.names.push(role.name);
      memo.ids.push(role.objectId);
      return memo;
    }, {
      ids: [],
      names: []
    });
    // store the new found names
    names = names.concat(resultMap.names);
    // find the next ones, circular roles will be cut
    return this._getAllRolesNamesForRoleIds(resultMap.ids, names, queriedRoles);
  }).then(names => {
    return Promise.resolve([...new Set(names)]);
  });
};
const findUsersWithAuthData = (config, authData) => {
  const providers = Object.keys(authData);
  const query = providers.reduce((memo, provider) => {
    if (!authData[provider] || authData && !authData[provider].id) {
      return memo;
    }
    const queryKey = `authData.${provider}.id`;
    const query = {};
    query[queryKey] = authData[provider].id;
    memo.push(query);
    return memo;
  }, []).filter(q => {
    return typeof q !== 'undefined';
  });
  return query.length > 0 ? config.database.find('_User', {
    $or: query
  }, {
    limit: 2
  }) : Promise.resolve([]);
};
const hasMutatedAuthData = (authData, userAuthData) => {
  if (!userAuthData) return {
    hasMutatedAuthData: true,
    mutatedAuthData: authData
  };
  const mutatedAuthData = {};
  Object.keys(authData).forEach(provider => {
    // Anonymous provider is not handled this way
    if (provider === 'anonymous') return;
    const providerData = authData[provider];
    const userProviderAuthData = userAuthData[provider];
    if (!(0, _util.isDeepStrictEqual)(providerData, userProviderAuthData)) {
      mutatedAuthData[provider] = providerData;
    }
  });
  const hasMutatedAuthData = Object.keys(mutatedAuthData).length !== 0;
  return {
    hasMutatedAuthData,
    mutatedAuthData
  };
};
const checkIfUserHasProvidedConfiguredProvidersForLogin = (req = {}, authData = {}, userAuthData = {}, config) => {
  const savedUserProviders = Object.keys(userAuthData).map(provider => ({
    name: provider,
    adapter: config.authDataManager.getValidatorForProvider(provider).adapter
  }));
  const hasProvidedASoloProvider = savedUserProviders.some(provider => provider && provider.adapter && provider.adapter.policy === 'solo' && authData[provider.name]);

  // Solo providers can be considered as safe, so we do not have to check if the user needs
  // to provide an additional provider to login. An auth adapter with "solo" (like webauthn) means
  // no "additional" auth needs to be provided to login (like OTP, MFA)
  if (hasProvidedASoloProvider) {
    return;
  }
  const additionProvidersNotFound = [];
  const hasProvidedAtLeastOneAdditionalProvider = savedUserProviders.some(provider => {
    let policy = provider.adapter.policy;
    if (typeof policy === 'function') {
      const requestObject = {
        ip: req.config.ip,
        user: req.auth.user,
        master: req.auth.isMaster
      };
      policy = policy.call(provider.adapter, requestObject, userAuthData[provider.name]);
    }
    if (policy === 'additional') {
      if (authData[provider.name]) {
        return true;
      } else {
        // Push missing provider for error message
        additionProvidersNotFound.push(provider.name);
      }
    }
  });
  if (hasProvidedAtLeastOneAdditionalProvider || !additionProvidersNotFound.length) {
    return;
  }
  throw new Parse.Error(Parse.Error.OTHER_CAUSE, `Missing additional authData ${additionProvidersNotFound.join(',')}`);
};

// Validate each authData step-by-step and return the provider responses
const handleAuthDataValidation = async (authData, req, foundUser) => {
  let user;
  if (foundUser) {
    user = Parse.User.fromJSON(_objectSpread({
      className: '_User'
    }, foundUser));
    // Find user by session and current objectId; only pass user if it's the current user or master key is provided
  } else if (req.auth && req.auth.user && typeof req.getUserId === 'function' && req.getUserId() === req.auth.user.id || req.auth && req.auth.isMaster && typeof req.getUserId === 'function' && req.getUserId()) {
    user = new Parse.User();
    user.id = req.auth.isMaster ? req.getUserId() : req.auth.user.id;
    await user.fetch({
      useMasterKey: true
    });
  }
  const {
    updatedObject
  } = req.buildParseObjects();
  const requestObject = (0, _triggers.getRequestObject)(undefined, req.auth, updatedObject, user, req.config);
  // Perform validation as step-by-step pipeline for better error consistency
  // and also to avoid to trigger a provider (like OTP SMS) if another one fails
  const acc = {
    authData: {},
    authDataResponse: {}
  };
  const authKeys = Object.keys(authData).sort();
  for (const provider of authKeys) {
    let method = '';
    try {
      if (authData[provider] === null) {
        acc.authData[provider] = null;
        continue;
      }
      const {
        validator
      } = req.config.authDataManager.getValidatorForProvider(provider);
      const authProvider = (req.config.auth || {})[provider] || {};
      if (authProvider.enabled == null) {
        _Deprecator.default.logRuntimeDeprecation({
          usage: `Using the authentication adapter "${provider}" without explicitly enabling it`,
          solution: `Enable the authentication adapter by setting the Parse Server option "auth.${provider}.enabled: true".`
        });
      }
      if (!validator || authProvider.enabled === false) {
        throw new Parse.Error(Parse.Error.UNSUPPORTED_SERVICE, 'This authentication method is unsupported.');
      }
      let validationResult = await validator(authData[provider], req, user, requestObject);
      method = validationResult && validationResult.method;
      requestObject.triggerName = method;
      if (validationResult && validationResult.validator) {
        validationResult = await validationResult.validator();
      }
      if (!validationResult) {
        acc.authData[provider] = authData[provider];
        continue;
      }
      if (!Object.keys(validationResult).length) {
        acc.authData[provider] = authData[provider];
        continue;
      }
      if (validationResult.response) {
        acc.authDataResponse[provider] = validationResult.response;
      }
      // Some auth providers after initialization will avoid to replace authData already stored
      if (!validationResult.doNotSave) {
        acc.authData[provider] = validationResult.save || authData[provider];
      }
    } catch (err) {
      const e = (0, _triggers.resolveError)(err, {
        code: Parse.Error.SCRIPT_FAILED,
        message: 'Auth failed. Unknown error.'
      });
      const userString = req.auth && req.auth.user ? req.auth.user.id : req.data.objectId || undefined;
      _logger.logger.error(`Failed running auth step ${method} for ${provider} for user ${userString} with Error: ` + JSON.stringify(e), {
        authenticationStep: method,
        error: e,
        user: userString,
        provider
      });
      throw e;
    }
  }
  return acc;
};
module.exports = {
  Auth,
  master,
  maintenance,
  nobody,
  readOnly,
  getAuthForSessionToken,
  getAuthForLegacySessionToken,
  findUsersWithAuthData,
  hasMutatedAuthData,
  checkIfUserHasProvidedConfiguredProvidersForLogin,
  handleAuthDataValidation
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfdXRpbCIsInJlcXVpcmUiLCJfdHJpZ2dlcnMiLCJfRGVwcmVjYXRvciIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfbG9nZ2VyIiwiX1Jlc3RRdWVyeSIsIl9SZXN0V3JpdGUiLCJvYmoiLCJfX2VzTW9kdWxlIiwiZGVmYXVsdCIsIm93bktleXMiLCJvYmplY3QiLCJlbnVtZXJhYmxlT25seSIsImtleXMiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJzeW1ib2xzIiwiZmlsdGVyIiwic3ltIiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwiZW51bWVyYWJsZSIsInB1c2giLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJ0YXJnZXQiLCJpIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwic291cmNlIiwiZm9yRWFjaCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eSIsImdldE93blByb3BlcnR5RGVzY3JpcHRvcnMiLCJkZWZpbmVQcm9wZXJ0aWVzIiwiZGVmaW5lUHJvcGVydHkiLCJ2YWx1ZSIsIl90b1Byb3BlcnR5S2V5IiwiY29uZmlndXJhYmxlIiwid3JpdGFibGUiLCJhcmciLCJfdG9QcmltaXRpdmUiLCJTdHJpbmciLCJpbnB1dCIsImhpbnQiLCJwcmltIiwiU3ltYm9sIiwidG9QcmltaXRpdmUiLCJ1bmRlZmluZWQiLCJyZXMiLCJjYWxsIiwiVHlwZUVycm9yIiwiTnVtYmVyIiwiUGFyc2UiLCJBdXRoIiwiY29uZmlnIiwiY2FjaGVDb250cm9sbGVyIiwiaXNNYXN0ZXIiLCJpc01haW50ZW5hbmNlIiwiaXNSZWFkT25seSIsInVzZXIiLCJpbnN0YWxsYXRpb25JZCIsInVzZXJSb2xlcyIsImZldGNoZWRSb2xlcyIsInJvbGVQcm9taXNlIiwicHJvdG90eXBlIiwiaXNVbmF1dGhlbnRpY2F0ZWQiLCJtYXN0ZXIiLCJtYWludGVuYW5jZSIsInJlYWRPbmx5Iiwibm9ib2R5IiwidGhyb3R0bGUiLCJyZW5ld1Nlc3Npb25JZk5lZWRlZCIsInNlc3Npb24iLCJzZXNzaW9uVG9rZW4iLCJleHRlbmRTZXNzaW9uT25Vc2UiLCJjbGVhclRpbWVvdXQiLCJzZXRUaW1lb3V0IiwiX3Nlc3Npb24iLCJxdWVyeSIsIlJlc3RRdWVyeSIsIm1ldGhvZCIsIk1ldGhvZCIsImdldCIsImF1dGgiLCJydW5CZWZvcmVGaW5kIiwiY2xhc3NOYW1lIiwicmVzdFdoZXJlIiwicmVzdE9wdGlvbnMiLCJsaW1pdCIsInJlc3VsdHMiLCJleGVjdXRlIiwibGFzdFVwZGF0ZWQiLCJEYXRlIiwidXBkYXRlZEF0IiwieWVzdGVyZGF5Iiwic2V0RGF0ZSIsImdldERhdGUiLCJleHBpcmVzQXQiLCJnZW5lcmF0ZVNlc3Npb25FeHBpcmVzQXQiLCJSZXN0V3JpdGUiLCJvYmplY3RJZCIsIl9lbmNvZGUiLCJlIiwiY29kZSIsIkVycm9yIiwiT0JKRUNUX05PVF9GT1VORCIsImxvZ2dlciIsImVycm9yIiwiZ2V0QXV0aEZvclNlc3Npb25Ub2tlbiIsInVzZXJKU09OIiwiY2FjaGVkVXNlciIsImZyb21KU09OIiwiUHJvbWlzZSIsInJlc29sdmUiLCJpbmNsdWRlIiwiUXVlcnkiLCJTZXNzaW9uIiwiZXF1YWxUbyIsImZpbmQiLCJ1c2VNYXN0ZXJLZXkiLCJtYXAiLCJ0b0pTT04iLCJJTlZBTElEX1NFU1NJT05fVE9LRU4iLCJub3ciLCJpc28iLCJzdGFydHNXaXRoIiwiSU5URVJOQUxfU0VSVkVSX0VSUk9SIiwicGFzc3dvcmQiLCJwdXQiLCJ1c2VyT2JqZWN0IiwiZ2V0QXV0aEZvckxlZ2FjeVNlc3Npb25Ub2tlbiIsIl9zZXNzaW9uX3Rva2VuIiwidGhlbiIsInJlc3BvbnNlIiwiZ2V0VXNlclJvbGVzIiwiX2xvYWRSb2xlcyIsImdldFJvbGVzRm9yVXNlciIsInVzZXJzIiwiX190eXBlIiwiaWQiLCJlYWNoIiwicmVzdWx0IiwiUm9sZSIsImNhY2hlZFJvbGVzIiwicm9sZSIsImNhY2hlUm9sZXMiLCJyb2xlc01hcCIsInJlZHVjZSIsIm0iLCJyIiwibmFtZXMiLCJuYW1lIiwiaWRzIiwicm9sZU5hbWVzIiwiX2dldEFsbFJvbGVzTmFtZXNGb3JSb2xlSWRzIiwiQXJyYXkiLCJjbGVhclJvbGVDYWNoZSIsImRlbCIsImdldFJvbGVzQnlJZHMiLCJpbnMiLCJjb250YWluZWRJbiIsInJvbGVzIiwiJGluIiwicm9sZUlEcyIsInF1ZXJpZWRSb2xlcyIsInJvbGVJRCIsIndhc1F1ZXJpZWQiLCJTZXQiLCJyZXN1bHRNYXAiLCJtZW1vIiwiY29uY2F0IiwiZmluZFVzZXJzV2l0aEF1dGhEYXRhIiwiYXV0aERhdGEiLCJwcm92aWRlcnMiLCJwcm92aWRlciIsInF1ZXJ5S2V5IiwicSIsImRhdGFiYXNlIiwiJG9yIiwiaGFzTXV0YXRlZEF1dGhEYXRhIiwidXNlckF1dGhEYXRhIiwibXV0YXRlZEF1dGhEYXRhIiwicHJvdmlkZXJEYXRhIiwidXNlclByb3ZpZGVyQXV0aERhdGEiLCJpc0RlZXBTdHJpY3RFcXVhbCIsImNoZWNrSWZVc2VySGFzUHJvdmlkZWRDb25maWd1cmVkUHJvdmlkZXJzRm9yTG9naW4iLCJyZXEiLCJzYXZlZFVzZXJQcm92aWRlcnMiLCJhZGFwdGVyIiwiYXV0aERhdGFNYW5hZ2VyIiwiZ2V0VmFsaWRhdG9yRm9yUHJvdmlkZXIiLCJoYXNQcm92aWRlZEFTb2xvUHJvdmlkZXIiLCJzb21lIiwicG9saWN5IiwiYWRkaXRpb25Qcm92aWRlcnNOb3RGb3VuZCIsImhhc1Byb3ZpZGVkQXRMZWFzdE9uZUFkZGl0aW9uYWxQcm92aWRlciIsInJlcXVlc3RPYmplY3QiLCJpcCIsIk9USEVSX0NBVVNFIiwiam9pbiIsImhhbmRsZUF1dGhEYXRhVmFsaWRhdGlvbiIsImZvdW5kVXNlciIsIlVzZXIiLCJnZXRVc2VySWQiLCJmZXRjaCIsInVwZGF0ZWRPYmplY3QiLCJidWlsZFBhcnNlT2JqZWN0cyIsImdldFJlcXVlc3RPYmplY3QiLCJhY2MiLCJhdXRoRGF0YVJlc3BvbnNlIiwiYXV0aEtleXMiLCJzb3J0IiwidmFsaWRhdG9yIiwiYXV0aFByb3ZpZGVyIiwiZW5hYmxlZCIsIkRlcHJlY2F0b3IiLCJsb2dSdW50aW1lRGVwcmVjYXRpb24iLCJ1c2FnZSIsInNvbHV0aW9uIiwiVU5TVVBQT1JURURfU0VSVklDRSIsInZhbGlkYXRpb25SZXN1bHQiLCJ0cmlnZ2VyTmFtZSIsImRvTm90U2F2ZSIsInNhdmUiLCJlcnIiLCJyZXNvbHZlRXJyb3IiLCJTQ1JJUFRfRkFJTEVEIiwibWVzc2FnZSIsInVzZXJTdHJpbmciLCJkYXRhIiwiSlNPTiIsInN0cmluZ2lmeSIsImF1dGhlbnRpY2F0aW9uU3RlcCIsIm1vZHVsZSIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi9zcmMvQXV0aC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBQYXJzZSA9IHJlcXVpcmUoJ3BhcnNlL25vZGUnKTtcbmltcG9ydCB7IGlzRGVlcFN0cmljdEVxdWFsIH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgeyBnZXRSZXF1ZXN0T2JqZWN0LCByZXNvbHZlRXJyb3IgfSBmcm9tICcuL3RyaWdnZXJzJztcbmltcG9ydCBEZXByZWNhdG9yIGZyb20gJy4vRGVwcmVjYXRvci9EZXByZWNhdG9yJztcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4vbG9nZ2VyJztcbmltcG9ydCBSZXN0UXVlcnkgZnJvbSAnLi9SZXN0UXVlcnknO1xuaW1wb3J0IFJlc3RXcml0ZSBmcm9tICcuL1Jlc3RXcml0ZSc7XG5cbi8vIEFuIEF1dGggb2JqZWN0IHRlbGxzIHlvdSB3aG8gaXMgcmVxdWVzdGluZyBzb21ldGhpbmcgYW5kIHdoZXRoZXJcbi8vIHRoZSBtYXN0ZXIga2V5IHdhcyB1c2VkLlxuLy8gdXNlck9iamVjdCBpcyBhIFBhcnNlLlVzZXIgYW5kIGNhbiBiZSBudWxsIGlmIHRoZXJlJ3Mgbm8gdXNlci5cbmZ1bmN0aW9uIEF1dGgoe1xuICBjb25maWcsXG4gIGNhY2hlQ29udHJvbGxlciA9IHVuZGVmaW5lZCxcbiAgaXNNYXN0ZXIgPSBmYWxzZSxcbiAgaXNNYWludGVuYW5jZSA9IGZhbHNlLFxuICBpc1JlYWRPbmx5ID0gZmFsc2UsXG4gIHVzZXIsXG4gIGluc3RhbGxhdGlvbklkLFxufSkge1xuICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgdGhpcy5jYWNoZUNvbnRyb2xsZXIgPSBjYWNoZUNvbnRyb2xsZXIgfHwgKGNvbmZpZyAmJiBjb25maWcuY2FjaGVDb250cm9sbGVyKTtcbiAgdGhpcy5pbnN0YWxsYXRpb25JZCA9IGluc3RhbGxhdGlvbklkO1xuICB0aGlzLmlzTWFzdGVyID0gaXNNYXN0ZXI7XG4gIHRoaXMuaXNNYWludGVuYW5jZSA9IGlzTWFpbnRlbmFuY2U7XG4gIHRoaXMudXNlciA9IHVzZXI7XG4gIHRoaXMuaXNSZWFkT25seSA9IGlzUmVhZE9ubHk7XG5cbiAgLy8gQXNzdW1pbmcgYSB1c2VycyByb2xlcyB3b24ndCBjaGFuZ2UgZHVyaW5nIGEgc2luZ2xlIHJlcXVlc3QsIHdlJ2xsXG4gIC8vIG9ubHkgbG9hZCB0aGVtIG9uY2UuXG4gIHRoaXMudXNlclJvbGVzID0gW107XG4gIHRoaXMuZmV0Y2hlZFJvbGVzID0gZmFsc2U7XG4gIHRoaXMucm9sZVByb21pc2UgPSBudWxsO1xufVxuXG4vLyBXaGV0aGVyIHRoaXMgYXV0aCBjb3VsZCBwb3NzaWJseSBtb2RpZnkgdGhlIGdpdmVuIHVzZXIgaWQuXG4vLyBJdCBzdGlsbCBjb3VsZCBiZSBmb3JiaWRkZW4gdmlhIEFDTHMgZXZlbiBpZiB0aGlzIHJldHVybnMgdHJ1ZS5cbkF1dGgucHJvdG90eXBlLmlzVW5hdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5pc01hc3Rlcikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAodGhpcy5pc01haW50ZW5hbmNlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh0aGlzLnVzZXIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyBBIGhlbHBlciB0byBnZXQgYSBtYXN0ZXItbGV2ZWwgQXV0aCBvYmplY3RcbmZ1bmN0aW9uIG1hc3Rlcihjb25maWcpIHtcbiAgcmV0dXJuIG5ldyBBdXRoKHsgY29uZmlnLCBpc01hc3RlcjogdHJ1ZSB9KTtcbn1cblxuLy8gQSBoZWxwZXIgdG8gZ2V0IGEgbWFpbnRlbmFuY2UtbGV2ZWwgQXV0aCBvYmplY3RcbmZ1bmN0aW9uIG1haW50ZW5hbmNlKGNvbmZpZykge1xuICByZXR1cm4gbmV3IEF1dGgoeyBjb25maWcsIGlzTWFpbnRlbmFuY2U6IHRydWUgfSk7XG59XG5cbi8vIEEgaGVscGVyIHRvIGdldCBhIG1hc3Rlci1sZXZlbCBBdXRoIG9iamVjdFxuZnVuY3Rpb24gcmVhZE9ubHkoY29uZmlnKSB7XG4gIHJldHVybiBuZXcgQXV0aCh7IGNvbmZpZywgaXNNYXN0ZXI6IHRydWUsIGlzUmVhZE9ubHk6IHRydWUgfSk7XG59XG5cbi8vIEEgaGVscGVyIHRvIGdldCBhIG5vYm9keS1sZXZlbCBBdXRoIG9iamVjdFxuZnVuY3Rpb24gbm9ib2R5KGNvbmZpZykge1xuICByZXR1cm4gbmV3IEF1dGgoeyBjb25maWcsIGlzTWFzdGVyOiBmYWxzZSB9KTtcbn1cblxuY29uc3QgdGhyb3R0bGUgPSB7fTtcbmNvbnN0IHJlbmV3U2Vzc2lvbklmTmVlZGVkID0gYXN5bmMgKHsgY29uZmlnLCBzZXNzaW9uLCBzZXNzaW9uVG9rZW4gfSkgPT4ge1xuICBpZiAoIWNvbmZpZz8uZXh0ZW5kU2Vzc2lvbk9uVXNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNsZWFyVGltZW91dCh0aHJvdHRsZVtzZXNzaW9uVG9rZW5dKTtcbiAgdGhyb3R0bGVbc2Vzc2lvblRva2VuXSA9IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpZiAoIXNlc3Npb24pIHtcbiAgICAgICAgY29uc3QgcXVlcnkgPSBhd2FpdCBSZXN0UXVlcnkoe1xuICAgICAgICAgIG1ldGhvZDogUmVzdFF1ZXJ5Lk1ldGhvZC5nZXQsXG4gICAgICAgICAgY29uZmlnLFxuICAgICAgICAgIGF1dGg6IG1hc3Rlcihjb25maWcpLFxuICAgICAgICAgIHJ1bkJlZm9yZUZpbmQ6IGZhbHNlLFxuICAgICAgICAgIGNsYXNzTmFtZTogJ19TZXNzaW9uJyxcbiAgICAgICAgICByZXN0V2hlcmU6IHsgc2Vzc2lvblRva2VuIH0sXG4gICAgICAgICAgcmVzdE9wdGlvbnM6IHsgbGltaXQ6IDEgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHsgcmVzdWx0cyB9ID0gYXdhaXQgcXVlcnkuZXhlY3V0ZSgpO1xuICAgICAgICBzZXNzaW9uID0gcmVzdWx0c1swXTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGxhc3RVcGRhdGVkID0gbmV3IERhdGUoc2Vzc2lvbj8udXBkYXRlZEF0KTtcbiAgICAgIGNvbnN0IHllc3RlcmRheSA9IG5ldyBEYXRlKCk7XG4gICAgICB5ZXN0ZXJkYXkuc2V0RGF0ZSh5ZXN0ZXJkYXkuZ2V0RGF0ZSgpIC0gMSk7XG4gICAgICBpZiAobGFzdFVwZGF0ZWQgPiB5ZXN0ZXJkYXkgfHwgIXNlc3Npb24pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgZXhwaXJlc0F0ID0gY29uZmlnLmdlbmVyYXRlU2Vzc2lvbkV4cGlyZXNBdCgpO1xuICAgICAgYXdhaXQgbmV3IFJlc3RXcml0ZShcbiAgICAgICAgY29uZmlnLFxuICAgICAgICBtYXN0ZXIoY29uZmlnKSxcbiAgICAgICAgJ19TZXNzaW9uJyxcbiAgICAgICAgeyBvYmplY3RJZDogc2Vzc2lvbi5vYmplY3RJZCB9LFxuICAgICAgICB7IGV4cGlyZXNBdDogUGFyc2UuX2VuY29kZShleHBpcmVzQXQpIH1cbiAgICAgICkuZXhlY3V0ZSgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlPy5jb2RlICE9PSBQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5EKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcignQ291bGQgbm90IHVwZGF0ZSBzZXNzaW9uIGV4cGlyeTogJywgZSk7XG4gICAgICB9XG4gICAgfVxuICB9LCA1MDApO1xufTtcblxuLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBBdXRoIG9iamVjdFxuY29uc3QgZ2V0QXV0aEZvclNlc3Npb25Ub2tlbiA9IGFzeW5jIGZ1bmN0aW9uICh7XG4gIGNvbmZpZyxcbiAgY2FjaGVDb250cm9sbGVyLFxuICBzZXNzaW9uVG9rZW4sXG4gIGluc3RhbGxhdGlvbklkLFxufSkge1xuICBjYWNoZUNvbnRyb2xsZXIgPSBjYWNoZUNvbnRyb2xsZXIgfHwgKGNvbmZpZyAmJiBjb25maWcuY2FjaGVDb250cm9sbGVyKTtcbiAgaWYgKGNhY2hlQ29udHJvbGxlcikge1xuICAgIGNvbnN0IHVzZXJKU09OID0gYXdhaXQgY2FjaGVDb250cm9sbGVyLnVzZXIuZ2V0KHNlc3Npb25Ub2tlbik7XG4gICAgaWYgKHVzZXJKU09OKSB7XG4gICAgICBjb25zdCBjYWNoZWRVc2VyID0gUGFyc2UuT2JqZWN0LmZyb21KU09OKHVzZXJKU09OKTtcbiAgICAgIHJlbmV3U2Vzc2lvbklmTmVlZGVkKHsgY29uZmlnLCBzZXNzaW9uVG9rZW4gfSk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFxuICAgICAgICBuZXcgQXV0aCh7XG4gICAgICAgICAgY29uZmlnLFxuICAgICAgICAgIGNhY2hlQ29udHJvbGxlcixcbiAgICAgICAgICBpc01hc3RlcjogZmFsc2UsXG4gICAgICAgICAgaW5zdGFsbGF0aW9uSWQsXG4gICAgICAgICAgdXNlcjogY2FjaGVkVXNlcixcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHJlc3VsdHM7XG4gIGlmIChjb25maWcpIHtcbiAgICBjb25zdCByZXN0T3B0aW9ucyA9IHtcbiAgICAgIGxpbWl0OiAxLFxuICAgICAgaW5jbHVkZTogJ3VzZXInLFxuICAgIH07XG4gICAgY29uc3QgUmVzdFF1ZXJ5ID0gcmVxdWlyZSgnLi9SZXN0UXVlcnknKTtcbiAgICBjb25zdCBxdWVyeSA9IGF3YWl0IFJlc3RRdWVyeSh7XG4gICAgICBtZXRob2Q6IFJlc3RRdWVyeS5NZXRob2QuZ2V0LFxuICAgICAgY29uZmlnLFxuICAgICAgcnVuQmVmb3JlRmluZDogZmFsc2UsXG4gICAgICBhdXRoOiBtYXN0ZXIoY29uZmlnKSxcbiAgICAgIGNsYXNzTmFtZTogJ19TZXNzaW9uJyxcbiAgICAgIHJlc3RXaGVyZTogeyBzZXNzaW9uVG9rZW4gfSxcbiAgICAgIHJlc3RPcHRpb25zLFxuICAgIH0pO1xuICAgIHJlc3VsdHMgPSAoYXdhaXQgcXVlcnkuZXhlY3V0ZSgpKS5yZXN1bHRzO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdHMgPSAoXG4gICAgICBhd2FpdCBuZXcgUGFyc2UuUXVlcnkoUGFyc2UuU2Vzc2lvbilcbiAgICAgICAgLmxpbWl0KDEpXG4gICAgICAgIC5pbmNsdWRlKCd1c2VyJylcbiAgICAgICAgLmVxdWFsVG8oJ3Nlc3Npb25Ub2tlbicsIHNlc3Npb25Ub2tlbilcbiAgICAgICAgLmZpbmQoeyB1c2VNYXN0ZXJLZXk6IHRydWUgfSlcbiAgICApLm1hcChvYmogPT4gb2JqLnRvSlNPTigpKTtcbiAgfVxuXG4gIGlmIChyZXN1bHRzLmxlbmd0aCAhPT0gMSB8fCAhcmVzdWx0c1swXVsndXNlciddKSB7XG4gICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfU0VTU0lPTl9UT0tFTiwgJ0ludmFsaWQgc2Vzc2lvbiB0b2tlbicpO1xuICB9XG4gIGNvbnN0IHNlc3Npb24gPSByZXN1bHRzWzBdO1xuICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLFxuICAgIGV4cGlyZXNBdCA9IHNlc3Npb24uZXhwaXJlc0F0ID8gbmV3IERhdGUoc2Vzc2lvbi5leHBpcmVzQXQuaXNvKSA6IHVuZGVmaW5lZDtcbiAgaWYgKGV4cGlyZXNBdCA8IG5vdykge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX1NFU1NJT05fVE9LRU4sICdTZXNzaW9uIHRva2VuIGlzIGV4cGlyZWQuJyk7XG4gIH1cbiAgY29uc3Qgb2JqID0gc2Vzc2lvbi51c2VyO1xuXG4gIGlmICh0eXBlb2Ygb2JqWydvYmplY3RJZCddID09PSAnc3RyaW5nJyAmJiBvYmpbJ29iamVjdElkJ10uc3RhcnRzV2l0aCgncm9sZTonKSkge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlRFUk5BTF9TRVJWRVJfRVJST1IsICdJbnZhbGlkIG9iamVjdCBJRC4nKTtcbiAgfVxuXG4gIGRlbGV0ZSBvYmoucGFzc3dvcmQ7XG4gIG9ialsnY2xhc3NOYW1lJ10gPSAnX1VzZXInO1xuICBvYmpbJ3Nlc3Npb25Ub2tlbiddID0gc2Vzc2lvblRva2VuO1xuICBpZiAoY2FjaGVDb250cm9sbGVyKSB7XG4gICAgY2FjaGVDb250cm9sbGVyLnVzZXIucHV0KHNlc3Npb25Ub2tlbiwgb2JqKTtcbiAgfVxuICByZW5ld1Nlc3Npb25JZk5lZWRlZCh7IGNvbmZpZywgc2Vzc2lvbiwgc2Vzc2lvblRva2VuIH0pO1xuICBjb25zdCB1c2VyT2JqZWN0ID0gUGFyc2UuT2JqZWN0LmZyb21KU09OKG9iaik7XG4gIHJldHVybiBuZXcgQXV0aCh7XG4gICAgY29uZmlnLFxuICAgIGNhY2hlQ29udHJvbGxlcixcbiAgICBpc01hc3RlcjogZmFsc2UsXG4gICAgaW5zdGFsbGF0aW9uSWQsXG4gICAgdXNlcjogdXNlck9iamVjdCxcbiAgfSk7XG59O1xuXG52YXIgZ2V0QXV0aEZvckxlZ2FjeVNlc3Npb25Ub2tlbiA9IGFzeW5jIGZ1bmN0aW9uICh7IGNvbmZpZywgc2Vzc2lvblRva2VuLCBpbnN0YWxsYXRpb25JZCB9KSB7XG4gIHZhciByZXN0T3B0aW9ucyA9IHtcbiAgICBsaW1pdDogMSxcbiAgfTtcbiAgY29uc3QgUmVzdFF1ZXJ5ID0gcmVxdWlyZSgnLi9SZXN0UXVlcnknKTtcbiAgdmFyIHF1ZXJ5ID0gYXdhaXQgUmVzdFF1ZXJ5KHtcbiAgICBtZXRob2Q6IFJlc3RRdWVyeS5NZXRob2QuZ2V0LFxuICAgIGNvbmZpZyxcbiAgICBydW5CZWZvcmVGaW5kOiBmYWxzZSxcbiAgICBhdXRoOiBtYXN0ZXIoY29uZmlnKSxcbiAgICBjbGFzc05hbWU6ICdfVXNlcicsXG4gICAgcmVzdFdoZXJlOiB7IF9zZXNzaW9uX3Rva2VuOiBzZXNzaW9uVG9rZW4gfSxcbiAgICByZXN0T3B0aW9ucyxcbiAgfSk7XG4gIHJldHVybiBxdWVyeS5leGVjdXRlKCkudGhlbihyZXNwb25zZSA9PiB7XG4gICAgdmFyIHJlc3VsdHMgPSByZXNwb25zZS5yZXN1bHRzO1xuICAgIGlmIChyZXN1bHRzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfU0VTU0lPTl9UT0tFTiwgJ2ludmFsaWQgbGVnYWN5IHNlc3Npb24gdG9rZW4nKTtcbiAgICB9XG4gICAgY29uc3Qgb2JqID0gcmVzdWx0c1swXTtcbiAgICBvYmouY2xhc3NOYW1lID0gJ19Vc2VyJztcbiAgICBjb25zdCB1c2VyT2JqZWN0ID0gUGFyc2UuT2JqZWN0LmZyb21KU09OKG9iaik7XG4gICAgcmV0dXJuIG5ldyBBdXRoKHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGlzTWFzdGVyOiBmYWxzZSxcbiAgICAgIGluc3RhbGxhdGlvbklkLFxuICAgICAgdXNlcjogdXNlck9iamVjdCxcbiAgICB9KTtcbiAgfSk7XG59O1xuXG4vLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIHJvbGUgbmFtZXNcbkF1dGgucHJvdG90eXBlLmdldFVzZXJSb2xlcyA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuaXNNYXN0ZXIgfHwgdGhpcy5pc01haW50ZW5hbmNlIHx8ICF0aGlzLnVzZXIpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuICBpZiAodGhpcy5mZXRjaGVkUm9sZXMpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMudXNlclJvbGVzKTtcbiAgfVxuICBpZiAodGhpcy5yb2xlUHJvbWlzZSkge1xuICAgIHJldHVybiB0aGlzLnJvbGVQcm9taXNlO1xuICB9XG4gIHRoaXMucm9sZVByb21pc2UgPSB0aGlzLl9sb2FkUm9sZXMoKTtcbiAgcmV0dXJuIHRoaXMucm9sZVByb21pc2U7XG59O1xuXG5BdXRoLnByb3RvdHlwZS5nZXRSb2xlc0ZvclVzZXIgPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gIC8vU3RhY2sgYWxsIFBhcnNlLlJvbGVcbiAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICBpZiAodGhpcy5jb25maWcpIHtcbiAgICBjb25zdCByZXN0V2hlcmUgPSB7XG4gICAgICB1c2Vyczoge1xuICAgICAgICBfX3R5cGU6ICdQb2ludGVyJyxcbiAgICAgICAgY2xhc3NOYW1lOiAnX1VzZXInLFxuICAgICAgICBvYmplY3RJZDogdGhpcy51c2VyLmlkLFxuICAgICAgfSxcbiAgICB9O1xuICAgIGNvbnN0IFJlc3RRdWVyeSA9IHJlcXVpcmUoJy4vUmVzdFF1ZXJ5Jyk7XG4gICAgY29uc3QgcXVlcnkgPSBhd2FpdCBSZXN0UXVlcnkoe1xuICAgICAgbWV0aG9kOiBSZXN0UXVlcnkuTWV0aG9kLmZpbmQsXG4gICAgICBydW5CZWZvcmVGaW5kOiBmYWxzZSxcbiAgICAgIGNvbmZpZzogdGhpcy5jb25maWcsXG4gICAgICBhdXRoOiBtYXN0ZXIodGhpcy5jb25maWcpLFxuICAgICAgY2xhc3NOYW1lOiAnX1JvbGUnLFxuICAgICAgcmVzdFdoZXJlLFxuICAgIH0pO1xuICAgIGF3YWl0IHF1ZXJ5LmVhY2gocmVzdWx0ID0+IHJlc3VsdHMucHVzaChyZXN1bHQpKTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBuZXcgUGFyc2UuUXVlcnkoUGFyc2UuUm9sZSlcbiAgICAgIC5lcXVhbFRvKCd1c2VycycsIHRoaXMudXNlcilcbiAgICAgIC5lYWNoKHJlc3VsdCA9PiByZXN1bHRzLnB1c2gocmVzdWx0LnRvSlNPTigpKSwgeyB1c2VNYXN0ZXJLZXk6IHRydWUgfSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG4vLyBJdGVyYXRlcyB0aHJvdWdoIHRoZSByb2xlIHRyZWUgYW5kIGNvbXBpbGVzIGEgdXNlcidzIHJvbGVzXG5BdXRoLnByb3RvdHlwZS5fbG9hZFJvbGVzID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5jYWNoZUNvbnRyb2xsZXIpIHtcbiAgICBjb25zdCBjYWNoZWRSb2xlcyA9IGF3YWl0IHRoaXMuY2FjaGVDb250cm9sbGVyLnJvbGUuZ2V0KHRoaXMudXNlci5pZCk7XG4gICAgaWYgKGNhY2hlZFJvbGVzICE9IG51bGwpIHtcbiAgICAgIHRoaXMuZmV0Y2hlZFJvbGVzID0gdHJ1ZTtcbiAgICAgIHRoaXMudXNlclJvbGVzID0gY2FjaGVkUm9sZXM7XG4gICAgICByZXR1cm4gY2FjaGVkUm9sZXM7XG4gICAgfVxuICB9XG5cbiAgLy8gRmlyc3QgZ2V0IHRoZSByb2xlIGlkcyB0aGlzIHVzZXIgaXMgZGlyZWN0bHkgYSBtZW1iZXIgb2ZcbiAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMuZ2V0Um9sZXNGb3JVc2VyKCk7XG4gIGlmICghcmVzdWx0cy5sZW5ndGgpIHtcbiAgICB0aGlzLnVzZXJSb2xlcyA9IFtdO1xuICAgIHRoaXMuZmV0Y2hlZFJvbGVzID0gdHJ1ZTtcbiAgICB0aGlzLnJvbGVQcm9taXNlID0gbnVsbDtcblxuICAgIHRoaXMuY2FjaGVSb2xlcygpO1xuICAgIHJldHVybiB0aGlzLnVzZXJSb2xlcztcbiAgfVxuXG4gIGNvbnN0IHJvbGVzTWFwID0gcmVzdWx0cy5yZWR1Y2UoXG4gICAgKG0sIHIpID0+IHtcbiAgICAgIG0ubmFtZXMucHVzaChyLm5hbWUpO1xuICAgICAgbS5pZHMucHVzaChyLm9iamVjdElkKTtcbiAgICAgIHJldHVybiBtO1xuICAgIH0sXG4gICAgeyBpZHM6IFtdLCBuYW1lczogW10gfVxuICApO1xuXG4gIC8vIHJ1biB0aGUgcmVjdXJzaXZlIGZpbmRpbmdcbiAgY29uc3Qgcm9sZU5hbWVzID0gYXdhaXQgdGhpcy5fZ2V0QWxsUm9sZXNOYW1lc0ZvclJvbGVJZHMocm9sZXNNYXAuaWRzLCByb2xlc01hcC5uYW1lcyk7XG4gIHRoaXMudXNlclJvbGVzID0gcm9sZU5hbWVzLm1hcChyID0+IHtcbiAgICByZXR1cm4gJ3JvbGU6JyArIHI7XG4gIH0pO1xuICB0aGlzLmZldGNoZWRSb2xlcyA9IHRydWU7XG4gIHRoaXMucm9sZVByb21pc2UgPSBudWxsO1xuICB0aGlzLmNhY2hlUm9sZXMoKTtcbiAgcmV0dXJuIHRoaXMudXNlclJvbGVzO1xufTtcblxuQXV0aC5wcm90b3R5cGUuY2FjaGVSb2xlcyA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKCF0aGlzLmNhY2hlQ29udHJvbGxlcikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB0aGlzLmNhY2hlQ29udHJvbGxlci5yb2xlLnB1dCh0aGlzLnVzZXIuaWQsIEFycmF5KC4uLnRoaXMudXNlclJvbGVzKSk7XG4gIHJldHVybiB0cnVlO1xufTtcblxuQXV0aC5wcm90b3R5cGUuY2xlYXJSb2xlQ2FjaGUgPSBmdW5jdGlvbiAoc2Vzc2lvblRva2VuKSB7XG4gIGlmICghdGhpcy5jYWNoZUNvbnRyb2xsZXIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdGhpcy5jYWNoZUNvbnRyb2xsZXIucm9sZS5kZWwodGhpcy51c2VyLmlkKTtcbiAgdGhpcy5jYWNoZUNvbnRyb2xsZXIudXNlci5kZWwoc2Vzc2lvblRva2VuKTtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5BdXRoLnByb3RvdHlwZS5nZXRSb2xlc0J5SWRzID0gYXN5bmMgZnVuY3Rpb24gKGlucykge1xuICBjb25zdCByZXN1bHRzID0gW107XG4gIC8vIEJ1aWxkIGFuIE9SIHF1ZXJ5IGFjcm9zcyBhbGwgcGFyZW50Um9sZXNcbiAgaWYgKCF0aGlzLmNvbmZpZykge1xuICAgIGF3YWl0IG5ldyBQYXJzZS5RdWVyeShQYXJzZS5Sb2xlKVxuICAgICAgLmNvbnRhaW5lZEluKFxuICAgICAgICAncm9sZXMnLFxuICAgICAgICBpbnMubWFwKGlkID0+IHtcbiAgICAgICAgICBjb25zdCByb2xlID0gbmV3IFBhcnNlLk9iamVjdChQYXJzZS5Sb2xlKTtcbiAgICAgICAgICByb2xlLmlkID0gaWQ7XG4gICAgICAgICAgcmV0dXJuIHJvbGU7XG4gICAgICAgIH0pXG4gICAgICApXG4gICAgICAuZWFjaChyZXN1bHQgPT4gcmVzdWx0cy5wdXNoKHJlc3VsdC50b0pTT04oKSksIHsgdXNlTWFzdGVyS2V5OiB0cnVlIH0pO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHJvbGVzID0gaW5zLm1hcChpZCA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBfX3R5cGU6ICdQb2ludGVyJyxcbiAgICAgICAgY2xhc3NOYW1lOiAnX1JvbGUnLFxuICAgICAgICBvYmplY3RJZDogaWQsXG4gICAgICB9O1xuICAgIH0pO1xuICAgIGNvbnN0IHJlc3RXaGVyZSA9IHsgcm9sZXM6IHsgJGluOiByb2xlcyB9IH07XG4gICAgY29uc3QgUmVzdFF1ZXJ5ID0gcmVxdWlyZSgnLi9SZXN0UXVlcnknKTtcbiAgICBjb25zdCBxdWVyeSA9IGF3YWl0IFJlc3RRdWVyeSh7XG4gICAgICBtZXRob2Q6IFJlc3RRdWVyeS5NZXRob2QuZmluZCxcbiAgICAgIGNvbmZpZzogdGhpcy5jb25maWcsXG4gICAgICBydW5CZWZvcmVGaW5kOiBmYWxzZSxcbiAgICAgIGF1dGg6IG1hc3Rlcih0aGlzLmNvbmZpZyksXG4gICAgICBjbGFzc05hbWU6ICdfUm9sZScsXG4gICAgICByZXN0V2hlcmUsXG4gICAgfSk7XG4gICAgYXdhaXQgcXVlcnkuZWFjaChyZXN1bHQgPT4gcmVzdWx0cy5wdXNoKHJlc3VsdCkpO1xuICB9XG4gIHJldHVybiByZXN1bHRzO1xufTtcblxuLy8gR2l2ZW4gYSBsaXN0IG9mIHJvbGVJZHMsIGZpbmQgYWxsIHRoZSBwYXJlbnQgcm9sZXMsIHJldHVybnMgYSBwcm9taXNlIHdpdGggYWxsIG5hbWVzXG5BdXRoLnByb3RvdHlwZS5fZ2V0QWxsUm9sZXNOYW1lc0ZvclJvbGVJZHMgPSBmdW5jdGlvbiAocm9sZUlEcywgbmFtZXMgPSBbXSwgcXVlcmllZFJvbGVzID0ge30pIHtcbiAgY29uc3QgaW5zID0gcm9sZUlEcy5maWx0ZXIocm9sZUlEID0+IHtcbiAgICBjb25zdCB3YXNRdWVyaWVkID0gcXVlcmllZFJvbGVzW3JvbGVJRF0gIT09IHRydWU7XG4gICAgcXVlcmllZFJvbGVzW3JvbGVJRF0gPSB0cnVlO1xuICAgIHJldHVybiB3YXNRdWVyaWVkO1xuICB9KTtcblxuICAvLyBhbGwgcm9sZXMgYXJlIGFjY291bnRlZCBmb3IsIHJldHVybiB0aGUgbmFtZXNcbiAgaWYgKGlucy5sZW5ndGggPT0gMCkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoWy4uLm5ldyBTZXQobmFtZXMpXSk7XG4gIH1cblxuICByZXR1cm4gdGhpcy5nZXRSb2xlc0J5SWRzKGlucylcbiAgICAudGhlbihyZXN1bHRzID0+IHtcbiAgICAgIC8vIE5vdGhpbmcgZm91bmRcbiAgICAgIGlmICghcmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShuYW1lcyk7XG4gICAgICB9XG4gICAgICAvLyBNYXAgdGhlIHJlc3VsdHMgd2l0aCBhbGwgSWRzIGFuZCBuYW1lc1xuICAgICAgY29uc3QgcmVzdWx0TWFwID0gcmVzdWx0cy5yZWR1Y2UoXG4gICAgICAgIChtZW1vLCByb2xlKSA9PiB7XG4gICAgICAgICAgbWVtby5uYW1lcy5wdXNoKHJvbGUubmFtZSk7XG4gICAgICAgICAgbWVtby5pZHMucHVzaChyb2xlLm9iamVjdElkKTtcbiAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSxcbiAgICAgICAgeyBpZHM6IFtdLCBuYW1lczogW10gfVxuICAgICAgKTtcbiAgICAgIC8vIHN0b3JlIHRoZSBuZXcgZm91bmQgbmFtZXNcbiAgICAgIG5hbWVzID0gbmFtZXMuY29uY2F0KHJlc3VsdE1hcC5uYW1lcyk7XG4gICAgICAvLyBmaW5kIHRoZSBuZXh0IG9uZXMsIGNpcmN1bGFyIHJvbGVzIHdpbGwgYmUgY3V0XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0QWxsUm9sZXNOYW1lc0ZvclJvbGVJZHMocmVzdWx0TWFwLmlkcywgbmFtZXMsIHF1ZXJpZWRSb2xlcyk7XG4gICAgfSlcbiAgICAudGhlbihuYW1lcyA9PiB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFsuLi5uZXcgU2V0KG5hbWVzKV0pO1xuICAgIH0pO1xufTtcblxuY29uc3QgZmluZFVzZXJzV2l0aEF1dGhEYXRhID0gKGNvbmZpZywgYXV0aERhdGEpID0+IHtcbiAgY29uc3QgcHJvdmlkZXJzID0gT2JqZWN0LmtleXMoYXV0aERhdGEpO1xuICBjb25zdCBxdWVyeSA9IHByb3ZpZGVyc1xuICAgIC5yZWR1Y2UoKG1lbW8sIHByb3ZpZGVyKSA9PiB7XG4gICAgICBpZiAoIWF1dGhEYXRhW3Byb3ZpZGVyXSB8fCAoYXV0aERhdGEgJiYgIWF1dGhEYXRhW3Byb3ZpZGVyXS5pZCkpIHtcbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICB9XG4gICAgICBjb25zdCBxdWVyeUtleSA9IGBhdXRoRGF0YS4ke3Byb3ZpZGVyfS5pZGA7XG4gICAgICBjb25zdCBxdWVyeSA9IHt9O1xuICAgICAgcXVlcnlbcXVlcnlLZXldID0gYXV0aERhdGFbcHJvdmlkZXJdLmlkO1xuICAgICAgbWVtby5wdXNoKHF1ZXJ5KTtcbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIFtdKVxuICAgIC5maWx0ZXIocSA9PiB7XG4gICAgICByZXR1cm4gdHlwZW9mIHEgIT09ICd1bmRlZmluZWQnO1xuICAgIH0pO1xuXG4gIHJldHVybiBxdWVyeS5sZW5ndGggPiAwXG4gICAgPyBjb25maWcuZGF0YWJhc2UuZmluZCgnX1VzZXInLCB7ICRvcjogcXVlcnkgfSwgeyBsaW1pdDogMiB9KVxuICAgIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbn07XG5cbmNvbnN0IGhhc011dGF0ZWRBdXRoRGF0YSA9IChhdXRoRGF0YSwgdXNlckF1dGhEYXRhKSA9PiB7XG4gIGlmICghdXNlckF1dGhEYXRhKSByZXR1cm4geyBoYXNNdXRhdGVkQXV0aERhdGE6IHRydWUsIG11dGF0ZWRBdXRoRGF0YTogYXV0aERhdGEgfTtcbiAgY29uc3QgbXV0YXRlZEF1dGhEYXRhID0ge307XG4gIE9iamVjdC5rZXlzKGF1dGhEYXRhKS5mb3JFYWNoKHByb3ZpZGVyID0+IHtcbiAgICAvLyBBbm9ueW1vdXMgcHJvdmlkZXIgaXMgbm90IGhhbmRsZWQgdGhpcyB3YXlcbiAgICBpZiAocHJvdmlkZXIgPT09ICdhbm9ueW1vdXMnKSByZXR1cm47XG4gICAgY29uc3QgcHJvdmlkZXJEYXRhID0gYXV0aERhdGFbcHJvdmlkZXJdO1xuICAgIGNvbnN0IHVzZXJQcm92aWRlckF1dGhEYXRhID0gdXNlckF1dGhEYXRhW3Byb3ZpZGVyXTtcbiAgICBpZiAoIWlzRGVlcFN0cmljdEVxdWFsKHByb3ZpZGVyRGF0YSwgdXNlclByb3ZpZGVyQXV0aERhdGEpKSB7XG4gICAgICBtdXRhdGVkQXV0aERhdGFbcHJvdmlkZXJdID0gcHJvdmlkZXJEYXRhO1xuICAgIH1cbiAgfSk7XG4gIGNvbnN0IGhhc011dGF0ZWRBdXRoRGF0YSA9IE9iamVjdC5rZXlzKG11dGF0ZWRBdXRoRGF0YSkubGVuZ3RoICE9PSAwO1xuICByZXR1cm4geyBoYXNNdXRhdGVkQXV0aERhdGEsIG11dGF0ZWRBdXRoRGF0YSB9O1xufTtcblxuY29uc3QgY2hlY2tJZlVzZXJIYXNQcm92aWRlZENvbmZpZ3VyZWRQcm92aWRlcnNGb3JMb2dpbiA9IChcbiAgcmVxID0ge30sXG4gIGF1dGhEYXRhID0ge30sXG4gIHVzZXJBdXRoRGF0YSA9IHt9LFxuICBjb25maWdcbikgPT4ge1xuICBjb25zdCBzYXZlZFVzZXJQcm92aWRlcnMgPSBPYmplY3Qua2V5cyh1c2VyQXV0aERhdGEpLm1hcChwcm92aWRlciA9PiAoe1xuICAgIG5hbWU6IHByb3ZpZGVyLFxuICAgIGFkYXB0ZXI6IGNvbmZpZy5hdXRoRGF0YU1hbmFnZXIuZ2V0VmFsaWRhdG9yRm9yUHJvdmlkZXIocHJvdmlkZXIpLmFkYXB0ZXIsXG4gIH0pKTtcblxuICBjb25zdCBoYXNQcm92aWRlZEFTb2xvUHJvdmlkZXIgPSBzYXZlZFVzZXJQcm92aWRlcnMuc29tZShcbiAgICBwcm92aWRlciA9PlxuICAgICAgcHJvdmlkZXIgJiYgcHJvdmlkZXIuYWRhcHRlciAmJiBwcm92aWRlci5hZGFwdGVyLnBvbGljeSA9PT0gJ3NvbG8nICYmIGF1dGhEYXRhW3Byb3ZpZGVyLm5hbWVdXG4gICk7XG5cbiAgLy8gU29sbyBwcm92aWRlcnMgY2FuIGJlIGNvbnNpZGVyZWQgYXMgc2FmZSwgc28gd2UgZG8gbm90IGhhdmUgdG8gY2hlY2sgaWYgdGhlIHVzZXIgbmVlZHNcbiAgLy8gdG8gcHJvdmlkZSBhbiBhZGRpdGlvbmFsIHByb3ZpZGVyIHRvIGxvZ2luLiBBbiBhdXRoIGFkYXB0ZXIgd2l0aCBcInNvbG9cIiAobGlrZSB3ZWJhdXRobikgbWVhbnNcbiAgLy8gbm8gXCJhZGRpdGlvbmFsXCIgYXV0aCBuZWVkcyB0byBiZSBwcm92aWRlZCB0byBsb2dpbiAobGlrZSBPVFAsIE1GQSlcbiAgaWYgKGhhc1Byb3ZpZGVkQVNvbG9Qcm92aWRlcikge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGFkZGl0aW9uUHJvdmlkZXJzTm90Rm91bmQgPSBbXTtcbiAgY29uc3QgaGFzUHJvdmlkZWRBdExlYXN0T25lQWRkaXRpb25hbFByb3ZpZGVyID0gc2F2ZWRVc2VyUHJvdmlkZXJzLnNvbWUocHJvdmlkZXIgPT4ge1xuICAgIGxldCBwb2xpY3kgPSBwcm92aWRlci5hZGFwdGVyLnBvbGljeTtcbiAgICBpZiAodHlwZW9mIHBvbGljeSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY29uc3QgcmVxdWVzdE9iamVjdCA9IHtcbiAgICAgICAgaXA6IHJlcS5jb25maWcuaXAsXG4gICAgICAgIHVzZXI6IHJlcS5hdXRoLnVzZXIsXG4gICAgICAgIG1hc3RlcjogcmVxLmF1dGguaXNNYXN0ZXIsXG4gICAgICB9O1xuICAgICAgcG9saWN5ID0gcG9saWN5LmNhbGwocHJvdmlkZXIuYWRhcHRlciwgcmVxdWVzdE9iamVjdCwgdXNlckF1dGhEYXRhW3Byb3ZpZGVyLm5hbWVdKTtcbiAgICB9XG4gICAgaWYgKHBvbGljeSA9PT0gJ2FkZGl0aW9uYWwnKSB7XG4gICAgICBpZiAoYXV0aERhdGFbcHJvdmlkZXIubmFtZV0pIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBQdXNoIG1pc3NpbmcgcHJvdmlkZXIgZm9yIGVycm9yIG1lc3NhZ2VcbiAgICAgICAgYWRkaXRpb25Qcm92aWRlcnNOb3RGb3VuZC5wdXNoKHByb3ZpZGVyLm5hbWUpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIGlmIChoYXNQcm92aWRlZEF0TGVhc3RPbmVBZGRpdGlvbmFsUHJvdmlkZXIgfHwgIWFkZGl0aW9uUHJvdmlkZXJzTm90Rm91bmQubGVuZ3RoKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgIFBhcnNlLkVycm9yLk9USEVSX0NBVVNFLFxuICAgIGBNaXNzaW5nIGFkZGl0aW9uYWwgYXV0aERhdGEgJHthZGRpdGlvblByb3ZpZGVyc05vdEZvdW5kLmpvaW4oJywnKX1gXG4gICk7XG59O1xuXG4vLyBWYWxpZGF0ZSBlYWNoIGF1dGhEYXRhIHN0ZXAtYnktc3RlcCBhbmQgcmV0dXJuIHRoZSBwcm92aWRlciByZXNwb25zZXNcbmNvbnN0IGhhbmRsZUF1dGhEYXRhVmFsaWRhdGlvbiA9IGFzeW5jIChhdXRoRGF0YSwgcmVxLCBmb3VuZFVzZXIpID0+IHtcbiAgbGV0IHVzZXI7XG4gIGlmIChmb3VuZFVzZXIpIHtcbiAgICB1c2VyID0gUGFyc2UuVXNlci5mcm9tSlNPTih7IGNsYXNzTmFtZTogJ19Vc2VyJywgLi4uZm91bmRVc2VyIH0pO1xuICAgIC8vIEZpbmQgdXNlciBieSBzZXNzaW9uIGFuZCBjdXJyZW50IG9iamVjdElkOyBvbmx5IHBhc3MgdXNlciBpZiBpdCdzIHRoZSBjdXJyZW50IHVzZXIgb3IgbWFzdGVyIGtleSBpcyBwcm92aWRlZFxuICB9IGVsc2UgaWYgKFxuICAgIChyZXEuYXV0aCAmJlxuICAgICAgcmVxLmF1dGgudXNlciAmJlxuICAgICAgdHlwZW9mIHJlcS5nZXRVc2VySWQgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIHJlcS5nZXRVc2VySWQoKSA9PT0gcmVxLmF1dGgudXNlci5pZCkgfHxcbiAgICAocmVxLmF1dGggJiYgcmVxLmF1dGguaXNNYXN0ZXIgJiYgdHlwZW9mIHJlcS5nZXRVc2VySWQgPT09ICdmdW5jdGlvbicgJiYgcmVxLmdldFVzZXJJZCgpKVxuICApIHtcbiAgICB1c2VyID0gbmV3IFBhcnNlLlVzZXIoKTtcbiAgICB1c2VyLmlkID0gcmVxLmF1dGguaXNNYXN0ZXIgPyByZXEuZ2V0VXNlcklkKCkgOiByZXEuYXV0aC51c2VyLmlkO1xuICAgIGF3YWl0IHVzZXIuZmV0Y2goeyB1c2VNYXN0ZXJLZXk6IHRydWUgfSk7XG4gIH1cblxuICBjb25zdCB7IHVwZGF0ZWRPYmplY3QgfSA9IHJlcS5idWlsZFBhcnNlT2JqZWN0cygpO1xuICBjb25zdCByZXF1ZXN0T2JqZWN0ID0gZ2V0UmVxdWVzdE9iamVjdCh1bmRlZmluZWQsIHJlcS5hdXRoLCB1cGRhdGVkT2JqZWN0LCB1c2VyLCByZXEuY29uZmlnKTtcbiAgLy8gUGVyZm9ybSB2YWxpZGF0aW9uIGFzIHN0ZXAtYnktc3RlcCBwaXBlbGluZSBmb3IgYmV0dGVyIGVycm9yIGNvbnNpc3RlbmN5XG4gIC8vIGFuZCBhbHNvIHRvIGF2b2lkIHRvIHRyaWdnZXIgYSBwcm92aWRlciAobGlrZSBPVFAgU01TKSBpZiBhbm90aGVyIG9uZSBmYWlsc1xuICBjb25zdCBhY2MgPSB7IGF1dGhEYXRhOiB7fSwgYXV0aERhdGFSZXNwb25zZToge30gfTtcbiAgY29uc3QgYXV0aEtleXMgPSBPYmplY3Qua2V5cyhhdXRoRGF0YSkuc29ydCgpO1xuICBmb3IgKGNvbnN0IHByb3ZpZGVyIG9mIGF1dGhLZXlzKSB7XG4gICAgbGV0IG1ldGhvZCA9ICcnO1xuICAgIHRyeSB7XG4gICAgICBpZiAoYXV0aERhdGFbcHJvdmlkZXJdID09PSBudWxsKSB7XG4gICAgICAgIGFjYy5hdXRoRGF0YVtwcm92aWRlcl0gPSBudWxsO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHsgdmFsaWRhdG9yIH0gPSByZXEuY29uZmlnLmF1dGhEYXRhTWFuYWdlci5nZXRWYWxpZGF0b3JGb3JQcm92aWRlcihwcm92aWRlcik7XG4gICAgICBjb25zdCBhdXRoUHJvdmlkZXIgPSAocmVxLmNvbmZpZy5hdXRoIHx8IHt9KVtwcm92aWRlcl0gfHwge307XG4gICAgICBpZiAoYXV0aFByb3ZpZGVyLmVuYWJsZWQgPT0gbnVsbCkge1xuICAgICAgICBEZXByZWNhdG9yLmxvZ1J1bnRpbWVEZXByZWNhdGlvbih7XG4gICAgICAgICAgdXNhZ2U6IGBVc2luZyB0aGUgYXV0aGVudGljYXRpb24gYWRhcHRlciBcIiR7cHJvdmlkZXJ9XCIgd2l0aG91dCBleHBsaWNpdGx5IGVuYWJsaW5nIGl0YCxcbiAgICAgICAgICBzb2x1dGlvbjogYEVuYWJsZSB0aGUgYXV0aGVudGljYXRpb24gYWRhcHRlciBieSBzZXR0aW5nIHRoZSBQYXJzZSBTZXJ2ZXIgb3B0aW9uIFwiYXV0aC4ke3Byb3ZpZGVyfS5lbmFibGVkOiB0cnVlXCIuYCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAoIXZhbGlkYXRvciB8fCBhdXRoUHJvdmlkZXIuZW5hYmxlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgIFBhcnNlLkVycm9yLlVOU1VQUE9SVEVEX1NFUlZJQ0UsXG4gICAgICAgICAgJ1RoaXMgYXV0aGVudGljYXRpb24gbWV0aG9kIGlzIHVuc3VwcG9ydGVkLidcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGxldCB2YWxpZGF0aW9uUmVzdWx0ID0gYXdhaXQgdmFsaWRhdG9yKGF1dGhEYXRhW3Byb3ZpZGVyXSwgcmVxLCB1c2VyLCByZXF1ZXN0T2JqZWN0KTtcbiAgICAgIG1ldGhvZCA9IHZhbGlkYXRpb25SZXN1bHQgJiYgdmFsaWRhdGlvblJlc3VsdC5tZXRob2Q7XG4gICAgICByZXF1ZXN0T2JqZWN0LnRyaWdnZXJOYW1lID0gbWV0aG9kO1xuICAgICAgaWYgKHZhbGlkYXRpb25SZXN1bHQgJiYgdmFsaWRhdGlvblJlc3VsdC52YWxpZGF0b3IpIHtcbiAgICAgICAgdmFsaWRhdGlvblJlc3VsdCA9IGF3YWl0IHZhbGlkYXRpb25SZXN1bHQudmFsaWRhdG9yKCk7XG4gICAgICB9XG4gICAgICBpZiAoIXZhbGlkYXRpb25SZXN1bHQpIHtcbiAgICAgICAgYWNjLmF1dGhEYXRhW3Byb3ZpZGVyXSA9IGF1dGhEYXRhW3Byb3ZpZGVyXTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoIU9iamVjdC5rZXlzKHZhbGlkYXRpb25SZXN1bHQpLmxlbmd0aCkge1xuICAgICAgICBhY2MuYXV0aERhdGFbcHJvdmlkZXJdID0gYXV0aERhdGFbcHJvdmlkZXJdO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHZhbGlkYXRpb25SZXN1bHQucmVzcG9uc2UpIHtcbiAgICAgICAgYWNjLmF1dGhEYXRhUmVzcG9uc2VbcHJvdmlkZXJdID0gdmFsaWRhdGlvblJlc3VsdC5yZXNwb25zZTtcbiAgICAgIH1cbiAgICAgIC8vIFNvbWUgYXV0aCBwcm92aWRlcnMgYWZ0ZXIgaW5pdGlhbGl6YXRpb24gd2lsbCBhdm9pZCB0byByZXBsYWNlIGF1dGhEYXRhIGFscmVhZHkgc3RvcmVkXG4gICAgICBpZiAoIXZhbGlkYXRpb25SZXN1bHQuZG9Ob3RTYXZlKSB7XG4gICAgICAgIGFjYy5hdXRoRGF0YVtwcm92aWRlcl0gPSB2YWxpZGF0aW9uUmVzdWx0LnNhdmUgfHwgYXV0aERhdGFbcHJvdmlkZXJdO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc3QgZSA9IHJlc29sdmVFcnJvcihlcnIsIHtcbiAgICAgICAgY29kZTogUGFyc2UuRXJyb3IuU0NSSVBUX0ZBSUxFRCxcbiAgICAgICAgbWVzc2FnZTogJ0F1dGggZmFpbGVkLiBVbmtub3duIGVycm9yLicsXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHVzZXJTdHJpbmcgPVxuICAgICAgICByZXEuYXV0aCAmJiByZXEuYXV0aC51c2VyID8gcmVxLmF1dGgudXNlci5pZCA6IHJlcS5kYXRhLm9iamVjdElkIHx8IHVuZGVmaW5lZDtcbiAgICAgIGxvZ2dlci5lcnJvcihcbiAgICAgICAgYEZhaWxlZCBydW5uaW5nIGF1dGggc3RlcCAke21ldGhvZH0gZm9yICR7cHJvdmlkZXJ9IGZvciB1c2VyICR7dXNlclN0cmluZ30gd2l0aCBFcnJvcjogYCArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkoZSksXG4gICAgICAgIHtcbiAgICAgICAgICBhdXRoZW50aWNhdGlvblN0ZXA6IG1ldGhvZCxcbiAgICAgICAgICBlcnJvcjogZSxcbiAgICAgICAgICB1c2VyOiB1c2VyU3RyaW5nLFxuICAgICAgICAgIHByb3ZpZGVyLFxuICAgICAgICB9XG4gICAgICApO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGFjYztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBBdXRoLFxuICBtYXN0ZXIsXG4gIG1haW50ZW5hbmNlLFxuICBub2JvZHksXG4gIHJlYWRPbmx5LFxuICBnZXRBdXRoRm9yU2Vzc2lvblRva2VuLFxuICBnZXRBdXRoRm9yTGVnYWN5U2Vzc2lvblRva2VuLFxuICBmaW5kVXNlcnNXaXRoQXV0aERhdGEsXG4gIGhhc011dGF0ZWRBdXRoRGF0YSxcbiAgY2hlY2tJZlVzZXJIYXNQcm92aWRlZENvbmZpZ3VyZWRQcm92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