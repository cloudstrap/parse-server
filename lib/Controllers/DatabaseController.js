"use strict";

var _node = require("parse/node");
var _lodash = _interopRequireDefault(require("lodash"));
var _intersect = _interopRequireDefault(require("intersect"));
var _deepcopy = _interopRequireDefault(require("deepcopy"));
var _logger = _interopRequireDefault(require("../logger"));
var _Utils = _interopRequireDefault(require("../Utils"));
var SchemaController = _interopRequireWildcard(require("./SchemaController"));
var _StorageAdapter = require("../Adapters/Storage/StorageAdapter");
var _MongoStorageAdapter = _interopRequireDefault(require("../Adapters/Storage/Mongo/MongoStorageAdapter"));
var _PostgresStorageAdapter = _interopRequireDefault(require("../Adapters/Storage/Postgres/PostgresStorageAdapter"));
var _SchemaCache = _interopRequireDefault(require("../Adapters/Cache/SchemaCache"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; } // A database adapter that works with data exported from the hosted
// Parse database.
// -disable-next
// -disable-next
// -disable-next
// -disable-next
function addWriteACL(query, acl) {
  const newQuery = _lodash.default.cloneDeep(query);
  //Can't be any existing '_wperm' query, we don't allow client queries on that, no need to $and
  newQuery._wperm = {
    $in: [null, ...acl]
  };
  return newQuery;
}
function addReadACL(query, acl) {
  const newQuery = _lodash.default.cloneDeep(query);
  //Can't be any existing '_rperm' query, we don't allow client queries on that, no need to $and
  newQuery._rperm = {
    $in: [null, '*', ...acl]
  };
  return newQuery;
}

// Transforms a REST API formatted ACL object to our two-field mongo format.
const transformObjectACL = _ref => {
  let {
      ACL
    } = _ref,
    result = _objectWithoutProperties(_ref, ["ACL"]);
  if (!ACL) {
    return result;
  }
  result._wperm = [];
  result._rperm = [];
  for (const entry in ACL) {
    if (ACL[entry].read) {
      result._rperm.push(entry);
    }
    if (ACL[entry].write) {
      result._wperm.push(entry);
    }
  }
  return result;
};
const specialQueryKeys = ['$and', '$or', '$nor', '_rperm', '_wperm'];
const specialMasterQueryKeys = [...specialQueryKeys, '_email_verify_token', '_perishable_token', '_tombstone', '_email_verify_token_expires_at', '_failed_login_count', '_account_lockout_expires_at', '_password_changed_at', '_password_history'];
const validateQuery = (query, isMaster, isMaintenance, update) => {
  if (isMaintenance) {
    isMaster = true;
  }
  if (query.ACL) {
    throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Cannot query on ACL.');
  }
  if (query.$or) {
    if (query.$or instanceof Array) {
      query.$or.forEach(value => validateQuery(value, isMaster, isMaintenance, update));
    } else {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Bad $or format - use an array value.');
    }
  }
  if (query.$and) {
    if (query.$and instanceof Array) {
      query.$and.forEach(value => validateQuery(value, isMaster, isMaintenance, update));
    } else {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Bad $and format - use an array value.');
    }
  }
  if (query.$nor) {
    if (query.$nor instanceof Array && query.$nor.length > 0) {
      query.$nor.forEach(value => validateQuery(value, isMaster, isMaintenance, update));
    } else {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Bad $nor format - use an array of at least 1 value.');
    }
  }
  Object.keys(query).forEach(key => {
    if (query && query[key] && query[key].$regex) {
      if (typeof query[key].$options === 'string') {
        if (!query[key].$options.match(/^[imxs]+$/)) {
          throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, `Bad $options value for query: ${query[key].$options}`);
        }
      }
    }
    if (!key.match(/^[a-zA-Z][a-zA-Z0-9_\.]*$/) && (!specialQueryKeys.includes(key) && !isMaster && !update || update && isMaster && !specialMasterQueryKeys.includes(key))) {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid key name: ${key}`);
    }
  });
};

// Filters out any data that shouldn't be on this REST-formatted object.
const filterSensitiveData = (isMaster, isMaintenance, aclGroup, auth, operation, schema, className, protectedFields, object) => {
  let userId = null;
  if (auth && auth.user) userId = auth.user.id;

  // replace protectedFields when using pointer-permissions
  const perms = schema && schema.getClassLevelPermissions ? schema.getClassLevelPermissions(className) : {};
  if (perms) {
    const isReadOperation = ['get', 'find'].indexOf(operation) > -1;
    if (isReadOperation && perms.protectedFields) {
      // extract protectedFields added with the pointer-permission prefix
      const protectedFieldsPointerPerm = Object.keys(perms.protectedFields).filter(key => key.startsWith('userField:')).map(key => {
        return {
          key: key.substring(10),
          value: perms.protectedFields[key]
        };
      });
      const newProtectedFields = [];
      let overrideProtectedFields = false;

      // check if the object grants the current user access based on the extracted fields
      protectedFieldsPointerPerm.forEach(pointerPerm => {
        let pointerPermIncludesUser = false;
        const readUserFieldValue = object[pointerPerm.key];
        if (readUserFieldValue) {
          if (Array.isArray(readUserFieldValue)) {
            pointerPermIncludesUser = readUserFieldValue.some(user => user.objectId && user.objectId === userId);
          } else {
            pointerPermIncludesUser = readUserFieldValue.objectId && readUserFieldValue.objectId === userId;
          }
        }
        if (pointerPermIncludesUser) {
          overrideProtectedFields = true;
          newProtectedFields.push(pointerPerm.value);
        }
      });

      // if at least one pointer-permission affected the current user
      // intersect vs protectedFields from previous stage (@see addProtectedFields)
      // Sets theory (intersections): A x (B x C) == (A x B) x C
      if (overrideProtectedFields && protectedFields) {
        newProtectedFields.push(protectedFields);
      }
      // intersect all sets of protectedFields
      newProtectedFields.forEach(fields => {
        if (fields) {
          // if there're no protctedFields by other criteria ( id / role / auth)
          // then we must intersect each set (per userField)
          if (!protectedFields) {
            protectedFields = fields;
          } else {
            protectedFields = protectedFields.filter(v => fields.includes(v));
          }
        }
      });
    }
  }
  const isUserClass = className === '_User';
  if (isUserClass) {
    object.password = object._hashed_password;
    delete object._hashed_password;
    delete object.sessionToken;
  }
  if (isMaintenance) {
    return object;
  }

  /* special treat for the user class: don't filter protectedFields if currently loggedin user is
  the retrieved user */
  if (!(isUserClass && userId && object.objectId === userId)) {
    var _perms$protectedField, _perms$protectedField2;
    protectedFields && protectedFields.forEach(k => delete object[k]);

    // fields not requested by client (excluded),
    // but were needed to apply protectedFields
    perms === null || perms === void 0 ? void 0 : (_perms$protectedField = perms.protectedFields) === null || _perms$protectedField === void 0 ? void 0 : (_perms$protectedField2 = _perms$protectedField.temporaryKeys) === null || _perms$protectedField2 === void 0 ? void 0 : _perms$protectedField2.forEach(k => delete object[k]);
  }
  for (const key in object) {
    if (key.charAt(0) === '_') {
      delete object[key];
    }
  }
  if (!isUserClass || isMaster) {
    return object;
  }
  if (aclGroup.indexOf(object.objectId) > -1) {
    return object;
  }
  delete object.authData;
  return object;
};

// Runs an update on the database.
// Returns a promise for an object with the new values for field
// modifications that don't know their results ahead of time, like
// 'increment'.
// Options:
//   acl:  a list of strings. If the object to be updated has an ACL,
//         one of the provided strings must provide the caller with
//         write permissions.
const specialKeysForUpdate = ['_hashed_password', '_perishable_token', '_email_verify_token', '_email_verify_token_expires_at', '_account_lockout_expires_at', '_failed_login_count', '_perishable_token_expires_at', '_password_changed_at', '_password_history'];
const isSpecialUpdateKey = key => {
  return specialKeysForUpdate.indexOf(key) >= 0;
};
function joinTableName(className, key) {
  return `_Join:${key}:${className}`;
}
const flattenUpdateOperatorsForCreate = object => {
  for (const key in object) {
    if (object[key] && object[key].__op) {
      switch (object[key].__op) {
        case 'Increment':
          if (typeof object[key].amount !== 'number') {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = object[key].amount;
          break;
        case 'SetOnInsert':
          object[key] = object[key].amount;
          break;
        case 'Add':
          if (!(object[key].objects instanceof Array)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = object[key].objects;
          break;
        case 'AddUnique':
          if (!(object[key].objects instanceof Array)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = object[key].objects;
          break;
        case 'Remove':
          if (!(object[key].objects instanceof Array)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = [];
          break;
        case 'Delete':
          delete object[key];
          break;
        default:
          throw new _node.Parse.Error(_node.Parse.Error.COMMAND_UNAVAILABLE, `The ${object[key].__op} operator is not supported yet.`);
      }
    }
  }
};
const transformAuthData = (className, object, schema) => {
  if (object.authData && className === '_User') {
    Object.keys(object.authData).forEach(provider => {
      const providerData = object.authData[provider];
      const fieldName = `_auth_data_${provider}`;
      if (providerData == null) {
        object[fieldName] = {
          __op: 'Delete'
        };
      } else {
        object[fieldName] = providerData;
        schema.fields[fieldName] = {
          type: 'Object'
        };
      }
    });
    delete object.authData;
  }
};
// Transforms a Database format ACL to a REST API format ACL
const untransformObjectACL = _ref2 => {
  let {
      _rperm,
      _wperm
    } = _ref2,
    output = _objectWithoutProperties(_ref2, ["_rperm", "_wperm"]);
  if (_rperm || _wperm) {
    output.ACL = {};
    (_rperm || []).forEach(entry => {
      if (!output.ACL[entry]) {
        output.ACL[entry] = {
          read: true
        };
      } else {
        output.ACL[entry]['read'] = true;
      }
    });
    (_wperm || []).forEach(entry => {
      if (!output.ACL[entry]) {
        output.ACL[entry] = {
          write: true
        };
      } else {
        output.ACL[entry]['write'] = true;
      }
    });
  }
  return output;
};

/**
 * When querying, the fieldName may be compound, extract the root fieldName
 *     `temperature.celsius` becomes `temperature`
 * @param {string} fieldName that may be a compound field name
 * @returns {string} the root name of the field
 */
const getRootFieldName = fieldName => {
  return fieldName.split('.')[0];
};
const relationSchema = {
  fields: {
    relatedId: {
      type: 'String'
    },
    owningId: {
      type: 'String'
    }
  }
};
const convertEmailToLowercase = (object, className, options) => {
  if (className === '_User' && options.convertEmailToLowercase) {
    if (typeof object['email'] === 'string') {
      object['email'] = object['email'].toLowerCase();
    }
  }
};
const convertUsernameToLowercase = (object, className, options) => {
  if (className === '_User' && options.convertUsernameToLowercase) {
    if (typeof object['username'] === 'string') {
      object['username'] = object['username'].toLowerCase();
    }
  }
};
class DatabaseController {
  constructor(adapter, options) {
    this.adapter = adapter;
    this.options = options || {};
    this.idempotencyOptions = this.options.idempotencyOptions || {};
    // Prevent mutable this.schema, otherwise one request could use
    // multiple schemas, so instead use loadSchema to get a schema.
    this.schemaPromise = null;
    this._transactionalSession = null;
    this.options = options;
  }
  collectionExists(className) {
    return this.adapter.classExists(className);
  }
  purgeCollection(className) {
    return this.loadSchema().then(schemaController => schemaController.getOneSchema(className)).then(schema => this.adapter.deleteObjectsByQuery(className, schema, {}));
  }
  validateClassName(className) {
    if (!SchemaController.classNameIsValid(className)) {
      return Promise.reject(new _node.Parse.Error(_node.Parse.Error.INVALID_CLASS_NAME, 'invalid className: ' + className));
    }
    return Promise.resolve();
  }

  // Returns a promise for a schemaController.
  loadSchema(options = {
    clearCache: false
  }) {
    if (this.schemaPromise != null) {
      return this.schemaPromise;
    }
    this.schemaPromise = SchemaController.load(this.adapter, options);
    this.schemaPromise.then(() => delete this.schemaPromise, () => delete this.schemaPromise);
    return this.loadSchema(options);
  }
  loadSchemaIfNeeded(schemaController, options = {
    clearCache: false
  }) {
    return schemaController ? Promise.resolve(schemaController) : this.loadSchema(options);
  }

  // Returns a promise for the classname that is related to the given
  // classname through the key.
  // TODO: make this not in the DatabaseController interface
  redirectClassNameForKey(className, key) {
    return this.loadSchema().then(schema => {
      var t = schema.getExpectedType(className, key);
      if (t != null && typeof t !== 'string' && t.type === 'Relation') {
        return t.targetClass;
      }
      return className;
    });
  }

  // Uses the schema to validate the object (REST API format).
  // Returns a promise that resolves to the new schema.
  // This does not update this.schema, because in a situation like a
  // batch request, that could confuse other users of the schema.
  validateObject(className, object, query, runOptions, maintenance) {
    let schema;
    const acl = runOptions.acl;
    const isMaster = acl === undefined;
    var aclGroup = acl || [];
    return this.loadSchema().then(s => {
      schema = s;
      if (isMaster) {
        return Promise.resolve();
      }
      return this.canAddField(schema, className, object, aclGroup, runOptions);
    }).then(() => {
      return schema.validateObject(className, object, query, maintenance);
    });
  }
  update(className, query, update, {
    acl,
    many,
    upsert,
    addsField
  } = {}, skipSanitization = false, validateOnly = false, validSchemaController) {
    try {
      _Utils.default.checkProhibitedKeywords(this.options, update);
    } catch (error) {
      return Promise.reject(new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, error));
    }
    const originalQuery = query;
    const originalUpdate = update;
    // Make a copy of the object, so we don't mutate the incoming data.
    update = (0, _deepcopy.default)(update);
    var relationUpdates = [];
    var isMaster = acl === undefined;
    var aclGroup = acl || [];
    return this.loadSchemaIfNeeded(validSchemaController).then(schemaController => {
      return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, 'update')).then(() => {
        relationUpdates = this.collectRelationUpdates(className, originalQuery.objectId, update);
        if (!isMaster) {
          query = this.addPointerPermissions(schemaController, className, 'update', query, aclGroup);
          if (addsField) {
            query = {
              $and: [query, this.addPointerPermissions(schemaController, className, 'addField', query, aclGroup)]
            };
          }
        }
        if (!query) {
          return Promise.resolve();
        }
        if (acl) {
          query = addWriteACL(query, acl);
        }
        validateQuery(query, isMaster, false, true);
        return schemaController.getOneSchema(className, true).catch(error => {
          // If the schema doesn't exist, pretend it exists with no fields. This behavior
          // will likely need revisiting.
          if (error === undefined) {
            return {
              fields: {}
            };
          }
          throw error;
        }).then(schema => {
          Object.keys(update).forEach(fieldName => {
            if (fieldName.match(/^authData\.([a-zA-Z0-9_]+)\.id$/)) {
              throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid field name for update: ${fieldName}`);
            }
            const rootFieldName = getRootFieldName(fieldName);
            if (!SchemaController.fieldNameIsValid(rootFieldName, className) && !isSpecialUpdateKey(rootFieldName)) {
              throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid field name for update: ${fieldName}`);
            }
          });
          for (const updateOperation in update) {
            if (update[updateOperation] && typeof update[updateOperation] === 'object' && Object.keys(update[updateOperation]).some(innerKey => innerKey.includes('$') || innerKey.includes('.'))) {
              throw new _node.Parse.Error(_node.Parse.Error.INVALID_NESTED_KEY, "Nested keys should not contain the '$' or '.' characters");
            }
          }
          update = transformObjectACL(update);
          convertEmailToLowercase(update, className, this.options);
          convertUsernameToLowercase(update, className, this.options);
          transformAuthData(className, update, schema);
          if (validateOnly) {
            return this.adapter.find(className, schema, query, {}).then(result => {
              if (!result || !result.length) {
                throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
              }
              return {};
            });
          }
          if (many) {
            return this.adapter.updateObjectsByQuery(className, schema, query, update, this._transactionalSession);
          } else if (upsert) {
            return this.adapter.upsertOneObject(className, schema, query, update, this._transactionalSession);
          } else {
            return this.adapter.findOneAndUpdate(className, schema, query, update, this._transactionalSession);
          }
        });
      }).then(result => {
        if (!result) {
          throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
        }
        if (validateOnly) {
          return result;
        }
        return this.handleRelationUpdates(className, originalQuery.objectId, update, relationUpdates).then(() => {
          return result;
        });
      }).then(result => {
        if (skipSanitization) {
          return Promise.resolve(result);
        }
        return this._sanitizeDatabaseResult(originalUpdate, result);
      });
    });
  }

  // Collect all relation-updating operations from a REST-format update.
  // Returns a list of all relation updates to perform
  // This mutates update.
  collectRelationUpdates(className, objectId, update) {
    var ops = [];
    var deleteMe = [];
    objectId = update.objectId || objectId;
    var process = (op, key) => {
      if (!op) {
        return;
      }
      if (op.__op == 'AddRelation') {
        ops.push({
          key,
          op
        });
        deleteMe.push(key);
      }
      if (op.__op == 'RemoveRelation') {
        ops.push({
          key,
          op
        });
        deleteMe.push(key);
      }
      if (op.__op == 'Batch') {
        for (var x of op.ops) {
          process(x, key);
        }
      }
    };
    for (const key in update) {
      process(update[key], key);
    }
    for (const key of deleteMe) {
      delete update[key];
    }
    return ops;
  }

  // Processes relation-updating operations from a REST-format update.
  // Returns a promise that resolves when all updates have been performed
  handleRelationUpdates(className, objectId, update, ops) {
    var pending = [];
    objectId = update.objectId || objectId;
    ops.forEach(({
      key,
      op
    }) => {
      if (!op) {
        return;
      }
      if (op.__op == 'AddRelation') {
        for (const object of op.objects) {
          pending.push(this.addRelation(key, className, objectId, object.objectId));
        }
      }
      if (op.__op == 'RemoveRelation') {
        for (const object of op.objects) {
          pending.push(this.removeRelation(key, className, objectId, object.objectId));
        }
      }
    });
    return Promise.all(pending);
  }

  // Adds a relation.
  // Returns a promise that resolves successfully iff the add was successful.
  addRelation(key, fromClassName, fromId, toId) {
    const doc = {
      relatedId: toId,
      owningId: fromId
    };
    return this.adapter.upsertOneObject(`_Join:${key}:${fromClassName}`, relationSchema, doc, doc, this._transactionalSession);
  }

  // Removes a relation.
  // Returns a promise that resolves successfully iff the remove was
  // successful.
  removeRelation(key, fromClassName, fromId, toId) {
    var doc = {
      relatedId: toId,
      owningId: fromId
    };
    return this.adapter.deleteObjectsByQuery(`_Join:${key}:${fromClassName}`, relationSchema, doc, this._transactionalSession).catch(error => {
      // We don't care if they try to delete a non-existent relation.
      if (error.code == _node.Parse.Error.OBJECT_NOT_FOUND) {
        return;
      }
      throw error;
    });
  }

  // Removes objects matches this query from the database.
  // Returns a promise that resolves successfully iff the object was
  // deleted.
  // Options:
  //   acl:  a list of strings. If the object to be updated has an ACL,
  //         one of the provided strings must provide the caller with
  //         write permissions.
  destroy(className, query, {
    acl
  } = {}, validSchemaController) {
    const isMaster = acl === undefined;
    const aclGroup = acl || [];
    return this.loadSchemaIfNeeded(validSchemaController).then(schemaController => {
      return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, 'delete')).then(() => {
        if (!isMaster) {
          query = this.addPointerPermissions(schemaController, className, 'delete', query, aclGroup);
          if (!query) {
            throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
          }
        }
        // delete by query
        if (acl) {
          query = addWriteACL(query, acl);
        }
        validateQuery(query, isMaster, false, false);
        return schemaController.getOneSchema(className).catch(error => {
          // If the schema doesn't exist, pretend it exists with no fields. This behavior
          // will likely need revisiting.
          if (error === undefined) {
            return {
              fields: {}
            };
          }
          throw error;
        }).then(parseFormatSchema => this.adapter.deleteObjectsByQuery(className, parseFormatSchema, query, this._transactionalSession)).catch(error => {
          // When deleting sessions while changing passwords, don't throw an error if they don't have any sessions.
          if (className === '_Session' && error.code === _node.Parse.Error.OBJECT_NOT_FOUND) {
            return Promise.resolve({});
          }
          throw error;
        });
      });
    });
  }

  // Inserts an object into the database.
  // Returns a promise that resolves successfully iff the object saved.
  create(className, object, {
    acl
  } = {}, validateOnly = false, validSchemaController) {
    try {
      _Utils.default.checkProhibitedKeywords(this.options, object);
    } catch (error) {
      return Promise.reject(new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, error));
    }
    // Make a copy of the object, so we don't mutate the incoming data.
    const originalObject = object;
    object = transformObjectACL(object);
    convertEmailToLowercase(object, className, this.options);
    convertUsernameToLowercase(object, className, this.options);
    object.createdAt = {
      iso: object.createdAt,
      __type: 'Date'
    };
    object.updatedAt = {
      iso: object.updatedAt,
      __type: 'Date'
    };
    var isMaster = acl === undefined;
    var aclGroup = acl || [];
    const relationUpdates = this.collectRelationUpdates(className, null, object);
    return this.validateClassName(className).then(() => this.loadSchemaIfNeeded(validSchemaController)).then(schemaController => {
      return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, 'create')).then(() => schemaController.enforceClassExists(className)).then(() => schemaController.getOneSchema(className, true)).then(schema => {
        transformAuthData(className, object, schema);
        flattenUpdateOperatorsForCreate(object);
        if (validateOnly) {
          return {};
        }
        return this.adapter.createObject(className, SchemaController.convertSchemaToAdapterSchema(schema), object, this._transactionalSession);
      }).then(result => {
        if (validateOnly) {
          return originalObject;
        }
        return this.handleRelationUpdates(className, object.objectId, object, relationUpdates).then(() => {
          return this._sanitizeDatabaseResult(originalObject, result.ops[0]);
        });
      });
    });
  }
  canAddField(schema, className, object, aclGroup, runOptions) {
    const classSchema = schema.schemaData[className];
    if (!classSchema) {
      return Promise.resolve();
    }
    const fields = Object.keys(object);
    const schemaFields = Object.keys(classSchema.fields);
    const newKeys = fields.filter(field => {
      // Skip fields that are unset
      if (object[field] && object[field].__op && object[field].__op === 'Delete') {
        return false;
      }
      return schemaFields.indexOf(getRootFieldName(field)) < 0;
    });
    if (newKeys.length > 0) {
      // adds a marker that new field is being adding during update
      runOptions.addsField = true;
      const action = runOptions.action;
      return schema.validatePermission(className, aclGroup, 'addField', action);
    }
    return Promise.resolve();
  }

  // Won't delete collections in the system namespace
  /**
   * Delete all classes and clears the schema cache
   *
   * @param {boolean} fast set to true if it's ok to just delete rows and not indexes
   * @returns {Promise<void>} when the deletions completes
   */
  deleteEverything(fast = false) {
    this.schemaPromise = null;
    _SchemaCache.default.clear();
    return this.adapter.deleteAllClasses(fast);
  }

  // Returns a promise for a list of related ids given an owning id.
  // className here is the owning className.
  relatedIds(className, key, owningId, queryOptions) {
    const {
      skip,
      limit,
      sort
    } = queryOptions;
    const findOptions = {};
    if (sort && sort.createdAt && this.adapter.canSortOnJoinTables) {
      findOptions.sort = {
        _id: sort.createdAt
      };
      findOptions.limit = limit;
      findOptions.skip = skip;
      queryOptions.skip = 0;
    }
    return this.adapter.find(joinTableName(className, key), relationSchema, {
      owningId
    }, findOptions).then(results => results.map(result => result.relatedId));
  }

  // Returns a promise for a list of owning ids given some related ids.
  // className here is the owning className.
  owningIds(className, key, relatedIds) {
    return this.adapter.find(joinTableName(className, key), relationSchema, {
      relatedId: {
        $in: relatedIds
      }
    }, {
      keys: ['owningId']
    }).then(results => results.map(result => result.owningId));
  }

  // Modifies query so that it no longer has $in on relation fields, or
  // equal-to-pointer constraints on relation fields.
  // Returns a promise that resolves when query is mutated
  reduceInRelation(className, query, schema) {
    // Search for an in-relation or equal-to-relation
    // Make it sequential for now, not sure of paralleization side effects
    const promises = [];
    if (query['$or']) {
      const ors = query['$or'];
      promises.push(...ors.map((aQuery, index) => {
        return this.reduceInRelation(className, aQuery, schema).then(aQuery => {
          query['$or'][index] = aQuery;
        });
      }));
    }
    if (query['$and']) {
      const ands = query['$and'];
      promises.push(...ands.map((aQuery, index) => {
        return this.reduceInRelation(className, aQuery, schema).then(aQuery => {
          query['$and'][index] = aQuery;
        });
      }));
    }
    const otherKeys = Object.keys(query).map(key => {
      if (key === '$and' || key === '$or') {
        return;
      }
      const t = schema.getExpectedType(className, key);
      if (!t || t.type !== 'Relation') {
        return Promise.resolve(query);
      }
      let queries = null;
      if (query[key] && (query[key]['$in'] || query[key]['$ne'] || query[key]['$nin'] || query[key].__type == 'Pointer')) {
        // Build the list of queries
        queries = Object.keys(query[key]).map(constraintKey => {
          let relatedIds;
          let isNegation = false;
          if (constraintKey === 'objectId') {
            relatedIds = [query[key].objectId];
          } else if (constraintKey == '$in') {
            relatedIds = query[key]['$in'].map(r => r.objectId);
          } else if (constraintKey == '$nin') {
            isNegation = true;
            relatedIds = query[key]['$nin'].map(r => r.objectId);
          } else if (constraintKey == '$ne') {
            isNegation = true;
            relatedIds = [query[key]['$ne'].objectId];
          } else {
            return;
          }
          return {
            isNegation,
            relatedIds
          };
        });
      } else {
        queries = [{
          isNegation: false,
          relatedIds: []
        }];
      }

      // remove the current queryKey as we don,t need it anymore
      delete query[key];
      // execute each query independently to build the list of
      // $in / $nin
      const promises = queries.map(q => {
        if (!q) {
          return Promise.resolve();
        }
        return this.owningIds(className, key, q.relatedIds).then(ids => {
          if (q.isNegation) {
            this.addNotInObjectIdsIds(ids, query);
          } else {
            this.addInObjectIdsIds(ids, query);
          }
          return Promise.resolve();
        });
      });
      return Promise.all(promises).then(() => {
        return Promise.resolve();
      });
    });
    return Promise.all([...promises, ...otherKeys]).then(() => {
      return Promise.resolve(query);
    });
  }

  // Modifies query so that it no longer has $relatedTo
  // Returns a promise that resolves when query is mutated
  reduceRelationKeys(className, query, queryOptions) {
    if (query['$or']) {
      return Promise.all(query['$or'].map(aQuery => {
        return this.reduceRelationKeys(className, aQuery, queryOptions);
      }));
    }
    if (query['$and']) {
      return Promise.all(query['$and'].map(aQuery => {
        return this.reduceRelationKeys(className, aQuery, queryOptions);
      }));
    }
    var relatedTo = query['$relatedTo'];
    if (relatedTo) {
      return this.relatedIds(relatedTo.object.className, relatedTo.key, relatedTo.object.objectId, queryOptions).then(ids => {
        delete query['$relatedTo'];
        this.addInObjectIdsIds(ids, query);
        return this.reduceRelationKeys(className, query, queryOptions);
      }).then(() => {});
    }
  }
  addInObjectIdsIds(ids = null, query) {
    const idsFromString = typeof query.objectId === 'string' ? [query.objectId] : null;
    const idsFromEq = query.objectId && query.objectId['$eq'] ? [query.objectId['$eq']] : null;
    const idsFromIn = query.objectId && query.objectId['$in'] ? query.objectId['$in'] : null;

    // -disable-next
    const allIds = [idsFromString, idsFromEq, idsFromIn, ids].filter(list => list !== null);
    const totalLength = allIds.reduce((memo, list) => memo + list.length, 0);
    let idsIntersection = [];
    if (totalLength > 125) {
      idsIntersection = _intersect.default.big(allIds);
    } else {
      idsIntersection = (0, _intersect.default)(allIds);
    }

    // Need to make sure we don't clobber existing shorthand $eq constraints on objectId.
    if (!('objectId' in query)) {
      query.objectId = {
        $in: undefined
      };
    } else if (typeof query.objectId === 'string') {
      query.objectId = {
        $in: undefined,
        $eq: query.objectId
      };
    }
    query.objectId['$in'] = idsIntersection;
    return query;
  }
  addNotInObjectIdsIds(ids = [], query) {
    const idsFromNin = query.objectId && query.objectId['$nin'] ? query.objectId['$nin'] : [];
    let allIds = [...idsFromNin, ...ids].filter(list => list !== null);

    // make a set and spread to remove duplicates
    allIds = [...new Set(allIds)];

    // Need to make sure we don't clobber existing shorthand $eq constraints on objectId.
    if (!('objectId' in query)) {
      query.objectId = {
        $nin: undefined
      };
    } else if (typeof query.objectId === 'string') {
      query.objectId = {
        $nin: undefined,
        $eq: query.objectId
      };
    }
    query.objectId['$nin'] = allIds;
    return query;
  }

  // Runs a query on the database.
  // Returns a promise that resolves to a list of items.
  // Options:
  //   skip    number of results to skip.
  //   limit   limit to this number of results.
  //   sort    an object where keys are the fields to sort by.
  //           the value is +1 for ascending, -1 for descending.
  //   count   run a count instead of returning results.
  //   acl     restrict this operation with an ACL for the provided array
  //           of user objectIds and roles. acl: null means no user.
  //           when this field is not present, don't do anything regarding ACLs.
  //  caseInsensitive make string comparisons case insensitive
  // TODO: make userIds not needed here. The db adapter shouldn't know
  // anything about users, ideally. Then, improve the format of the ACL
  // arg to work like the others.
  find(className, query, {
    skip,
    limit,
    acl,
    sort = {},
    count,
    keys,
    op,
    distinct,
    pipeline,
    readPreference,
    hint,
    caseInsensitive = false,
    explain
  } = {}, auth = {}, validSchemaController) {
    const isMaintenance = auth.isMaintenance;
    const isMaster = acl === undefined || isMaintenance;
    const aclGroup = acl || [];
    op = op || (typeof query.objectId == 'string' && Object.keys(query).length === 1 ? 'get' : 'find');
    // Count operation if counting
    op = count === true ? 'count' : op;
    let classExists = true;
    return this.loadSchemaIfNeeded(validSchemaController).then(schemaController => {
      //Allow volatile classes if querying with Master (for _PushStatus)
      //TODO: Move volatile classes concept into mongo adapter, postgres adapter shouldn't care
      //that api.parse.com breaks when _PushStatus exists in mongo.
      return schemaController.getOneSchema(className, isMaster).catch(error => {
        // Behavior for non-existent classes is kinda weird on Parse.com. Probably doesn't matter too much.
        // For now, pretend the class exists but has no objects,
        if (error === undefined) {
          classExists = false;
          return {
            fields: {}
          };
        }
        throw error;
      }).then(schema => {
        // Parse.com treats queries on _created_at and _updated_at as if they were queries on createdAt and updatedAt,
        // so duplicate that behavior here. If both are specified, the correct behavior to match Parse.com is to
        // use the one that appears first in the sort list.
        if (sort._created_at) {
          sort.createdAt = sort._created_at;
          delete sort._created_at;
        }
        if (sort._updated_at) {
          sort.updatedAt = sort._updated_at;
          delete sort._updated_at;
        }
        const queryOptions = {
          skip,
          limit,
          sort,
          keys,
          readPreference,
          hint,
          caseInsensitive: this.options.enableCollationCaseComparison ? false : caseInsensitive,
          explain
        };
        Object.keys(sort).forEach(fieldName => {
          if (fieldName.match(/^authData\.([a-zA-Z0-9_]+)\.id$/)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Cannot sort by ${fieldName}`);
          }
          const rootFieldName = getRootFieldName(fieldName);
          if (!SchemaController.fieldNameIsValid(rootFieldName, className)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid field name: ${fieldName}.`);
          }
          if (!schema.fields[fieldName.split('.')[0]] && fieldName !== 'score') {
            delete sort[fieldName];
          }
        });
        return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, op)).then(() => this.reduceRelationKeys(className, query, queryOptions)).then(() => this.reduceInRelation(className, query, schemaController)).then(() => {
          let protectedFields;
          if (!isMaster) {
            query = this.addPointerPermissions(schemaController, className, op, query, aclGroup);
            /* Don't use projections to optimize the protectedFields since the protectedFields
              based on pointer-permissions are determined after querying. The filtering can
              overwrite the protected fields. */
            protectedFields = this.addProtectedFields(schemaController, className, query, aclGroup, auth, queryOptions);
          }
          if (!query) {
            if (op === 'get') {
              throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
            } else {
              return [];
            }
          }
          if (!isMaster) {
            if (op === 'update' || op === 'delete') {
              query = addWriteACL(query, aclGroup);
            } else {
              query = addReadACL(query, aclGroup);
            }
          }
          validateQuery(query, isMaster, isMaintenance, false);
          if (count) {
            if (!classExists) {
              return 0;
            } else {
              return this.adapter.count(className, schema, query, readPreference, undefined, hint);
            }
          } else if (distinct) {
            if (!classExists) {
              return [];
            } else {
              return this.adapter.distinct(className, schema, query, distinct);
            }
          } else if (pipeline) {
            if (!classExists) {
              return [];
            } else {
              return this.adapter.aggregate(className, schema, pipeline, readPreference, hint, explain);
            }
          } else if (explain) {
            return this.adapter.find(className, schema, query, queryOptions);
          } else {
            return this.adapter.find(className, schema, query, queryOptions).then(objects => objects.map(object => {
              object = untransformObjectACL(object);
              return filterSensitiveData(isMaster, isMaintenance, aclGroup, auth, op, schemaController, className, protectedFields, object);
            })).catch(error => {
              throw new _node.Parse.Error(_node.Parse.Error.INTERNAL_SERVER_ERROR, error);
            });
          }
        });
      });
    });
  }
  deleteSchema(className) {
    let schemaController;
    return this.loadSchema({
      clearCache: true
    }).then(s => {
      schemaController = s;
      return schemaController.getOneSchema(className, true);
    }).catch(error => {
      if (error === undefined) {
        return {
          fields: {}
        };
      } else {
        throw error;
      }
    }).then(schema => {
      return this.collectionExists(className).then(() => this.adapter.count(className, {
        fields: {}
      }, null, '', false)).then(count => {
        if (count > 0) {
          throw new _node.Parse.Error(255, `Class ${className} is not empty, contains ${count} objects, cannot drop schema.`);
        }
        return this.adapter.deleteClass(className);
      }).then(wasParseCollection => {
        if (wasParseCollection) {
          const relationFieldNames = Object.keys(schema.fields).filter(fieldName => schema.fields[fieldName].type === 'Relation');
          return Promise.all(relationFieldNames.map(name => this.adapter.deleteClass(joinTableName(className, name)))).then(() => {
            _SchemaCache.default.del(className);
            return schemaController.reloadData();
          });
        } else {
          return Promise.resolve();
        }
      });
    });
  }

  // This helps to create intermediate objects for simpler comparison of
  // key value pairs used in query objects. Each key value pair will represented
  // in a similar way to json
  objectToEntriesStrings(query) {
    return Object.entries(query).map(a => a.map(s => JSON.stringify(s)).join(':'));
  }

  // Naive logic reducer for OR operations meant to be used only for pointer permissions.
  reduceOrOperation(query) {
    if (!query.$or) {
      return query;
    }
    const queries = query.$or.map(q => this.objectToEntriesStrings(q));
    let repeat = false;
    do {
      repeat = false;
      for (let i = 0; i < queries.length - 1; i++) {
        for (let j = i + 1; j < queries.length; j++) {
          const [shorter, longer] = queries[i].length > queries[j].length ? [j, i] : [i, j];
          const foundEntries = queries[shorter].reduce((acc, entry) => acc + (queries[longer].includes(entry) ? 1 : 0), 0);
          const shorterEntries = queries[shorter].length;
          if (foundEntries === shorterEntries) {
            // If the shorter query is completely contained in the longer one, we can strike
            // out the longer query.
            query.$or.splice(longer, 1);
            queries.splice(longer, 1);
            repeat = true;
            break;
          }
        }
      }
    } while (repeat);
    if (query.$or.length === 1) {
      query = _objectSpread(_objectSpread({}, query), query.$or[0]);
      delete query.$or;
    }
    return query;
  }

  // Naive logic reducer for AND operations meant to be used only for pointer permissions.
  reduceAndOperation(query) {
    if (!query.$and) {
      return query;
    }
    const queries = query.$and.map(q => this.objectToEntriesStrings(q));
    let repeat = false;
    do {
      repeat = false;
      for (let i = 0; i < queries.length - 1; i++) {
        for (let j = i + 1; j < queries.length; j++) {
          const [shorter, longer] = queries[i].length > queries[j].length ? [j, i] : [i, j];
          const foundEntries = queries[shorter].reduce((acc, entry) => acc + (queries[longer].includes(entry) ? 1 : 0), 0);
          const shorterEntries = queries[shorter].length;
          if (foundEntries === shorterEntries) {
            // If the shorter query is completely contained in the longer one, we can strike
            // out the shorter query.
            query.$and.splice(shorter, 1);
            queries.splice(shorter, 1);
            repeat = true;
            break;
          }
        }
      }
    } while (repeat);
    if (query.$and.length === 1) {
      query = _objectSpread(_objectSpread({}, query), query.$and[0]);
      delete query.$and;
    }
    return query;
  }

  // Constraints query using CLP's pointer permissions (PP) if any.
  // 1. Etract the user id from caller's ACLgroup;
  // 2. Exctract a list of field names that are PP for target collection and operation;
  // 3. Constraint the original query so that each PP field must
  // point to caller's id (or contain it in case of PP field being an array)
  addPointerPermissions(schema, className, operation, query, aclGroup = []) {
    // Check if class has public permission for operation
    // If the BaseCLP pass, let go through
    if (schema.testPermissionsForClassName(className, aclGroup, operation)) {
      return query;
    }
    const perms = schema.getClassLevelPermissions(className);
    const userACL = aclGroup.filter(acl => {
      return acl.indexOf('role:') != 0 && acl != '*';
    });
    const groupKey = ['get', 'find', 'count'].indexOf(operation) > -1 ? 'readUserFields' : 'writeUserFields';
    const permFields = [];
    if (perms[operation] && perms[operation].pointerFields) {
      permFields.push(...perms[operation].pointerFields);
    }
    if (perms[groupKey]) {
      for (const field of perms[groupKey]) {
        if (!permFields.includes(field)) {
          permFields.push(field);
        }
      }
    }
    // the ACL should have exactly 1 user
    if (permFields.length > 0) {
      // the ACL should have exactly 1 user
      // No user set return undefined
      // If the length is > 1, that means we didn't de-dupe users correctly
      if (userACL.length != 1) {
        return;
      }
      const userId = userACL[0];
      const userPointer = {
        __type: 'Pointer',
        className: '_User',
        objectId: userId
      };
      const queries = permFields.map(key => {
        const fieldDescriptor = schema.getExpectedType(className, key);
        const fieldType = fieldDescriptor && typeof fieldDescriptor === 'object' && Object.prototype.hasOwnProperty.call(fieldDescriptor, 'type') ? fieldDescriptor.type : null;
        let queryClause;
        if (fieldType === 'Pointer') {
          // constraint for single pointer setup
          queryClause = {
            [key]: userPointer
          };
        } else if (fieldType === 'Array') {
          // constraint for users-array setup
          queryClause = {
            [key]: {
              $all: [userPointer]
            }
          };
        } else if (fieldType === 'Object') {
          // constraint for object setup
          queryClause = {
            [key]: userPointer
          };
        } else {
          // This means that there is a CLP field of an unexpected type. This condition should not happen, which is
          // why is being treated as an error.
          throw Error(`An unexpected condition occurred when resolving pointer permissions: ${className} ${key}`);
        }
        // if we already have a constraint on the key, use the $and
        if (Object.prototype.hasOwnProperty.call(query, key)) {
          return this.reduceAndOperation({
            $and: [queryClause, query]
          });
        }
        // otherwise just add the constaint
        return Object.assign({}, query, queryClause);
      });
      return queries.length === 1 ? queries[0] : this.reduceOrOperation({
        $or: queries
      });
    } else {
      return query;
    }
  }
  addProtectedFields(schema, className, query = {}, aclGroup = [], auth = {}, queryOptions = {}) {
    const perms = schema && schema.getClassLevelPermissions ? schema.getClassLevelPermissions(className) : schema;
    if (!perms) return null;
    const protectedFields = perms.protectedFields;
    if (!protectedFields) return null;
    if (aclGroup.indexOf(query.objectId) > -1) return null;

    // for queries where "keys" are set and do not include all 'userField':{field},
    // we have to transparently include it, and then remove before returning to client
    // Because if such key not projected the permission won't be enforced properly
    // PS this is called when 'excludeKeys' already reduced to 'keys'
    const preserveKeys = queryOptions.keys;

    // these are keys that need to be included only
    // to be able to apply protectedFields by pointer
    // and then unset before returning to client (later in  filterSensitiveFields)
    const serverOnlyKeys = [];
    const authenticated = auth.user;

    // map to allow check without array search
    const roles = (auth.userRoles || []).reduce((acc, r) => {
      acc[r] = protectedFields[r];
      return acc;
    }, {});

    // array of sets of protected fields. separate item for each applicable criteria
    const protectedKeysSets = [];
    for (const key in protectedFields) {
      // skip userFields
      if (key.startsWith('userField:')) {
        if (preserveKeys) {
          const fieldName = key.substring(10);
          if (!preserveKeys.includes(fieldName)) {
            // 1. put it there temporarily
            queryOptions.keys && queryOptions.keys.push(fieldName);
            // 2. preserve it delete later
            serverOnlyKeys.push(fieldName);
          }
        }
        continue;
      }

      // add public tier
      if (key === '*') {
        protectedKeysSets.push(protectedFields[key]);
        continue;
      }
      if (authenticated) {
        if (key === 'authenticated') {
          // for logged in users
          protectedKeysSets.push(protectedFields[key]);
          continue;
        }
        if (roles[key] && key.startsWith('role:')) {
          // add applicable roles
          protectedKeysSets.push(roles[key]);
        }
      }
    }

    // check if there's a rule for current user's id
    if (authenticated) {
      const userId = auth.user.id;
      if (perms.protectedFields[userId]) {
        protectedKeysSets.push(perms.protectedFields[userId]);
      }
    }

    // preserve fields to be removed before sending response to client
    if (serverOnlyKeys.length > 0) {
      perms.protectedFields.temporaryKeys = serverOnlyKeys;
    }
    let protectedKeys = protectedKeysSets.reduce((acc, next) => {
      if (next) {
        acc.push(...next);
      }
      return acc;
    }, []);

    // intersect all sets of protectedFields
    protectedKeysSets.forEach(fields => {
      if (fields) {
        protectedKeys = protectedKeys.filter(v => fields.includes(v));
      }
    });
    return protectedKeys;
  }
  createTransactionalSession() {
    return this.adapter.createTransactionalSession().then(transactionalSession => {
      this._transactionalSession = transactionalSession;
    });
  }
  commitTransactionalSession() {
    if (!this._transactionalSession) {
      throw new Error('There is no transactional session to commit');
    }
    return this.adapter.commitTransactionalSession(this._transactionalSession).then(() => {
      this._transactionalSession = null;
    });
  }
  abortTransactionalSession() {
    if (!this._transactionalSession) {
      throw new Error('There is no transactional session to abort');
    }
    return this.adapter.abortTransactionalSession(this._transactionalSession).then(() => {
      this._transactionalSession = null;
    });
  }

  // TODO: create indexes on first creation of a _User object. Otherwise it's impossible to
  // have a Parse app without it having a _User collection.
  async performInitialization() {
    await this.adapter.performInitialization({
      VolatileClassesSchemas: SchemaController.VolatileClassesSchemas
    });
    const requiredUserFields = {
      fields: _objectSpread(_objectSpread({}, SchemaController.defaultColumns._Default), SchemaController.defaultColumns._User)
    };
    const requiredRoleFields = {
      fields: _objectSpread(_objectSpread({}, SchemaController.defaultColumns._Default), SchemaController.defaultColumns._Role)
    };
    const requiredIdempotencyFields = {
      fields: _objectSpread(_objectSpread({}, SchemaController.defaultColumns._Default), SchemaController.defaultColumns._Idempotency)
    };
    await this.loadSchema().then(schema => schema.enforceClassExists('_User'));
    await this.loadSchema().then(schema => schema.enforceClassExists('_Role'));
    await this.loadSchema().then(schema => schema.enforceClassExists('_Idempotency'));
    await this.adapter.ensureUniqueness('_User', requiredUserFields, ['username']).catch(error => {
      _logger.default.warn('Unable to ensure uniqueness for usernames: ', error);
      throw error;
    });
    if (!this.options.enableCollationCaseComparison) {
      await this.adapter.ensureIndex('_User', requiredUserFields, ['username'], 'case_insensitive_username', true).catch(error => {
        _logger.default.warn('Unable to create case insensitive username index: ', error);
        throw error;
      });
      await this.adapter.ensureIndex('_User', requiredUserFields, ['email'], 'case_insensitive_email', true).catch(error => {
        _logger.default.warn('Unable to create case insensitive email index: ', error);
        throw error;
      });
    }
    await this.adapter.ensureUniqueness('_User', requiredUserFields, ['email']).catch(error => {
      _logger.default.warn('Unable to ensure uniqueness for user email addresses: ', error);
      throw error;
    });
    await this.adapter.ensureUniqueness('_Role', requiredRoleFields, ['name']).catch(error => {
      _logger.default.warn('Unable to ensure uniqueness for role name: ', error);
      throw error;
    });
    await this.adapter.ensureUniqueness('_Idempotency', requiredIdempotencyFields, ['reqId']).catch(error => {
      _logger.default.warn('Unable to ensure uniqueness for idempotency request ID: ', error);
      throw error;
    });
    const isMongoAdapter = this.adapter instanceof _MongoStorageAdapter.default;
    const isPostgresAdapter = this.adapter instanceof _PostgresStorageAdapter.default;
    if (isMongoAdapter || isPostgresAdapter) {
      let options = {};
      if (isMongoAdapter) {
        options = {
          ttl: 0
        };
      } else if (isPostgresAdapter) {
        options = this.idempotencyOptions;
        options.setIdempotencyFunction = true;
      }
      await this.adapter.ensureIndex('_Idempotency', requiredIdempotencyFields, ['expire'], 'ttl', false, options).catch(error => {
        _logger.default.warn('Unable to create TTL index for idempotency expire date: ', error);
        throw error;
      });
    }
    await this.adapter.updateSchemaWithIndexes();
  }
  _expandResultOnKeyPath(object, key, value) {
    if (key.indexOf('.') < 0) {
      object[key] = value[key];
      return object;
    }
    const path = key.split('.');
    const firstKey = path[0];
    const nextPath = path.slice(1).join('.');

    // Scan request data for denied keywords
    if (this.options && this.options.requestKeywordDenylist) {
      // Scan request data for denied keywords
      for (const keyword of this.options.requestKeywordDenylist) {
        const match = _Utils.default.objectContainsKeyValue({
          [firstKey]: true,
          [nextPath]: true
        }, keyword.key, true);
        if (match) {
          throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Prohibited keyword in request data: ${JSON.stringify(keyword)}.`);
        }
      }
    }
    object[firstKey] = this._expandResultOnKeyPath(object[firstKey] || {}, nextPath, value[firstKey]);
    delete object[key];
    return object;
  }
  _sanitizeDatabaseResult(originalObject, result) {
    const response = {};
    if (!result) {
      return Promise.resolve(response);
    }
    Object.keys(originalObject).forEach(key => {
      const keyUpdate = originalObject[key];
      // determine if that was an op
      if (keyUpdate && typeof keyUpdate === 'object' && keyUpdate.__op && ['Add', 'AddUnique', 'Remove', 'Increment', 'SetOnInsert'].indexOf(keyUpdate.__op) > -1) {
        // only valid ops that produce an actionable result
        // the op may have happened on a keypath
        this._expandResultOnKeyPath(response, key, result);
      }
    });
    return Promise.resolve(response);
  }
}
module.exports = DatabaseController;
// Expose validateQuery for tests
module.exports._validateQuery = validateQuery;
module.exports.filterSensitiveData = filterSensitiveData;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbm9kZSIsInJlcXVpcmUiLCJfbG9kYXNoIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9pbnRlcnNlY3QiLCJfZGVlcGNvcHkiLCJfbG9nZ2VyIiwiX1V0aWxzIiwiU2NoZW1hQ29udHJvbGxlciIsIl9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkIiwiX1N0b3JhZ2VBZGFwdGVyIiwiX01vbmdvU3RvcmFnZUFkYXB0ZXIiLCJfUG9zdGdyZXNTdG9yYWdlQWRhcHRlciIsIl9TY2hlbWFDYWNoZSIsIl9nZXRSZXF1aXJlV2lsZGNhcmRDYWNoZSIsIm5vZGVJbnRlcm9wIiwiV2Vha01hcCIsImNhY2hlQmFiZWxJbnRlcm9wIiwiY2FjaGVOb2RlSW50ZXJvcCIsIm9iaiIsIl9fZXNNb2R1bGUiLCJkZWZhdWx0IiwiY2FjaGUiLCJoYXMiLCJnZXQiLCJuZXdPYmoiLCJoYXNQcm9wZXJ0eURlc2NyaXB0b3IiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImtleSIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImRlc2MiLCJzZXQiLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwic3ltYm9scyIsImZpbHRlciIsInN5bSIsImVudW1lcmFibGUiLCJwdXNoIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwidGFyZ2V0IiwiaSIsImFyZ3VtZW50cyIsImxlbmd0aCIsInNvdXJjZSIsImZvckVhY2giLCJfZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZGVmaW5lUHJvcGVydGllcyIsInZhbHVlIiwiX3RvUHJvcGVydHlLZXkiLCJjb25maWd1cmFibGUiLCJ3cml0YWJsZSIsImFyZyIsIl90b1ByaW1pdGl2ZSIsIlN0cmluZyIsImlucHV0IiwiaGludCIsInByaW0iLCJTeW1ib2wiLCJ0b1ByaW1pdGl2ZSIsInVuZGVmaW5lZCIsInJlcyIsIlR5cGVFcnJvciIsIk51bWJlciIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllcyIsImV4Y2x1ZGVkIiwiX29iamVjdFdpdGhvdXRQcm9wZXJ0aWVzTG9vc2UiLCJzb3VyY2VTeW1ib2xLZXlzIiwiaW5kZXhPZiIsInByb3BlcnR5SXNFbnVtZXJhYmxlIiwic291cmNlS2V5cyIsImFkZFdyaXRlQUNMIiwicXVlcnkiLCJhY2wiLCJuZXdRdWVyeSIsIl8iLCJjbG9uZURlZXAiLCJfd3Blcm0iLCIkaW4iLCJhZGRSZWFkQUNMIiwiX3JwZXJtIiwidHJhbnNmb3JtT2JqZWN0QUNMIiwiX3JlZiIsIkFDTCIsInJlc3VsdCIsImVudHJ5IiwicmVhZCIsIndyaXRlIiwic3BlY2lhbFF1ZXJ5S2V5cyIsInNwZWNpYWxNYXN0ZXJRdWVyeUtleXMiLCJ2YWxpZGF0ZVF1ZXJ5IiwiaXNNYXN0ZXIiLCJpc01haW50ZW5hbmNlIiwidXBkYXRlIiwiUGFyc2UiLCJFcnJvciIsIklOVkFMSURfUVVFUlkiLCIkb3IiLCJBcnJheSIsIiRhbmQiLCIkbm9yIiwiJHJlZ2V4IiwiJG9wdGlvbnMiLCJtYXRjaCIsImluY2x1ZGVzIiwiSU5WQUxJRF9LRVlfTkFNRSIsImZpbHRlclNlbnNpdGl2ZURhdGEiLCJhY2xHcm91cCIsImF1dGgiLCJvcGVyYXRpb24iLCJzY2hlbWEiLCJjbGFzc05hbWUiLCJwcm90ZWN0ZWRGaWVsZHMiLCJ1c2VySWQiLCJ1c2VyIiwiaWQiLCJwZXJtcyIsImdldENsYXNzTGV2ZWxQZXJtaXNzaW9ucyIsImlzUmVhZE9wZXJhdGlvbiIsInByb3RlY3RlZEZpZWxkc1BvaW50ZXJQZXJtIiwic3RhcnRzV2l0aCIsIm1hcCIsInN1YnN0cmluZyIsIm5ld1Byb3RlY3RlZEZpZWxkcyIsIm92ZXJyaWRlUHJvdGVjdGVkRmllbGRzIiwicG9pbnRlclBlcm0iLCJwb2ludGVyUGVybUluY2x1ZGVzVXNlciIsInJlYWRVc2VyRmllbGRWYWx1ZSIsImlzQXJyYXkiLCJzb21lIiwib2JqZWN0SWQiLCJmaWVsZHMiLCJ2IiwiaXNVc2VyQ2xhc3MiLCJwYXNzd29yZCIsIl9oYXNoZWRfcGFzc3dvcmQiLCJzZXNzaW9uVG9rZW4iLCJfcGVybXMkcHJvdGVjdGVkRmllbGQiLCJfcGVybXMkcHJvdGVjdGVkRmllbGQyIiwiayIsInRlbXBvcmFyeUtleXMiLCJjaGFyQXQiLCJhdXRoRGF0YSIsInNwZWNpYWxLZXlzRm9yVXBkYXRlIiwiaXNTcGVjaWFsVXBkYXRlS2V5Iiwiam9pblRhYmxlTmFtZSIsImZsYXR0ZW5VcGRhdGVPcGVyYXRvcnNGb3JDcmVhdGUiLCJfX29wIiwiYW1vdW50IiwiSU5WQUxJRF9KU09OIiwib2JqZWN0cyIsIkNPTU1BTkRfVU5BVkFJTEFCTEUiLCJ0cmFuc2Zvcm1BdXRoRGF0YSIsInByb3ZpZGVyIiwicHJvdmlkZXJEYXRhIiwiZmllbGROYW1lIiwidHlwZSIsInVudHJhbnNmb3JtT2JqZWN0QUNMIiwiX3JlZjIiLCJvdXRwdXQiLCJnZXRSb290RmllbGROYW1lIiwic3BsaXQiLCJyZWxhdGlvblNjaGVtYSIsInJlbGF0ZWRJZCIsIm93bmluZ0lkIiwiY29udmVydEVtYWlsVG9Mb3dlcmNhc2UiLCJvcHRpb25zIiwidG9Mb3dlckNhc2UiLCJjb252ZXJ0VXNlcm5hbWVUb0xvd2VyY2FzZSIsIkRhdGFiYXNlQ29udHJvbGxlciIsImNvbnN0cnVjdG9yIiwiYWRhcHRlciIsImlkZW1wb3RlbmN5T3B0aW9ucyIsInNjaGVtYVByb21pc2UiLCJfdHJhbnNhY3Rpb25hbFNlc3Npb24iLCJjb2xsZWN0aW9uRXhpc3RzIiwiY2xhc3NFeGlzdHMiLCJwdXJnZUNvbGxlY3Rpb24iLCJsb2FkU2NoZW1hIiwidGhlbiIsInNjaGVtYUNvbnRyb2xsZXIiLCJnZXRPbmVTY2hlbWEiLCJkZWxldGVPYmplY3RzQnlRdWVyeSIsInZhbGlkYXRlQ2xhc3NOYW1lIiwiY2xhc3NOYW1lSXNWYWxpZCIsIlByb21pc2UiLCJyZWplY3QiLCJJTlZBTElEX0NMQVNTX05BTUUiLCJyZXNvbHZlIiwiY2xlYXJDYWNoZSIsImxvYWQiLCJsb2FkU2NoZW1hSWZOZWVkZWQiLCJyZWRpcmVjdENsYXNzTmFtZUZvcktleSIsInQiLCJnZXRFeHBlY3RlZFR5cGUiLCJ0YXJnZXRDbGFzcyIsInZhbGlkYXRlT2JqZWN0IiwicnVuT3B0aW9ucyIsIm1haW50ZW5hbmNlIiwicyIsImNhbkFkZEZpZWxkIiwibWFueSIsInVwc2VydCIsImFkZHNGaWVsZCIsInNraXBTYW5pdGl6YXRpb24iLCJ2YWxpZGF0ZU9ubHkiLCJ2YWxpZFNjaGVtYUNvbnRyb2xsZXIiLCJVdGlscyIsImNoZWNrUHJvaGliaXRlZEtleXdvcmRzIiwiZXJyb3IiLCJvcmlnaW5hbFF1ZXJ5Iiwib3JpZ2luYWxVcGRhdGUiLCJkZWVwY29weSIsInJlbGF0aW9uVXBkYXRlcyIsInZhbGlkYXRlUGVybWlzc2lvbiIsImNvbGxlY3RSZWxhdGlvblVwZGF0ZXMiLCJhZGRQb2ludGVyUGVybWlzc2lvbnMiLCJjYXRjaCIsInJvb3RGaWVsZE5hbWUiLCJmaWVsZE5hbWVJc1ZhbGlkIiwidXBkYXRlT3BlcmF0aW9uIiwiaW5uZXJLZXkiLCJJTlZBTElEX05FU1RFRF9LRVkiLCJmaW5kIiwiT0JKRUNUX05PVF9GT1VORCIsInVwZGF0ZU9iamVjdHNCeVF1ZXJ5IiwidXBzZXJ0T25lT2JqZWN0IiwiZmluZE9uZUFuZFVwZGF0ZSIsImhhbmRsZVJlbGF0aW9uVXBkYXRlcyIsIl9zYW5pdGl6ZURhdGFiYXNlUmVzdWx0Iiwib3BzIiwiZGVsZXRlTWUiLCJwcm9jZXNzIiwib3AiLCJ4IiwicGVuZGluZyIsImFkZFJlbGF0aW9uIiwicmVtb3ZlUmVsYXRpb24iLCJhbGwiLCJmcm9tQ2xhc3NOYW1lIiwiZnJvbUlkIiwidG9JZCIsImRvYyIsImNvZGUiLCJkZXN0cm95IiwicGFyc2VGb3JtYXRTY2hlbWEiLCJjcmVhdGUiLCJvcmlnaW5hbE9iamVjdCIsImNyZWF0ZWRBdCIsImlzbyIsIl9fdHlwZSIsInVwZGF0ZWRBdCIsImVuZm9yY2VDbGFzc0V4aXN0cyIsImNyZWF0ZU9iamVjdCIsImNvbnZlcnRTY2hlbWFUb0FkYXB0ZXJTY2hlbWEiLCJjbGFzc1NjaGVtYSIsInNjaGVtYURhdGEiLCJzY2hlbWFGaWVsZHMiLCJuZXdLZXlzIiwiZmllbGQiLCJhY3Rpb24iLCJkZWxldGVFdmVyeXRoaW5nIiwiZmFzdCIsIlNjaGVtYUNhY2hlIiwiY2xlYXIiLCJkZWxldGVBbGxDbGFzc2VzIiwicmVsYXRlZElkcyIsInF1ZXJ5T3B0aW9ucyIsInNraXAiLCJsaW1pdCIsInNvcnQiLCJmaW5kT3B0aW9ucyIsImNhblNvcnRPbkpvaW5UYWJsZXMiLCJfaWQiLCJyZXN1bHRzIiwib3duaW5nSWRzIiwicmVkdWNlSW5SZWxhdGlvbiIsInByb21pc2VzIiwib3JzIiwiYVF1ZXJ5IiwiaW5kZXgiLCJhbmRzIiwib3RoZXJLZXlzIiwicXVlcmllcyIsImNvbnN0cmFpbnRLZXkiLCJpc05lZ2F0aW9uIiwiciIsInEiLCJpZHMiLCJhZGROb3RJbk9iamVjdElkc0lkcyIsImFkZEluT2JqZWN0SWRzSWRzIiwicmVkdWNlUmVsYXRpb25LZXlzIiwicmVsYXRlZFRvIiwiaWRzRnJvbVN0cmluZyIsImlkc0Zyb21FcSIsImlkc0Zyb21JbiIsImFsbElkcyIsImxpc3QiLCJ0b3RhbExlbmd0aCIsInJlZHVjZSIsIm1lbW8iLCJpZHNJbnRlcnNlY3Rpb24iLCJpbnRlcnNlY3QiLCJiaWciLCIkZXEiLCJpZHNGcm9tTmluIiwiU2V0IiwiJG5pbiIsImNvdW50IiwiZGlzdGluY3QiLCJwaXBlbGluZSIsInJlYWRQcmVmZXJlbmNlIiwiY2FzZUluc2Vuc2l0aXZlIiwiZXhwbGFpbiIsIl9jcmVhdGVkX2F0IiwiX3VwZGF0ZWRfYXQiLCJlbmFibGVDb2xsYXRpb25DYXNlQ29tcGFyaXNvbiIsImFkZFByb3RlY3RlZEZpZWxkcyIsImFnZ3JlZ2F0ZSIsIklOVEVSTkFMX1NFUlZFUl9FUlJPUiIsImRlbGV0ZVNjaGVtYSIsImRlbGV0ZUNsYXNzIiwid2FzUGFyc2VDb2xsZWN0aW9uIiwicmVsYXRpb25GaWVsZE5hbWVzIiwibmFtZSIsImRlbCIsInJlbG9hZERhdGEiLCJvYmplY3RUb0VudHJpZXNTdHJpbmdzIiwiZW50cmllcyIsImEiLCJKU09OIiwic3RyaW5naWZ5Iiwiam9pbiIsInJlZHVjZU9yT3BlcmF0aW9uIiwicmVwZWF0IiwiaiIsInNob3J0ZXIiLCJsb25nZXIiLCJmb3VuZEVudHJpZXMiLCJhY2MiLCJzaG9ydGVyRW50cmllcyIsInNwbGljZSIsInJlZHVjZUFuZE9wZXJhdGlvbiIsInRlc3RQZXJtaXNzaW9uc0ZvckNsYXNzTmFtZSIsInVzZXJBQ0wiLCJncm91cEtleSIsInBlcm1GaWVsZHMiLCJwb2ludGVyRmllbGRzIiwidXNlclBvaW50ZXIiLCJmaWVsZERlc2NyaXB0b3IiLCJmaWVsZFR5cGUiLCJxdWVyeUNsYXVzZSIsIiRhbGwiLCJhc3NpZ24iLCJwcmVzZXJ2ZUtleXMiLCJzZXJ2ZXJPbmx5S2V5cyIsImF1dGhlbnRpY2F0ZWQiLCJyb2xlcyIsInVzZXJSb2xlcyIsInByb3RlY3RlZEtleXNTZXRzIiwicHJvdGVjdGVkS2V5cyIsIm5leHQiLCJjcmVhdGVUcmFuc2FjdGlvbmFsU2Vzc2lvbiIsInRyYW5zYWN0aW9uYWxTZXNzaW9uIiwiY29tbWl0VHJhbnNhY3Rpb25hbFNlc3Npb24iLCJhYm9ydFRyYW5zYWN0aW9uYWxTZXNzaW9uIiwicGVyZm9ybUluaXRpYWxpemF0aW9uIiwiVm9sYXRpbGVDbGFzc2VzU2NoZW1hcyIsInJlcXVpcmVkVXNlckZpZWxkcyIsImRlZmF1bHRDb2x1bW5zIiwiX0RlZmF1bHQiLCJfVXNlciIsInJlcXVpcmVkUm9sZUZpZWxkcyIsIl9Sb2xlIiwicmVxdWlyZWRJZGVtcG90ZW5jeUZpZWxkcyIsIl9JZGVtcG90ZW5jeSIsImVuc3VyZVVuaXF1ZW5lc3MiLCJsb2dnZXIiLCJ3YXJuIiwiZW5zdXJlSW5kZXgiLCJpc01vbmdvQWRhcHRlciIsIk1vbmdvU3RvcmFnZUFkYXB0ZXIiLCJpc1Bvc3RncmVzQWRhcHRlciIsIlBvc3RncmVzU3RvcmFnZUFkYXB0ZXIiLCJ0dGwiLCJzZXRJZGVtcG90ZW5jeUZ1bmN0aW9uIiwidXBkYXRlU2NoZW1hV2l0aEluZGV4ZXMiLCJfZXhwYW5kUmVzdWx0T25LZXlQYXRoIiwicGF0aCIsImZpcnN0S2V5IiwibmV4dFBhdGgiLCJzbGljZSIsInJlcXVlc3RLZXl3b3JkRGVueWxpc3QiLCJrZXl3b3JkIiwib2JqZWN0Q29udGFpbnNLZXlWYWx1ZSIsInJlc3BvbnNlIiwia2V5VXBkYXRlIiwibW9kdWxlIiwiZXhwb3J0cyIsIl92YWxpZGF0ZVF1ZXJ5Il0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NvbnRyb2xsZXJzL0RhdGFiYXNlQ29udHJvbGxlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyLvu78vLyBAZmxvd1xuLy8gQSBkYXRhYmFzZSBhZGFwdGVyIHRoYXQgd29ya3Mgd2l0aCBkYXRhIGV4cG9ydGVkIGZyb20gdGhlIGhvc3RlZFxuLy8gUGFyc2UgZGF0YWJhc2UuXG5cbi8vIEBmbG93LWRpc2FibGUtbmV4dFxuaW1wb3J0IHsgUGFyc2UgfSBmcm9tICdwYXJzZS9ub2RlJztcbi8vIEBmbG93LWRpc2FibGUtbmV4dFxuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbi8vIEBmbG93LWRpc2FibGUtbmV4dFxuaW1wb3J0IGludGVyc2VjdCBmcm9tICdpbnRlcnNlY3QnO1xuLy8gQGZsb3ctZGlzYWJsZS1uZXh0XG5pbXBvcnQgZGVlcGNvcHkgZnJvbSAnZGVlcGNvcHknO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuLi9sb2dnZXInO1xuaW1wb3J0IFV0aWxzIGZyb20gJy4uL1V0aWxzJztcbmltcG9ydCAqIGFzIFNjaGVtYUNvbnRyb2xsZXIgZnJvbSAnLi9TY2hlbWFDb250cm9sbGVyJztcbmltcG9ydCB7IFN0b3JhZ2VBZGFwdGVyIH0gZnJvbSAnLi4vQWRhcHRlcnMvU3RvcmFnZS9TdG9yYWdlQWRhcHRlcic7XG5pbXBvcnQgTW9uZ29TdG9yYWdlQWRhcHRlciBmcm9tICcuLi9BZGFwdGVycy9TdG9yYWdlL01vbmdvL01vbmdvU3RvcmFnZUFkYXB0ZXInO1xuaW1wb3J0IFBvc3RncmVzU3RvcmFnZUFkYXB0ZXIgZnJvbSAnLi4vQWRhcHRlcnMvU3RvcmFnZS9Qb3N0Z3Jlcy9Qb3N0Z3Jlc1N0b3JhZ2VBZGFwdGVyJztcbmltcG9ydCBTY2hlbWFDYWNoZSBmcm9tICcuLi9BZGFwdGVycy9DYWNoZS9TY2hlbWFDYWNoZSc7XG5pbXBvcnQgdHlwZSB7IExvYWRTY2hlbWFPcHRpb25zIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFBhcnNlU2VydmVyT3B0aW9ucyB9IGZyb20gJy4uL09wdGlvbnMnO1xuaW1wb3J0IHR5cGUgeyBRdWVyeU9wdGlvbnMsIEZ1bGxRdWVyeU9wdGlvbnMgfSBmcm9tICcuLi9BZGFwdGVycy9TdG9yYWdlL1N0b3JhZ2VBZGFwdGVyJztcblxuZnVuY3Rpb24gYWRkV3JpdGVBQ0wocXVlcnksIGFjbCkge1xuICBjb25zdCBuZXdRdWVyeSA9IF8uY2xvbmVEZWVwKHF1ZXJ5KTtcbiAgLy9DYW4ndCBiZSBhbnkgZXhpc3RpbmcgJ193cGVybScgcXVlcnksIHdlIGRvbid0IGFsbG93IGNsaWVudCBxdWVyaWVzIG9uIHRoYXQsIG5vIG5lZWQgdG8gJGFuZFxuICBuZXdRdWVyeS5fd3Blcm0gPSB7ICRpbjogW251bGwsIC4uLmFjbF0gfTtcbiAgcmV0dXJuIG5ld1F1ZXJ5O1xufVxuXG5mdW5jdGlvbiBhZGRSZWFkQUNMKHF1ZXJ5LCBhY2wpIHtcbiAgY29uc3QgbmV3UXVlcnkgPSBfLmNsb25lRGVlcChxdWVyeSk7XG4gIC8vQ2FuJ3QgYmUgYW55IGV4aXN0aW5nICdfcnBlcm0nIHF1ZXJ5LCB3ZSBkb24ndCBhbGxvdyBjbGllbnQgcXVlcmllcyBvbiB0aGF0LCBubyBuZWVkIHRvICRhbmRcbiAgbmV3UXVlcnkuX3JwZXJtID0geyAkaW46IFtudWxsLCAnKicsIC4uLmFjbF0gfTtcbiAgcmV0dXJuIG5ld1F1ZXJ5O1xufVxuXG4vLyBUcmFuc2Zvcm1zIGEgUkVTVCBBUEkgZm9ybWF0dGVkIEFDTCBvYmplY3QgdG8gb3VyIHR3by1maWVsZCBtb25nbyBmb3JtYXQuXG5jb25zdCB0cmFuc2Zvcm1PYmplY3RBQ0wgPSAoeyBBQ0wsIC4uLnJlc3VsdCB9KSA9PiB7XG4gIGlmICghQUNMKSB7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHJlc3VsdC5fd3Blcm0gPSBbXTtcbiAgcmVzdWx0Ll9ycGVybSA9IFtdO1xuXG4gIGZvciAoY29uc3QgZW50cnkgaW4gQUNMKSB7XG4gICAgaWYgKEFDTFtlbnRyeV0ucmVhZCkge1xuICAgICAgcmVzdWx0Ll9ycGVybS5wdXNoKGVudHJ5KTtcbiAgICB9XG4gICAgaWYgKEFDTFtlbnRyeV0ud3JpdGUpIHtcbiAgICAgIHJlc3VsdC5fd3Blcm0ucHVzaChlbnRyeSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5jb25zdCBzcGVjaWFsUXVlcnlLZXlzID0gWyckYW5kJywgJyRvcicsICckbm9yJywgJ19ycGVybScsICdfd3Blcm0nXTtcbmNvbnN0IHNwZWNpYWxNYXN0ZXJRdWVyeUtleXMgPSBbXG4gIC4uLnNwZWNpYWxRdWVyeUtleXMsXG4gICdfZW1haWxfdmVyaWZ5X3Rva2VuJyxcbiAgJ19wZXJpc2hhYmxlX3Rva2VuJyxcbiAgJ190b21ic3RvbmUnLFxuICAnX2VtYWlsX3ZlcmlmeV90b2tlbl9leHBpcmVzX2F0JyxcbiAgJ19mYWlsZWRfbG9naW5fY291bnQnLFxuICAnX2FjY291bnRfbG9ja291dF9leHBpcmVzX2F0JyxcbiAgJ19wYXNzd29yZF9jaGFuZ2VkX2F0JyxcbiAgJ19wYXNzd29yZF9oaXN0b3J5Jyxcbl07XG5cbmNvbnN0IHZhbGlkYXRlUXVlcnkgPSAoXG4gIHF1ZXJ5OiBhbnksXG4gIGlzTWFzdGVyOiBib29sZWFuLFxuICBpc01haW50ZW5hbmNlOiBib29sZWFuLFxuICB1cGRhdGU6IGJvb2xlYW5cbik6IHZvaWQgPT4ge1xuICBpZiAoaXNNYWludGVuYW5jZSkge1xuICAgIGlzTWFzdGVyID0gdHJ1ZTtcbiAgfVxuICBpZiAocXVlcnkuQUNMKSB7XG4gICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfUVVFUlksICdDYW5ub3QgcXVlcnkgb24gQUNMLicpO1xuICB9XG5cbiAgaWYgKHF1ZXJ5LiRvcikge1xuICAgIGlmIChxdWVyeS4kb3IgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgcXVlcnkuJG9yLmZvckVhY2godmFsdWUgPT4gdmFsaWRhdGVRdWVyeSh2YWx1ZSwgaXNNYXN0ZXIsIGlzTWFpbnRlbmFuY2UsIHVwZGF0ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9RVUVSWSwgJ0JhZCAkb3IgZm9ybWF0IC0gdXNlIGFuIGFycmF5IHZhbHVlLicpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChxdWVyeS4kYW5kKSB7XG4gICAgaWYgKHF1ZXJ5LiRhbmQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgcXVlcnkuJGFuZC5mb3JFYWNoKHZhbHVlID0+IHZhbGlkYXRlUXVlcnkodmFsdWUsIGlzTWFzdGVyLCBpc01haW50ZW5hbmNlLCB1cGRhdGUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfUVVFUlksICdCYWQgJGFuZCBmb3JtYXQgLSB1c2UgYW4gYXJyYXkgdmFsdWUuJyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHF1ZXJ5LiRub3IpIHtcbiAgICBpZiAocXVlcnkuJG5vciBpbnN0YW5jZW9mIEFycmF5ICYmIHF1ZXJ5LiRub3IubGVuZ3RoID4gMCkge1xuICAgICAgcXVlcnkuJG5vci5mb3JFYWNoKHZhbHVlID0+IHZhbGlkYXRlUXVlcnkodmFsdWUsIGlzTWFzdGVyLCBpc01haW50ZW5hbmNlLCB1cGRhdGUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLFxuICAgICAgICAnQmFkICRub3IgZm9ybWF0IC0gdXNlIGFuIGFycmF5IG9mIGF0IGxlYXN0IDEgdmFsdWUuJ1xuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBPYmplY3Qua2V5cyhxdWVyeSkuZm9yRWFjaChrZXkgPT4ge1xuICAgIGlmIChxdWVyeSAmJiBxdWVyeVtrZXldICYmIHF1ZXJ5W2tleV0uJHJlZ2V4KSB7XG4gICAgICBpZiAodHlwZW9mIHF1ZXJ5W2tleV0uJG9wdGlvbnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghcXVlcnlba2V5XS4kb3B0aW9ucy5tYXRjaCgvXltpbXhzXSskLykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLFxuICAgICAgICAgICAgYEJhZCAkb3B0aW9ucyB2YWx1ZSBmb3IgcXVlcnk6ICR7cXVlcnlba2V5XS4kb3B0aW9uc31gXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoXG4gICAgICAha2V5Lm1hdGNoKC9eW2EtekEtWl1bYS16QS1aMC05X1xcLl0qJC8pICYmXG4gICAgICAoKCFzcGVjaWFsUXVlcnlLZXlzLmluY2x1ZGVzKGtleSkgJiYgIWlzTWFzdGVyICYmICF1cGRhdGUpIHx8XG4gICAgICAgICh1cGRhdGUgJiYgaXNNYXN0ZXIgJiYgIXNwZWNpYWxNYXN0ZXJRdWVyeUtleXMuaW5jbHVkZXMoa2V5KSkpXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSwgYEludmFsaWQga2V5IG5hbWU6ICR7a2V5fWApO1xuICAgIH1cbiAgfSk7XG59O1xuXG4vLyBGaWx0ZXJzIG91dCBhbnkgZGF0YSB0aGF0IHNob3VsZG4ndCBiZSBvbiB0aGlzIFJFU1QtZm9ybWF0dGVkIG9iamVjdC5cbmNvbnN0IGZpbHRlclNlbnNpdGl2ZURhdGEgPSAoXG4gIGlzTWFzdGVyOiBib29sZWFuLFxuICBpc01haW50ZW5hbmNlOiBib29sZWFuLFxuICBhY2xHcm91cDogYW55W10sXG4gIGF1dGg6IGFueSxcbiAgb3BlcmF0aW9uOiBhbnksXG4gIHNjaGVtYTogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyIHwgYW55LFxuICBjbGFzc05hbWU6IHN0cmluZyxcbiAgcHJvdGVjdGVkRmllbGRzOiBudWxsIHwgQXJyYXk8YW55PixcbiAgb2JqZWN0OiBhbnlcbikgPT4ge1xuICBsZXQgdXNlcklkID0gbnVsbDtcbiAgaWYgKGF1dGggJiYgYXV0aC51c2VyKSB1c2VySWQgPSBhdXRoLnVzZXIuaWQ7XG5cbiAgLy8gcmVwbGFjZSBwcm90ZWN0ZWRGaWVsZHMgd2hlbiB1c2luZyBwb2ludGVyLXBlcm1pc3Npb25zXG4gIGNvbnN0IHBlcm1zID1cbiAgICBzY2hlbWEgJiYgc2NoZW1hLmdldENsYXNzTGV2ZWxQZXJtaXNzaW9ucyA/IHNjaGVtYS5nZXRDbGFzc0xldmVsUGVybWlzc2lvbnMoY2xhc3NOYW1lKSA6IHt9O1xuICBpZiAocGVybXMpIHtcbiAgICBjb25zdCBpc1JlYWRPcGVyYXRpb24gPSBbJ2dldCcsICdmaW5kJ10uaW5kZXhPZihvcGVyYXRpb24pID4gLTE7XG5cbiAgICBpZiAoaXNSZWFkT3BlcmF0aW9uICYmIHBlcm1zLnByb3RlY3RlZEZpZWxkcykge1xuICAgICAgLy8gZXh0cmFjdCBwcm90ZWN0ZWRGaWVsZHMgYWRkZWQgd2l0aCB0aGUgcG9pbnRlci1wZXJtaXNzaW9uIHByZWZpeFxuICAgICAgY29uc3QgcHJvdGVjdGVkRmllbGRzUG9pbnRlclBlcm0gPSBPYmplY3Qua2V5cyhwZXJtcy5wcm90ZWN0ZWRGaWVsZHMpXG4gICAgICAgIC5maWx0ZXIoa2V5ID0+IGtleS5zdGFydHNXaXRoKCd1c2VyRmllbGQ6JykpXG4gICAgICAgIC5tYXAoa2V5ID0+IHtcbiAgICAgICAgICByZXR1cm4geyBrZXk6IGtleS5zdWJzdHJpbmcoMTApLCB2YWx1ZTogcGVybXMucHJvdGVjdGVkRmllbGRzW2tleV0gfTtcbiAgICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IG5ld1Byb3RlY3RlZEZpZWxkczogQXJyYXk8c3RyaW5nPltdID0gW107XG4gICAgICBsZXQgb3ZlcnJpZGVQcm90ZWN0ZWRGaWVsZHMgPSBmYWxzZTtcblxuICAgICAgLy8gY2hlY2sgaWYgdGhlIG9iamVjdCBncmFudHMgdGhlIGN1cnJlbnQgdXNlciBhY2Nlc3MgYmFzZWQgb24gdGhlIGV4dHJhY3RlZCBmaWVsZHNcbiAgICAgIHByb3RlY3RlZEZpZWxkc1BvaW50ZXJQZXJtLmZvckVhY2gocG9pbnRlclBlcm0gPT4ge1xuICAgICAgICBsZXQgcG9pbnRlclBlcm1JbmNsdWRlc1VzZXIgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgcmVhZFVzZXJGaWVsZFZhbHVlID0gb2JqZWN0W3BvaW50ZXJQZXJtLmtleV07XG4gICAgICAgIGlmIChyZWFkVXNlckZpZWxkVmFsdWUpIHtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyZWFkVXNlckZpZWxkVmFsdWUpKSB7XG4gICAgICAgICAgICBwb2ludGVyUGVybUluY2x1ZGVzVXNlciA9IHJlYWRVc2VyRmllbGRWYWx1ZS5zb21lKFxuICAgICAgICAgICAgICB1c2VyID0+IHVzZXIub2JqZWN0SWQgJiYgdXNlci5vYmplY3RJZCA9PT0gdXNlcklkXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb2ludGVyUGVybUluY2x1ZGVzVXNlciA9XG4gICAgICAgICAgICAgIHJlYWRVc2VyRmllbGRWYWx1ZS5vYmplY3RJZCAmJiByZWFkVXNlckZpZWxkVmFsdWUub2JqZWN0SWQgPT09IHVzZXJJZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocG9pbnRlclBlcm1JbmNsdWRlc1VzZXIpIHtcbiAgICAgICAgICBvdmVycmlkZVByb3RlY3RlZEZpZWxkcyA9IHRydWU7XG4gICAgICAgICAgbmV3UHJvdGVjdGVkRmllbGRzLnB1c2gocG9pbnRlclBlcm0udmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gaWYgYXQgbGVhc3Qgb25lIHBvaW50ZXItcGVybWlzc2lvbiBhZmZlY3RlZCB0aGUgY3VycmVudCB1c2VyXG4gICAgICAvLyBpbnRlcnNlY3QgdnMgcHJvdGVjdGVkRmllbGRzIGZyb20gcHJldmlvdXMgc3RhZ2UgKEBzZWUgYWRkUHJvdGVjdGVkRmllbGRzKVxuICAgICAgLy8gU2V0cyB0aGVvcnkgKGludGVyc2VjdGlvbnMpOiBBIHggKEIgeCBDKSA9PSAoQSB4IEIpIHggQ1xuICAgICAgaWYgKG92ZXJyaWRlUHJvdGVjdGVkRmllbGRzICYmIHByb3RlY3RlZEZpZWxkcykge1xuICAgICAgICBuZXdQcm90ZWN0ZWRGaWVsZHMucHVzaChwcm90ZWN0ZWRGaWVsZHMpO1xuICAgICAgfVxuICAgICAgLy8gaW50ZXJzZWN0IGFsbCBzZXRzIG9mIHByb3RlY3RlZEZpZWxkc1xuICAgICAgbmV3UHJvdGVjdGVkRmllbGRzLmZvckVhY2goZmllbGRzID0+IHtcbiAgICAgICAgaWYgKGZpZWxkcykge1xuICAgICAgICAgIC8vIGlmIHRoZXJlJ3JlIG5vIHByb3RjdGVkRmllbGRzIGJ5IG90aGVyIGNyaXRlcmlhICggaWQgLyByb2xlIC8gYXV0aClcbiAgICAgICAgICAvLyB0aGVuIHdlIG11c3QgaW50ZXJzZWN0IGVhY2ggc2V0IChwZXIgdXNlckZpZWxkKVxuICAgICAgICAgIGlmICghcHJvdGVjdGVkRmllbGRzKSB7XG4gICAgICAgICAgICBwcm90ZWN0ZWRGaWVsZHMgPSBmaWVsZHM7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb3RlY3RlZEZpZWxkcyA9IHByb3RlY3RlZEZpZWxkcy5maWx0ZXIodiA9PiBmaWVsZHMuaW5jbHVkZXModikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgaXNVc2VyQ2xhc3MgPSBjbGFzc05hbWUgPT09ICdfVXNlcic7XG4gIGlmIChpc1VzZXJDbGFzcykge1xuICAgIG9iamVjdC5wYXNzd29yZCA9IG9iamVjdC5faGFzaGVkX3Bhc3N3b3JkO1xuICAgIGRlbGV0ZSBvYmplY3QuX2hhc2hlZF9wYXNzd29yZDtcbiAgICBkZWxldGUgb2JqZWN0LnNlc3Npb25Ub2tlbjtcbiAgfVxuXG4gIGlmIChpc01haW50ZW5hbmNlKSB7XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfVxuXG4gIC8qIHNwZWNpYWwgdHJlYXQgZm9yIHRoZSB1c2VyIGNsYXNzOiBkb24ndCBmaWx0ZXIgcHJvdGVjdGVkRmllbGRzIGlmIGN1cnJlbnRseSBsb2dnZWRpbiB1c2VyIGlzXG4gIHRoZSByZXRyaWV2ZWQgdXNlciAqL1xuICBpZiAoIShpc1VzZXJDbGFzcyAmJiB1c2VySWQgJiYgb2JqZWN0Lm9iamVjdElkID09PSB1c2VySWQpKSB7XG4gICAgcHJvdGVjdGVkRmllbGRzICYmIHByb3RlY3RlZEZpZWxkcy5mb3JFYWNoKGsgPT4gZGVsZXRlIG9iamVjdFtrXSk7XG5cbiAgICAvLyBmaWVsZHMgbm90IHJlcXVlc3RlZCBieSBjbGllbnQgKGV4Y2x1ZGVkKSxcbiAgICAvLyBidXQgd2VyZSBuZWVkZWQgdG8gYXBwbHkgcHJvdGVjdGVkRmllbGRzXG4gICAgcGVybXM/LnByb3RlY3RlZEZpZWxkcz8udGVtcG9yYXJ5S2V5cz8uZm9yRWFjaChrID0+IGRlbGV0ZSBvYmplY3Rba10pO1xuICB9XG5cbiAgZm9yIChjb25zdCBrZXkgaW4gb2JqZWN0KSB7XG4gICAgaWYgKGtleS5jaGFyQXQoMCkgPT09ICdfJykge1xuICAgICAgZGVsZXRlIG9iamVjdFtrZXldO1xuICAgIH1cbiAgfVxuXG4gIGlmICghaXNVc2VyQ2xhc3MgfHwgaXNNYXN0ZXIpIHtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgaWYgKGFjbEdyb3VwLmluZGV4T2Yob2JqZWN0Lm9iamVjdElkKSA+IC0xKSB7XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfVxuICBkZWxldGUgb2JqZWN0LmF1dGhEYXRhO1xuICByZXR1cm4gb2JqZWN0O1xufTtcblxuLy8gUnVucyBhbiB1cGRhdGUgb24gdGhlIGRhdGFiYXNlLlxuLy8gUmV0dXJucyBhIHByb21pc2UgZm9yIGFuIG9iamVjdCB3aXRoIHRoZSBuZXcgdmFsdWVzIGZvciBmaWVsZFxuLy8gbW9kaWZpY2F0aW9ucyB0aGF0IGRvbid0IGtub3cgdGhlaXIgcmVzdWx0cyBhaGVhZCBvZiB0aW1lLCBsaWtlXG4vLyAnaW5jcmVtZW50Jy5cbi8vIE9wdGlvbnM6XG4vLyAgIGFjbDogIGEgbGlzdCBvZiBzdHJpbmdzLiBJZiB0aGUgb2JqZWN0IHRvIGJlIHVwZGF0ZWQgaGFzIGFuIEFDTCxcbi8vICAgICAgICAgb25lIG9mIHRoZSBwcm92aWRlZCBzdHJpbmdzIG11c3QgcHJvdmlkZSB0aGUgY2FsbGVyIHdpdGhcbi8vICAgICAgICAgd3JpdGUgcGVybWlzc2lvbnMuXG5jb25zdCBzcGVjaWFsS2V5c0ZvclVwZGF0ZSA9IFtcbiAgJ19oYXNoZWRfcGFzc3dvcmQnLFxuICAnX3BlcmlzaGFibGVfdG9rZW4nLFxuICAnX2VtYWlsX3ZlcmlmeV90b2tlbicsXG4gICdfZW1haWxfdmVyaWZ5X3Rva2VuX2V4cGlyZXNfYXQnLFxuICAnX2FjY291bnRfbG9ja291dF9leHBpcmVzX2F0JyxcbiAgJ19mYWlsZWRfbG9naW5fY291bnQnLFxuICAnX3BlcmlzaGFibGVfdG9rZW5fZXhwaXJlc19hdCcsXG4gICdfcGFzc3dvcmRfY2hhbmdlZF9hdCcsXG4gICdfcGFzc3dvcmRfaGlzdG9yeScsXG5dO1xuXG5jb25zdCBpc1NwZWNpYWxVcGRhdGVLZXkgPSBrZXkgPT4ge1xuICByZXR1cm4gc3BlY2lhbEtleXNGb3JVcGRhdGUuaW5kZXhPZihrZXkpID49IDA7XG59O1xuXG5mdW5jdGlvbiBqb2luVGFibGVOYW1lKGNsYXNzTmFtZSwga2V5KSB7XG4gIHJldHVybiBgX0pvaW46JHtrZXl9OiR7Y2xhc3NOYW1lfWA7XG59XG5cbmNvbnN0IGZsYXR0ZW5VcGRhdGVPcGVyYXRvcnNGb3JDcmVhdGUgPSBvYmplY3QgPT4ge1xuICBmb3IgKGNvbnN0IGtleSBpbiBvYmplY3QpIHtcbiAgICBpZiAob2JqZWN0W2tleV0gJiYgb2JqZWN0W2tleV0uX19vcCkge1xuICAgICAgc3dpdGNoIChvYmplY3Rba2V5XS5fX29wKSB7XG4gICAgICAgIGNhc2UgJ0luY3JlbWVudCc6XG4gICAgICAgICAgaWYgKHR5cGVvZiBvYmplY3Rba2V5XS5hbW91bnQgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCAnb2JqZWN0cyB0byBhZGQgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBvYmplY3Rba2V5XSA9IG9iamVjdFtrZXldLmFtb3VudDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnU2V0T25JbnNlcnQnOlxuICAgICAgICAgIG9iamVjdFtrZXldID0gb2JqZWN0W2tleV0uYW1vdW50O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdBZGQnOlxuICAgICAgICAgIGlmICghKG9iamVjdFtrZXldLm9iamVjdHMgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sICdvYmplY3RzIHRvIGFkZCBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9iamVjdFtrZXldID0gb2JqZWN0W2tleV0ub2JqZWN0cztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnQWRkVW5pcXVlJzpcbiAgICAgICAgICBpZiAoIShvYmplY3Rba2V5XS5vYmplY3RzIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCAnb2JqZWN0cyB0byBhZGQgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBvYmplY3Rba2V5XSA9IG9iamVjdFtrZXldLm9iamVjdHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1JlbW92ZSc6XG4gICAgICAgICAgaWYgKCEob2JqZWN0W2tleV0ub2JqZWN0cyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgJ29iamVjdHMgdG8gYWRkIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgb2JqZWN0W2tleV0gPSBbXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRGVsZXRlJzpcbiAgICAgICAgICBkZWxldGUgb2JqZWN0W2tleV07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuQ09NTUFORF9VTkFWQUlMQUJMRSxcbiAgICAgICAgICAgIGBUaGUgJHtvYmplY3Rba2V5XS5fX29wfSBvcGVyYXRvciBpcyBub3Qgc3VwcG9ydGVkIHlldC5gXG4gICAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbmNvbnN0IHRyYW5zZm9ybUF1dGhEYXRhID0gKGNsYXNzTmFtZSwgb2JqZWN0LCBzY2hlbWEpID0+IHtcbiAgaWYgKG9iamVjdC5hdXRoRGF0YSAmJiBjbGFzc05hbWUgPT09ICdfVXNlcicpIHtcbiAgICBPYmplY3Qua2V5cyhvYmplY3QuYXV0aERhdGEpLmZvckVhY2gocHJvdmlkZXIgPT4ge1xuICAgICAgY29uc3QgcHJvdmlkZXJEYXRhID0gb2JqZWN0LmF1dGhEYXRhW3Byb3ZpZGVyXTtcbiAgICAgIGNvbnN0IGZpZWxkTmFtZSA9IGBfYXV0aF9kYXRhXyR7cHJvdmlkZXJ9YDtcbiAgICAgIGlmIChwcm92aWRlckRhdGEgPT0gbnVsbCkge1xuICAgICAgICBvYmplY3RbZmllbGROYW1lXSA9IHtcbiAgICAgICAgICBfX29wOiAnRGVsZXRlJyxcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9iamVjdFtmaWVsZE5hbWVdID0gcHJvdmlkZXJEYXRhO1xuICAgICAgICBzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0gPSB7IHR5cGU6ICdPYmplY3QnIH07XG4gICAgICB9XG4gICAgfSk7XG4gICAgZGVsZXRlIG9iamVjdC5hdXRoRGF0YTtcbiAgfVxufTtcbi8vIFRyYW5zZm9ybXMgYSBEYXRhYmFzZSBmb3JtYXQgQUNMIHRvIGEgUkVTVCBBUEkgZm9ybWF0IEFDTFxuY29uc3QgdW50cmFuc2Zvcm1PYmplY3RBQ0wgPSAoeyBfcnBlcm0sIF93cGVybSwgLi4ub3V0cHV0IH0pID0+IHtcbiAgaWYgKF9ycGVybSB8fCBfd3Blcm0pIHtcbiAgICBvdXRwdXQuQUNMID0ge307XG5cbiAgICAoX3JwZXJtIHx8IFtdKS5mb3JFYWNoKGVudHJ5ID0+IHtcbiAgICAgIGlmICghb3V0cHV0LkFDTFtlbnRyeV0pIHtcbiAgICAgICAgb3V0cHV0LkFDTFtlbnRyeV0gPSB7IHJlYWQ6IHRydWUgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC5BQ0xbZW50cnldWydyZWFkJ10gPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgKF93cGVybSB8fCBbXSkuZm9yRWFjaChlbnRyeSA9PiB7XG4gICAgICBpZiAoIW91dHB1dC5BQ0xbZW50cnldKSB7XG4gICAgICAgIG91dHB1dC5BQ0xbZW50cnldID0geyB3cml0ZTogdHJ1ZSB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0LkFDTFtlbnRyeV1bJ3dyaXRlJ10gPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHJldHVybiBvdXRwdXQ7XG59O1xuXG4vKipcbiAqIFdoZW4gcXVlcnlpbmcsIHRoZSBmaWVsZE5hbWUgbWF5IGJlIGNvbXBvdW5kLCBleHRyYWN0IHRoZSByb290IGZpZWxkTmFtZVxuICogICAgIGB0ZW1wZXJhdHVyZS5jZWxzaXVzYCBiZWNvbWVzIGB0ZW1wZXJhdHVyZWBcbiAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZE5hbWUgdGhhdCBtYXkgYmUgYSBjb21wb3VuZCBmaWVsZCBuYW1lXG4gKiBAcmV0dXJucyB7c3RyaW5nfSB0aGUgcm9vdCBuYW1lIG9mIHRoZSBmaWVsZFxuICovXG5jb25zdCBnZXRSb290RmllbGROYW1lID0gKGZpZWxkTmFtZTogc3RyaW5nKTogc3RyaW5nID0+IHtcbiAgcmV0dXJuIGZpZWxkTmFtZS5zcGxpdCgnLicpWzBdO1xufTtcblxuY29uc3QgcmVsYXRpb25TY2hlbWEgPSB7XG4gIGZpZWxkczogeyByZWxhdGVkSWQ6IHsgdHlwZTogJ1N0cmluZycgfSwgb3duaW5nSWQ6IHsgdHlwZTogJ1N0cmluZycgfSB9LFxufTtcblxuY29uc3QgY29udmVydEVtYWlsVG9Mb3dlcmNhc2UgPSAob2JqZWN0LCBjbGFzc05hbWUsIG9wdGlvbnMpID0+IHtcbiAgaWYgKGNsYXNzTmFtZSA9PT0gJ19Vc2VyJyAmJiBvcHRpb25zLmNvbnZlcnRFbWFpbFRvTG93ZXJjYXNlKSB7XG4gICAgaWYgKHR5cGVvZiBvYmplY3RbJ2VtYWlsJ10gPT09ICdzdHJpbmcnKSB7XG4gICAgICBvYmplY3RbJ2VtYWlsJ10gPSBvYmplY3RbJ2VtYWlsJ10udG9Mb3dlckNhc2UoKTtcbiAgICB9XG4gIH1cbn07XG5cbmNvbnN0IGNvbnZlcnRVc2VybmFtZVRvTG93ZXJjYXNlID0gKG9iamVjdCwgY2xhc3NOYW1lLCBvcHRpb25zKSA9PiB7XG4gIGlmIChjbGFzc05hbWUgPT09ICdfVXNlcicgJiYgb3B0aW9ucy5jb252ZXJ0VXNlcm5hbWVUb0xvd2VyY2FzZSkge1xuICAgIGlmICh0eXBlb2Ygb2JqZWN0Wyd1c2VybmFtZSddID09PSAnc3RyaW5nJykge1xuICAgICAgb2JqZWN0Wyd1c2VybmFtZSddID0gb2JqZWN0Wyd1c2VybmFtZSddLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuICB9XG59O1xuXG5jbGFzcyBEYXRhYmFzZUNvbnRyb2xsZXIge1xuICBhZGFwdGVyOiBTdG9yYWdlQWRhcHRlcjtcbiAgc2NoZW1hQ2FjaGU6IGFueTtcbiAgc2NoZW1hUHJvbWlzZTogP1Byb21pc2U8U2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyPjtcbiAgX3RyYW5zYWN0aW9uYWxTZXNzaW9uOiA/YW55O1xuICBvcHRpb25zOiBQYXJzZVNlcnZlck9wdGlvbnM7XG4gIGlkZW1wb3RlbmN5T3B0aW9uczogYW55O1xuXG4gIGNvbnN0cnVjdG9yKGFkYXB0ZXI6IFN0b3JhZ2VBZGFwdGVyLCBvcHRpb25zOiBQYXJzZVNlcnZlck9wdGlvbnMpIHtcbiAgICB0aGlzLmFkYXB0ZXIgPSBhZGFwdGVyO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdGhpcy5pZGVtcG90ZW5jeU9wdGlvbnMgPSB0aGlzLm9wdGlvbnMuaWRlbXBvdGVuY3lPcHRpb25zIHx8IHt9O1xuICAgIC8vIFByZXZlbnQgbXV0YWJsZSB0aGlzLnNjaGVtYSwgb3RoZXJ3aXNlIG9uZSByZXF1ZXN0IGNvdWxkIHVzZVxuICAgIC8vIG11bHRpcGxlIHNjaGVtYXMsIHNvIGluc3RlYWQgdXNlIGxvYWRTY2hlbWEgdG8gZ2V0IGEgc2NoZW1hLlxuICAgIHRoaXMuc2NoZW1hUHJvbWlzZSA9IG51bGw7XG4gICAgdGhpcy5fdHJhbnNhY3Rpb25hbFNlc3Npb24gPSBudWxsO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gIH1cblxuICBjb2xsZWN0aW9uRXhpc3RzKGNsYXNzTmFtZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIHRoaXMuYWRhcHRlci5jbGFzc0V4aXN0cyhjbGFzc05hbWUpO1xuICB9XG5cbiAgcHVyZ2VDb2xsZWN0aW9uKGNsYXNzTmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpXG4gICAgICAudGhlbihzY2hlbWFDb250cm9sbGVyID0+IHNjaGVtYUNvbnRyb2xsZXIuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSkpXG4gICAgICAudGhlbihzY2hlbWEgPT4gdGhpcy5hZGFwdGVyLmRlbGV0ZU9iamVjdHNCeVF1ZXJ5KGNsYXNzTmFtZSwgc2NoZW1hLCB7fSkpO1xuICB9XG5cbiAgdmFsaWRhdGVDbGFzc05hbWUoY2xhc3NOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIVNjaGVtYUNvbnRyb2xsZXIuY2xhc3NOYW1lSXNWYWxpZChjbGFzc05hbWUpKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoXG4gICAgICAgIG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0NMQVNTX05BTUUsICdpbnZhbGlkIGNsYXNzTmFtZTogJyArIGNsYXNzTmFtZSlcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIGZvciBhIHNjaGVtYUNvbnRyb2xsZXIuXG4gIGxvYWRTY2hlbWEoXG4gICAgb3B0aW9uczogTG9hZFNjaGVtYU9wdGlvbnMgPSB7IGNsZWFyQ2FjaGU6IGZhbHNlIH1cbiAgKTogUHJvbWlzZTxTY2hlbWFDb250cm9sbGVyLlNjaGVtYUNvbnRyb2xsZXI+IHtcbiAgICBpZiAodGhpcy5zY2hlbWFQcm9taXNlICE9IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLnNjaGVtYVByb21pc2U7XG4gICAgfVxuICAgIHRoaXMuc2NoZW1hUHJvbWlzZSA9IFNjaGVtYUNvbnRyb2xsZXIubG9hZCh0aGlzLmFkYXB0ZXIsIG9wdGlvbnMpO1xuICAgIHRoaXMuc2NoZW1hUHJvbWlzZS50aGVuKFxuICAgICAgKCkgPT4gZGVsZXRlIHRoaXMuc2NoZW1hUHJvbWlzZSxcbiAgICAgICgpID0+IGRlbGV0ZSB0aGlzLnNjaGVtYVByb21pc2VcbiAgICApO1xuICAgIHJldHVybiB0aGlzLmxvYWRTY2hlbWEob3B0aW9ucyk7XG4gIH1cblxuICBsb2FkU2NoZW1hSWZOZWVkZWQoXG4gICAgc2NoZW1hQ29udHJvbGxlcjogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyLFxuICAgIG9wdGlvbnM6IExvYWRTY2hlbWFPcHRpb25zID0geyBjbGVhckNhY2hlOiBmYWxzZSB9XG4gICk6IFByb21pc2U8U2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyPiB7XG4gICAgcmV0dXJuIHNjaGVtYUNvbnRyb2xsZXIgPyBQcm9taXNlLnJlc29sdmUoc2NoZW1hQ29udHJvbGxlcikgOiB0aGlzLmxvYWRTY2hlbWEob3B0aW9ucyk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIGNsYXNzbmFtZSB0aGF0IGlzIHJlbGF0ZWQgdG8gdGhlIGdpdmVuXG4gIC8vIGNsYXNzbmFtZSB0aHJvdWdoIHRoZSBrZXkuXG4gIC8vIFRPRE86IG1ha2UgdGhpcyBub3QgaW4gdGhlIERhdGFiYXNlQ29udHJvbGxlciBpbnRlcmZhY2VcbiAgcmVkaXJlY3RDbGFzc05hbWVGb3JLZXkoY2xhc3NOYW1lOiBzdHJpbmcsIGtleTogc3RyaW5nKTogUHJvbWlzZTw/c3RyaW5nPiB7XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpLnRoZW4oc2NoZW1hID0+IHtcbiAgICAgIHZhciB0ID0gc2NoZW1hLmdldEV4cGVjdGVkVHlwZShjbGFzc05hbWUsIGtleSk7XG4gICAgICBpZiAodCAhPSBudWxsICYmIHR5cGVvZiB0ICE9PSAnc3RyaW5nJyAmJiB0LnR5cGUgPT09ICdSZWxhdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHQudGFyZ2V0Q2xhc3M7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2xhc3NOYW1lO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gVXNlcyB0aGUgc2NoZW1hIHRvIHZhbGlkYXRlIHRoZSBvYmplY3QgKFJFU1QgQVBJIGZvcm1hdCkuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gdGhlIG5ldyBzY2hlbWEuXG4gIC8vIFRoaXMgZG9lcyBub3QgdXBkYXRlIHRoaXMuc2NoZW1hLCBiZWNhdXNlIGluIGEgc2l0dWF0aW9uIGxpa2UgYVxuICAvLyBiYXRjaCByZXF1ZXN0LCB0aGF0IGNvdWxkIGNvbmZ1c2Ugb3RoZXIgdXNlcnMgb2YgdGhlIHNjaGVtYS5cbiAgdmFsaWRhdGVPYmplY3QoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0OiBhbnksXG4gICAgcXVlcnk6IGFueSxcbiAgICBydW5PcHRpb25zOiBRdWVyeU9wdGlvbnMsXG4gICAgbWFpbnRlbmFuY2U6IGJvb2xlYW5cbiAgKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgbGV0IHNjaGVtYTtcbiAgICBjb25zdCBhY2wgPSBydW5PcHRpb25zLmFjbDtcbiAgICBjb25zdCBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkO1xuICAgIHZhciBhY2xHcm91cDogc3RyaW5nW10gPSBhY2wgfHwgW107XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpXG4gICAgICAudGhlbihzID0+IHtcbiAgICAgICAgc2NoZW1hID0gcztcbiAgICAgICAgaWYgKGlzTWFzdGVyKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmNhbkFkZEZpZWxkKHNjaGVtYSwgY2xhc3NOYW1lLCBvYmplY3QsIGFjbEdyb3VwLCBydW5PcHRpb25zKTtcbiAgICAgIH0pXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiBzY2hlbWEudmFsaWRhdGVPYmplY3QoY2xhc3NOYW1lLCBvYmplY3QsIHF1ZXJ5LCBtYWludGVuYW5jZSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZShcbiAgICBjbGFzc05hbWU6IHN0cmluZyxcbiAgICBxdWVyeTogYW55LFxuICAgIHVwZGF0ZTogYW55LFxuICAgIHsgYWNsLCBtYW55LCB1cHNlcnQsIGFkZHNGaWVsZCB9OiBGdWxsUXVlcnlPcHRpb25zID0ge30sXG4gICAgc2tpcFNhbml0aXphdGlvbjogYm9vbGVhbiA9IGZhbHNlLFxuICAgIHZhbGlkYXRlT25seTogYm9vbGVhbiA9IGZhbHNlLFxuICAgIHZhbGlkU2NoZW1hQ29udHJvbGxlcjogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyXG4gICk6IFByb21pc2U8YW55PiB7XG4gICAgdHJ5IHtcbiAgICAgIFV0aWxzLmNoZWNrUHJvaGliaXRlZEtleXdvcmRzKHRoaXMub3B0aW9ucywgdXBkYXRlKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLCBlcnJvcikpO1xuICAgIH1cbiAgICBjb25zdCBvcmlnaW5hbFF1ZXJ5ID0gcXVlcnk7XG4gICAgY29uc3Qgb3JpZ2luYWxVcGRhdGUgPSB1cGRhdGU7XG4gICAgLy8gTWFrZSBhIGNvcHkgb2YgdGhlIG9iamVjdCwgc28gd2UgZG9uJ3QgbXV0YXRlIHRoZSBpbmNvbWluZyBkYXRhLlxuICAgIHVwZGF0ZSA9IGRlZXBjb3B5KHVwZGF0ZSk7XG4gICAgdmFyIHJlbGF0aW9uVXBkYXRlcyA9IFtdO1xuICAgIHZhciBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkO1xuICAgIHZhciBhY2xHcm91cCA9IGFjbCB8fCBbXTtcblxuICAgIHJldHVybiB0aGlzLmxvYWRTY2hlbWFJZk5lZWRlZCh2YWxpZFNjaGVtYUNvbnRyb2xsZXIpLnRoZW4oc2NoZW1hQ29udHJvbGxlciA9PiB7XG4gICAgICByZXR1cm4gKGlzTWFzdGVyXG4gICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgOiBzY2hlbWFDb250cm9sbGVyLnZhbGlkYXRlUGVybWlzc2lvbihjbGFzc05hbWUsIGFjbEdyb3VwLCAndXBkYXRlJylcbiAgICAgIClcbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIHJlbGF0aW9uVXBkYXRlcyA9IHRoaXMuY29sbGVjdFJlbGF0aW9uVXBkYXRlcyhjbGFzc05hbWUsIG9yaWdpbmFsUXVlcnkub2JqZWN0SWQsIHVwZGF0ZSk7XG4gICAgICAgICAgaWYgKCFpc01hc3Rlcikge1xuICAgICAgICAgICAgcXVlcnkgPSB0aGlzLmFkZFBvaW50ZXJQZXJtaXNzaW9ucyhcbiAgICAgICAgICAgICAgc2NoZW1hQ29udHJvbGxlcixcbiAgICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAndXBkYXRlJyxcbiAgICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAgIGFjbEdyb3VwXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAoYWRkc0ZpZWxkKSB7XG4gICAgICAgICAgICAgIHF1ZXJ5ID0ge1xuICAgICAgICAgICAgICAgICRhbmQ6IFtcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgICAgICAgdGhpcy5hZGRQb2ludGVyUGVybWlzc2lvbnMoXG4gICAgICAgICAgICAgICAgICAgIHNjaGVtYUNvbnRyb2xsZXIsXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgJ2FkZEZpZWxkJyxcbiAgICAgICAgICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAgICAgICAgIGFjbEdyb3VwXG4gICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghcXVlcnkpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGFjbCkge1xuICAgICAgICAgICAgcXVlcnkgPSBhZGRXcml0ZUFDTChxdWVyeSwgYWNsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFsaWRhdGVRdWVyeShxdWVyeSwgaXNNYXN0ZXIsIGZhbHNlLCB0cnVlKTtcbiAgICAgICAgICByZXR1cm4gc2NoZW1hQ29udHJvbGxlclxuICAgICAgICAgICAgLmdldE9uZVNjaGVtYShjbGFzc05hbWUsIHRydWUpXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAvLyBJZiB0aGUgc2NoZW1hIGRvZXNuJ3QgZXhpc3QsIHByZXRlbmQgaXQgZXhpc3RzIHdpdGggbm8gZmllbGRzLiBUaGlzIGJlaGF2aW9yXG4gICAgICAgICAgICAgIC8vIHdpbGwgbGlrZWx5IG5lZWQgcmV2aXNpdGluZy5cbiAgICAgICAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBmaWVsZHM6IHt9IH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oc2NoZW1hID0+IHtcbiAgICAgICAgICAgICAgT2JqZWN0LmtleXModXBkYXRlKS5mb3JFYWNoKGZpZWxkTmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGZpZWxkTmFtZS5tYXRjaCgvXmF1dGhEYXRhXFwuKFthLXpBLVowLTlfXSspXFwuaWQkLykpIHtcbiAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSxcbiAgICAgICAgICAgICAgICAgICAgYEludmFsaWQgZmllbGQgbmFtZSBmb3IgdXBkYXRlOiAke2ZpZWxkTmFtZX1gXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCByb290RmllbGROYW1lID0gZ2V0Um9vdEZpZWxkTmFtZShmaWVsZE5hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICFTY2hlbWFDb250cm9sbGVyLmZpZWxkTmFtZUlzVmFsaWQocm9vdEZpZWxkTmFtZSwgY2xhc3NOYW1lKSAmJlxuICAgICAgICAgICAgICAgICAgIWlzU3BlY2lhbFVwZGF0ZUtleShyb290RmllbGROYW1lKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLFxuICAgICAgICAgICAgICAgICAgICBgSW52YWxpZCBmaWVsZCBuYW1lIGZvciB1cGRhdGU6ICR7ZmllbGROYW1lfWBcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCB1cGRhdGVPcGVyYXRpb24gaW4gdXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgdXBkYXRlW3VwZGF0ZU9wZXJhdGlvbl0gJiZcbiAgICAgICAgICAgICAgICAgIHR5cGVvZiB1cGRhdGVbdXBkYXRlT3BlcmF0aW9uXSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHVwZGF0ZVt1cGRhdGVPcGVyYXRpb25dKS5zb21lKFxuICAgICAgICAgICAgICAgICAgICBpbm5lcktleSA9PiBpbm5lcktleS5pbmNsdWRlcygnJCcpIHx8IGlubmVyS2V5LmluY2x1ZGVzKCcuJylcbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9ORVNURURfS0VZLFxuICAgICAgICAgICAgICAgICAgICBcIk5lc3RlZCBrZXlzIHNob3VsZCBub3QgY29udGFpbiB0aGUgJyQnIG9yICcuJyBjaGFyYWN0ZXJzXCJcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHVwZGF0ZSA9IHRyYW5zZm9ybU9iamVjdEFDTCh1cGRhdGUpO1xuICAgICAgICAgICAgICBjb252ZXJ0RW1haWxUb0xvd2VyY2FzZSh1cGRhdGUsIGNsYXNzTmFtZSwgdGhpcy5vcHRpb25zKTtcbiAgICAgICAgICAgICAgY29udmVydFVzZXJuYW1lVG9Mb3dlcmNhc2UodXBkYXRlLCBjbGFzc05hbWUsIHRoaXMub3B0aW9ucyk7XG4gICAgICAgICAgICAgIHRyYW5zZm9ybUF1dGhEYXRhKGNsYXNzTmFtZSwgdXBkYXRlLCBzY2hlbWEpO1xuICAgICAgICAgICAgICBpZiAodmFsaWRhdGVPbmx5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci5maW5kKGNsYXNzTmFtZSwgc2NoZW1hLCBxdWVyeSwge30pLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgICAgICAgICAgICAgIGlmICghcmVzdWx0IHx8ICFyZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnT2JqZWN0IG5vdCBmb3VuZC4nKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHJldHVybiB7fTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAobWFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIudXBkYXRlT2JqZWN0c0J5UXVlcnkoXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWUsXG4gICAgICAgICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgICAgICAgIHVwZGF0ZSxcbiAgICAgICAgICAgICAgICAgIHRoaXMuX3RyYW5zYWN0aW9uYWxTZXNzaW9uXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmICh1cHNlcnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGFwdGVyLnVwc2VydE9uZU9iamVjdChcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgIHNjaGVtYSxcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgICAgICAgdXBkYXRlLFxuICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNhY3Rpb25hbFNlc3Npb25cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZmluZE9uZUFuZFVwZGF0ZShcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgIHNjaGVtYSxcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgICAgICAgdXBkYXRlLFxuICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNhY3Rpb25hbFNlc3Npb25cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnT2JqZWN0IG5vdCBmb3VuZC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHZhbGlkYXRlT25seSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmVsYXRpb25VcGRhdGVzKFxuICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgb3JpZ2luYWxRdWVyeS5vYmplY3RJZCxcbiAgICAgICAgICAgIHVwZGF0ZSxcbiAgICAgICAgICAgIHJlbGF0aW9uVXBkYXRlc1xuICAgICAgICAgICkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbihyZXN1bHQgPT4ge1xuICAgICAgICAgIGlmIChza2lwU2FuaXRpemF0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0aGlzLl9zYW5pdGl6ZURhdGFiYXNlUmVzdWx0KG9yaWdpbmFsVXBkYXRlLCByZXN1bHQpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENvbGxlY3QgYWxsIHJlbGF0aW9uLXVwZGF0aW5nIG9wZXJhdGlvbnMgZnJvbSBhIFJFU1QtZm9ybWF0IHVwZGF0ZS5cbiAgLy8gUmV0dXJucyBhIGxpc3Qgb2YgYWxsIHJlbGF0aW9uIHVwZGF0ZXMgdG8gcGVyZm9ybVxuICAvLyBUaGlzIG11dGF0ZXMgdXBkYXRlLlxuICBjb2xsZWN0UmVsYXRpb25VcGRhdGVzKGNsYXNzTmFtZTogc3RyaW5nLCBvYmplY3RJZDogP3N0cmluZywgdXBkYXRlOiBhbnkpIHtcbiAgICB2YXIgb3BzID0gW107XG4gICAgdmFyIGRlbGV0ZU1lID0gW107XG4gICAgb2JqZWN0SWQgPSB1cGRhdGUub2JqZWN0SWQgfHwgb2JqZWN0SWQ7XG5cbiAgICB2YXIgcHJvY2VzcyA9IChvcCwga2V5KSA9PiB7XG4gICAgICBpZiAoIW9wKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChvcC5fX29wID09ICdBZGRSZWxhdGlvbicpIHtcbiAgICAgICAgb3BzLnB1c2goeyBrZXksIG9wIH0pO1xuICAgICAgICBkZWxldGVNZS5wdXNoKGtleSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcC5fX29wID09ICdSZW1vdmVSZWxhdGlvbicpIHtcbiAgICAgICAgb3BzLnB1c2goeyBrZXksIG9wIH0pO1xuICAgICAgICBkZWxldGVNZS5wdXNoKGtleSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcC5fX29wID09ICdCYXRjaCcpIHtcbiAgICAgICAgZm9yICh2YXIgeCBvZiBvcC5vcHMpIHtcbiAgICAgICAgICBwcm9jZXNzKHgsIGtleSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBrZXkgaW4gdXBkYXRlKSB7XG4gICAgICBwcm9jZXNzKHVwZGF0ZVtrZXldLCBrZXkpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGtleSBvZiBkZWxldGVNZSkge1xuICAgICAgZGVsZXRlIHVwZGF0ZVtrZXldO1xuICAgIH1cbiAgICByZXR1cm4gb3BzO1xuICB9XG5cbiAgLy8gUHJvY2Vzc2VzIHJlbGF0aW9uLXVwZGF0aW5nIG9wZXJhdGlvbnMgZnJvbSBhIFJFU1QtZm9ybWF0IHVwZGF0ZS5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGFsbCB1cGRhdGVzIGhhdmUgYmVlbiBwZXJmb3JtZWRcbiAgaGFuZGxlUmVsYXRpb25VcGRhdGVzKGNsYXNzTmFtZTogc3RyaW5nLCBvYmplY3RJZDogc3RyaW5nLCB1cGRhdGU6IGFueSwgb3BzOiBhbnkpIHtcbiAgICB2YXIgcGVuZGluZyA9IFtdO1xuICAgIG9iamVjdElkID0gdXBkYXRlLm9iamVjdElkIHx8IG9iamVjdElkO1xuICAgIG9wcy5mb3JFYWNoKCh7IGtleSwgb3AgfSkgPT4ge1xuICAgICAgaWYgKCFvcCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAob3AuX19vcCA9PSAnQWRkUmVsYXRpb24nKSB7XG4gICAgICAgIGZvciAoY29uc3Qgb2JqZWN0IG9mIG9wLm9iamVjdHMpIHtcbiAgICAgICAgICBwZW5kaW5nLnB1c2godGhpcy5hZGRSZWxhdGlvbihrZXksIGNsYXNzTmFtZSwgb2JqZWN0SWQsIG9iamVjdC5vYmplY3RJZCkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChvcC5fX29wID09ICdSZW1vdmVSZWxhdGlvbicpIHtcbiAgICAgICAgZm9yIChjb25zdCBvYmplY3Qgb2Ygb3Aub2JqZWN0cykge1xuICAgICAgICAgIHBlbmRpbmcucHVzaCh0aGlzLnJlbW92ZVJlbGF0aW9uKGtleSwgY2xhc3NOYW1lLCBvYmplY3RJZCwgb2JqZWN0Lm9iamVjdElkKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBQcm9taXNlLmFsbChwZW5kaW5nKTtcbiAgfVxuXG4gIC8vIEFkZHMgYSByZWxhdGlvbi5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyBzdWNjZXNzZnVsbHkgaWZmIHRoZSBhZGQgd2FzIHN1Y2Nlc3NmdWwuXG4gIGFkZFJlbGF0aW9uKGtleTogc3RyaW5nLCBmcm9tQ2xhc3NOYW1lOiBzdHJpbmcsIGZyb21JZDogc3RyaW5nLCB0b0lkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBkb2MgPSB7XG4gICAgICByZWxhdGVkSWQ6IHRvSWQsXG4gICAgICBvd25pbmdJZDogZnJvbUlkLFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuYWRhcHRlci51cHNlcnRPbmVPYmplY3QoXG4gICAgICBgX0pvaW46JHtrZXl9OiR7ZnJvbUNsYXNzTmFtZX1gLFxuICAgICAgcmVsYXRpb25TY2hlbWEsXG4gICAgICBkb2MsXG4gICAgICBkb2MsXG4gICAgICB0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvblxuICAgICk7XG4gIH1cblxuICAvLyBSZW1vdmVzIGEgcmVsYXRpb24uXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgc3VjY2Vzc2Z1bGx5IGlmZiB0aGUgcmVtb3ZlIHdhc1xuICAvLyBzdWNjZXNzZnVsLlxuICByZW1vdmVSZWxhdGlvbihrZXk6IHN0cmluZywgZnJvbUNsYXNzTmFtZTogc3RyaW5nLCBmcm9tSWQ6IHN0cmluZywgdG9JZDogc3RyaW5nKSB7XG4gICAgdmFyIGRvYyA9IHtcbiAgICAgIHJlbGF0ZWRJZDogdG9JZCxcbiAgICAgIG93bmluZ0lkOiBmcm9tSWQsXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyXG4gICAgICAuZGVsZXRlT2JqZWN0c0J5UXVlcnkoXG4gICAgICAgIGBfSm9pbjoke2tleX06JHtmcm9tQ2xhc3NOYW1lfWAsXG4gICAgICAgIHJlbGF0aW9uU2NoZW1hLFxuICAgICAgICBkb2MsXG4gICAgICAgIHRoaXMuX3RyYW5zYWN0aW9uYWxTZXNzaW9uXG4gICAgICApXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAvLyBXZSBkb24ndCBjYXJlIGlmIHRoZXkgdHJ5IHRvIGRlbGV0ZSBhIG5vbi1leGlzdGVudCByZWxhdGlvbi5cbiAgICAgICAgaWYgKGVycm9yLmNvZGUgPT0gUGFyc2UuRXJyb3IuT0JKRUNUX05PVF9GT1VORCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0pO1xuICB9XG5cbiAgLy8gUmVtb3ZlcyBvYmplY3RzIG1hdGNoZXMgdGhpcyBxdWVyeSBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyBzdWNjZXNzZnVsbHkgaWZmIHRoZSBvYmplY3Qgd2FzXG4gIC8vIGRlbGV0ZWQuXG4gIC8vIE9wdGlvbnM6XG4gIC8vICAgYWNsOiAgYSBsaXN0IG9mIHN0cmluZ3MuIElmIHRoZSBvYmplY3QgdG8gYmUgdXBkYXRlZCBoYXMgYW4gQUNMLFxuICAvLyAgICAgICAgIG9uZSBvZiB0aGUgcHJvdmlkZWQgc3RyaW5ncyBtdXN0IHByb3ZpZGUgdGhlIGNhbGxlciB3aXRoXG4gIC8vICAgICAgICAgd3JpdGUgcGVybWlzc2lvbnMuXG4gIGRlc3Ryb3koXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgcXVlcnk6IGFueSxcbiAgICB7IGFjbCB9OiBRdWVyeU9wdGlvbnMgPSB7fSxcbiAgICB2YWxpZFNjaGVtYUNvbnRyb2xsZXI6IFNjaGVtYUNvbnRyb2xsZXIuU2NoZW1hQ29udHJvbGxlclxuICApOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IGlzTWFzdGVyID0gYWNsID09PSB1bmRlZmluZWQ7XG4gICAgY29uc3QgYWNsR3JvdXAgPSBhY2wgfHwgW107XG5cbiAgICByZXR1cm4gdGhpcy5sb2FkU2NoZW1hSWZOZWVkZWQodmFsaWRTY2hlbWFDb250cm9sbGVyKS50aGVuKHNjaGVtYUNvbnRyb2xsZXIgPT4ge1xuICAgICAgcmV0dXJuIChpc01hc3RlclxuICAgICAgICA/IFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIDogc2NoZW1hQ29udHJvbGxlci52YWxpZGF0ZVBlcm1pc3Npb24oY2xhc3NOYW1lLCBhY2xHcm91cCwgJ2RlbGV0ZScpXG4gICAgICApLnRoZW4oKCkgPT4ge1xuICAgICAgICBpZiAoIWlzTWFzdGVyKSB7XG4gICAgICAgICAgcXVlcnkgPSB0aGlzLmFkZFBvaW50ZXJQZXJtaXNzaW9ucyhcbiAgICAgICAgICAgIHNjaGVtYUNvbnRyb2xsZXIsXG4gICAgICAgICAgICBjbGFzc05hbWUsXG4gICAgICAgICAgICAnZGVsZXRlJyxcbiAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgYWNsR3JvdXBcbiAgICAgICAgICApO1xuICAgICAgICAgIGlmICghcXVlcnkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnT2JqZWN0IG5vdCBmb3VuZC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGVsZXRlIGJ5IHF1ZXJ5XG4gICAgICAgIGlmIChhY2wpIHtcbiAgICAgICAgICBxdWVyeSA9IGFkZFdyaXRlQUNMKHF1ZXJ5LCBhY2wpO1xuICAgICAgICB9XG4gICAgICAgIHZhbGlkYXRlUXVlcnkocXVlcnksIGlzTWFzdGVyLCBmYWxzZSwgZmFsc2UpO1xuICAgICAgICByZXR1cm4gc2NoZW1hQ29udHJvbGxlclxuICAgICAgICAgIC5nZXRPbmVTY2hlbWEoY2xhc3NOYW1lKVxuICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAvLyBJZiB0aGUgc2NoZW1hIGRvZXNuJ3QgZXhpc3QsIHByZXRlbmQgaXQgZXhpc3RzIHdpdGggbm8gZmllbGRzLiBUaGlzIGJlaGF2aW9yXG4gICAgICAgICAgICAvLyB3aWxsIGxpa2VseSBuZWVkIHJldmlzaXRpbmcuXG4gICAgICAgICAgICBpZiAoZXJyb3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICByZXR1cm4geyBmaWVsZHM6IHt9IH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC50aGVuKHBhcnNlRm9ybWF0U2NoZW1hID0+XG4gICAgICAgICAgICB0aGlzLmFkYXB0ZXIuZGVsZXRlT2JqZWN0c0J5UXVlcnkoXG4gICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgcGFyc2VGb3JtYXRTY2hlbWEsXG4gICAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgICB0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvblxuICAgICAgICAgICAgKVxuICAgICAgICAgIClcbiAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgLy8gV2hlbiBkZWxldGluZyBzZXNzaW9ucyB3aGlsZSBjaGFuZ2luZyBwYXNzd29yZHMsIGRvbid0IHRocm93IGFuIGVycm9yIGlmIHRoZXkgZG9uJ3QgaGF2ZSBhbnkgc2Vzc2lvbnMuXG4gICAgICAgICAgICBpZiAoY2xhc3NOYW1lID09PSAnX1Nlc3Npb24nICYmIGVycm9yLmNvZGUgPT09IFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7fSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gSW5zZXJ0cyBhbiBvYmplY3QgaW50byB0aGUgZGF0YWJhc2UuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgc3VjY2Vzc2Z1bGx5IGlmZiB0aGUgb2JqZWN0IHNhdmVkLlxuICBjcmVhdGUoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0OiBhbnksXG4gICAgeyBhY2wgfTogUXVlcnlPcHRpb25zID0ge30sXG4gICAgdmFsaWRhdGVPbmx5OiBib29sZWFuID0gZmFsc2UsXG4gICAgdmFsaWRTY2hlbWFDb250cm9sbGVyOiBTY2hlbWFDb250cm9sbGVyLlNjaGVtYUNvbnRyb2xsZXJcbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICB0cnkge1xuICAgICAgVXRpbHMuY2hlY2tQcm9oaWJpdGVkS2V5d29yZHModGhpcy5vcHRpb25zLCBvYmplY3QpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfS0VZX05BTUUsIGVycm9yKSk7XG4gICAgfVxuICAgIC8vIE1ha2UgYSBjb3B5IG9mIHRoZSBvYmplY3QsIHNvIHdlIGRvbid0IG11dGF0ZSB0aGUgaW5jb21pbmcgZGF0YS5cbiAgICBjb25zdCBvcmlnaW5hbE9iamVjdCA9IG9iamVjdDtcbiAgICBvYmplY3QgPSB0cmFuc2Zvcm1PYmplY3RBQ0wob2JqZWN0KTtcblxuICAgIGNvbnZlcnRFbWFpbFRvTG93ZXJjYXNlKG9iamVjdCwgY2xhc3NOYW1lLCB0aGlzLm9wdGlvbnMpO1xuICAgIGNvbnZlcnRVc2VybmFtZVRvTG93ZXJjYXNlKG9iamVjdCwgY2xhc3NOYW1lLCB0aGlzLm9wdGlvbnMpO1xuICAgIG9iamVjdC5jcmVhdGVkQXQgPSB7IGlzbzogb2JqZWN0LmNyZWF0ZWRBdCwgX190eXBlOiAnRGF0ZScgfTtcbiAgICBvYmplY3QudXBkYXRlZEF0ID0geyBpc286IG9iamVjdC51cGRhdGVkQXQsIF9fdHlwZTogJ0RhdGUnIH07XG5cbiAgICB2YXIgaXNNYXN0ZXIgPSBhY2wgPT09IHVuZGVmaW5lZDtcbiAgICB2YXIgYWNsR3JvdXAgPSBhY2wgfHwgW107XG4gICAgY29uc3QgcmVsYXRpb25VcGRhdGVzID0gdGhpcy5jb2xsZWN0UmVsYXRpb25VcGRhdGVzKGNsYXNzTmFtZSwgbnVsbCwgb2JqZWN0KTtcblxuICAgIHJldHVybiB0aGlzLnZhbGlkYXRlQ2xhc3NOYW1lKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKCgpID0+IHRoaXMubG9hZFNjaGVtYUlmTmVlZGVkKHZhbGlkU2NoZW1hQ29udHJvbGxlcikpXG4gICAgICAudGhlbihzY2hlbWFDb250cm9sbGVyID0+IHtcbiAgICAgICAgcmV0dXJuIChpc01hc3RlclxuICAgICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgICA6IHNjaGVtYUNvbnRyb2xsZXIudmFsaWRhdGVQZXJtaXNzaW9uKGNsYXNzTmFtZSwgYWNsR3JvdXAsICdjcmVhdGUnKVxuICAgICAgICApXG4gICAgICAgICAgLnRoZW4oKCkgPT4gc2NoZW1hQ29udHJvbGxlci5lbmZvcmNlQ2xhc3NFeGlzdHMoY2xhc3NOYW1lKSlcbiAgICAgICAgICAudGhlbigoKSA9PiBzY2hlbWFDb250cm9sbGVyLmdldE9uZVNjaGVtYShjbGFzc05hbWUsIHRydWUpKVxuICAgICAgICAgIC50aGVuKHNjaGVtYSA9PiB7XG4gICAgICAgICAgICB0cmFuc2Zvcm1BdXRoRGF0YShjbGFzc05hbWUsIG9iamVjdCwgc2NoZW1hKTtcbiAgICAgICAgICAgIGZsYXR0ZW5VcGRhdGVPcGVyYXRvcnNGb3JDcmVhdGUob2JqZWN0KTtcbiAgICAgICAgICAgIGlmICh2YWxpZGF0ZU9ubHkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci5jcmVhdGVPYmplY3QoXG4gICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgU2NoZW1hQ29udHJvbGxlci5jb252ZXJ0U2NoZW1hVG9BZGFwdGVyU2NoZW1hKHNjaGVtYSksXG4gICAgICAgICAgICAgIG9iamVjdCxcbiAgICAgICAgICAgICAgdGhpcy5fdHJhbnNhY3Rpb25hbFNlc3Npb25cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbihyZXN1bHQgPT4ge1xuICAgICAgICAgICAgaWYgKHZhbGlkYXRlT25seSkge1xuICAgICAgICAgICAgICByZXR1cm4gb3JpZ2luYWxPYmplY3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kbGVSZWxhdGlvblVwZGF0ZXMoXG4gICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgb2JqZWN0Lm9iamVjdElkLFxuICAgICAgICAgICAgICBvYmplY3QsXG4gICAgICAgICAgICAgIHJlbGF0aW9uVXBkYXRlc1xuICAgICAgICAgICAgKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3Nhbml0aXplRGF0YWJhc2VSZXN1bHQob3JpZ2luYWxPYmplY3QsIHJlc3VsdC5vcHNbMF0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIGNhbkFkZEZpZWxkKFxuICAgIHNjaGVtYTogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyLFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIG9iamVjdDogYW55LFxuICAgIGFjbEdyb3VwOiBzdHJpbmdbXSxcbiAgICBydW5PcHRpb25zOiBRdWVyeU9wdGlvbnNcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY2xhc3NTY2hlbWEgPSBzY2hlbWEuc2NoZW1hRGF0YVtjbGFzc05hbWVdO1xuICAgIGlmICghY2xhc3NTY2hlbWEpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG4gICAgY29uc3QgZmllbGRzID0gT2JqZWN0LmtleXMob2JqZWN0KTtcbiAgICBjb25zdCBzY2hlbWFGaWVsZHMgPSBPYmplY3Qua2V5cyhjbGFzc1NjaGVtYS5maWVsZHMpO1xuICAgIGNvbnN0IG5ld0tleXMgPSBmaWVsZHMuZmlsdGVyKGZpZWxkID0+IHtcbiAgICAgIC8vIFNraXAgZmllbGRzIHRoYXQgYXJlIHVuc2V0XG4gICAgICBpZiAob2JqZWN0W2ZpZWxkXSAmJiBvYmplY3RbZmllbGRdLl9fb3AgJiYgb2JqZWN0W2ZpZWxkXS5fX29wID09PSAnRGVsZXRlJykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2NoZW1hRmllbGRzLmluZGV4T2YoZ2V0Um9vdEZpZWxkTmFtZShmaWVsZCkpIDwgMDtcbiAgICB9KTtcbiAgICBpZiAobmV3S2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBhZGRzIGEgbWFya2VyIHRoYXQgbmV3IGZpZWxkIGlzIGJlaW5nIGFkZGluZyBkdXJpbmcgdXBkYXRlXG4gICAgICBydW5PcHRpb25zLmFkZHNGaWVsZCA9IHRydWU7XG5cbiAgICAgIGNvbnN0IGFjdGlvbiA9IHJ1bk9wdGlvbnMuYWN0aW9uO1xuICAgICAgcmV0dXJuIHNjaGVtYS52YWxpZGF0ZVBlcm1pc3Npb24oY2xhc3NOYW1lLCBhY2xHcm91cCwgJ2FkZEZpZWxkJywgYWN0aW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG5cbiAgLy8gV29uJ3QgZGVsZXRlIGNvbGxlY3Rpb25zIGluIHRoZSBzeXN0ZW0gbmFtZXNwYWNlXG4gIC8qKlxuICAgKiBEZWxldGUgYWxsIGNsYXNzZXMgYW5kIGNsZWFycyB0aGUgc2NoZW1hIGNhY2hlXG4gICAqXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gZmFzdCBzZXQgdG8gdHJ1ZSBpZiBpdCdzIG9rIHRvIGp1c3QgZGVsZXRlIHJvd3MgYW5kIG5vdCBpbmRleGVzXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fSB3aGVuIHRoZSBkZWxldGlvbnMgY29tcGxldGVzXG4gICAqL1xuICBkZWxldGVFdmVyeXRoaW5nKGZhc3Q6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8YW55PiB7XG4gICAgdGhpcy5zY2hlbWFQcm9taXNlID0gbnVsbDtcbiAgICBTY2hlbWFDYWNoZS5jbGVhcigpO1xuICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZGVsZXRlQWxsQ2xhc3NlcyhmYXN0KTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIGZvciBhIGxpc3Qgb2YgcmVsYXRlZCBpZHMgZ2l2ZW4gYW4gb3duaW5nIGlkLlxuICAvLyBjbGFzc05hbWUgaGVyZSBpcyB0aGUgb3duaW5nIGNsYXNzTmFtZS5cbiAgcmVsYXRlZElkcyhcbiAgICBjbGFzc05hbWU6IHN0cmluZyxcbiAgICBrZXk6IHN0cmluZyxcbiAgICBvd25pbmdJZDogc3RyaW5nLFxuICAgIHF1ZXJ5T3B0aW9uczogUXVlcnlPcHRpb25zXG4gICk6IFByb21pc2U8QXJyYXk8c3RyaW5nPj4ge1xuICAgIGNvbnN0IHsgc2tpcCwgbGltaXQsIHNvcnQgfSA9IHF1ZXJ5T3B0aW9ucztcbiAgICBjb25zdCBmaW5kT3B0aW9ucyA9IHt9O1xuICAgIGlmIChzb3J0ICYmIHNvcnQuY3JlYXRlZEF0ICYmIHRoaXMuYWRhcHRlci5jYW5Tb3J0T25Kb2luVGFibGVzKSB7XG4gICAgICBmaW5kT3B0aW9ucy5zb3J0ID0geyBfaWQ6IHNvcnQuY3JlYXRlZEF0IH07XG4gICAgICBmaW5kT3B0aW9ucy5saW1pdCA9IGxpbWl0O1xuICAgICAgZmluZE9wdGlvbnMuc2tpcCA9IHNraXA7XG4gICAgICBxdWVyeU9wdGlvbnMuc2tpcCA9IDA7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkYXB0ZXJcbiAgICAgIC5maW5kKGpvaW5UYWJsZU5hbWUoY2xhc3NOYW1lLCBrZXkpLCByZWxhdGlvblNjaGVtYSwgeyBvd25pbmdJZCB9LCBmaW5kT3B0aW9ucylcbiAgICAgIC50aGVuKHJlc3VsdHMgPT4gcmVzdWx0cy5tYXAocmVzdWx0ID0+IHJlc3VsdC5yZWxhdGVkSWQpKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIGZvciBhIGxpc3Qgb2Ygb3duaW5nIGlkcyBnaXZlbiBzb21lIHJlbGF0ZWQgaWRzLlxuICAvLyBjbGFzc05hbWUgaGVyZSBpcyB0aGUgb3duaW5nIGNsYXNzTmFtZS5cbiAgb3duaW5nSWRzKGNsYXNzTmFtZTogc3RyaW5nLCBrZXk6IHN0cmluZywgcmVsYXRlZElkczogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgcmV0dXJuIHRoaXMuYWRhcHRlclxuICAgICAgLmZpbmQoXG4gICAgICAgIGpvaW5UYWJsZU5hbWUoY2xhc3NOYW1lLCBrZXkpLFxuICAgICAgICByZWxhdGlvblNjaGVtYSxcbiAgICAgICAgeyByZWxhdGVkSWQ6IHsgJGluOiByZWxhdGVkSWRzIH0gfSxcbiAgICAgICAgeyBrZXlzOiBbJ293bmluZ0lkJ10gfVxuICAgICAgKVxuICAgICAgLnRoZW4ocmVzdWx0cyA9PiByZXN1bHRzLm1hcChyZXN1bHQgPT4gcmVzdWx0Lm93bmluZ0lkKSk7XG4gIH1cblxuICAvLyBNb2RpZmllcyBxdWVyeSBzbyB0aGF0IGl0IG5vIGxvbmdlciBoYXMgJGluIG9uIHJlbGF0aW9uIGZpZWxkcywgb3JcbiAgLy8gZXF1YWwtdG8tcG9pbnRlciBjb25zdHJhaW50cyBvbiByZWxhdGlvbiBmaWVsZHMuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBxdWVyeSBpcyBtdXRhdGVkXG4gIHJlZHVjZUluUmVsYXRpb24oY2xhc3NOYW1lOiBzdHJpbmcsIHF1ZXJ5OiBhbnksIHNjaGVtYTogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAvLyBTZWFyY2ggZm9yIGFuIGluLXJlbGF0aW9uIG9yIGVxdWFsLXRvLXJlbGF0aW9uXG4gICAgLy8gTWFrZSBpdCBzZXF1ZW50aWFsIGZvciBub3csIG5vdCBzdXJlIG9mIHBhcmFsbGVpemF0aW9uIHNpZGUgZWZmZWN0c1xuICAgIGNvbnN0IHByb21pc2VzID0gW107XG4gICAgaWYgKHF1ZXJ5Wyckb3InXSkge1xuICAgICAgY29uc3Qgb3JzID0gcXVlcnlbJyRvciddO1xuICAgICAgcHJvbWlzZXMucHVzaChcbiAgICAgICAgLi4ub3JzLm1hcCgoYVF1ZXJ5LCBpbmRleCkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlZHVjZUluUmVsYXRpb24oY2xhc3NOYW1lLCBhUXVlcnksIHNjaGVtYSkudGhlbihhUXVlcnkgPT4ge1xuICAgICAgICAgICAgcXVlcnlbJyRvciddW2luZGV4XSA9IGFRdWVyeTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChxdWVyeVsnJGFuZCddKSB7XG4gICAgICBjb25zdCBhbmRzID0gcXVlcnlbJyRhbmQnXTtcbiAgICAgIHByb21pc2VzLnB1c2goXG4gICAgICAgIC4uLmFuZHMubWFwKChhUXVlcnksIGluZGV4KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVkdWNlSW5SZWxhdGlvbihjbGFzc05hbWUsIGFRdWVyeSwgc2NoZW1hKS50aGVuKGFRdWVyeSA9PiB7XG4gICAgICAgICAgICBxdWVyeVsnJGFuZCddW2luZGV4XSA9IGFRdWVyeTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3RoZXJLZXlzID0gT2JqZWN0LmtleXMocXVlcnkpLm1hcChrZXkgPT4ge1xuICAgICAgaWYgKGtleSA9PT0gJyRhbmQnIHx8IGtleSA9PT0gJyRvcicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgdCA9IHNjaGVtYS5nZXRFeHBlY3RlZFR5cGUoY2xhc3NOYW1lLCBrZXkpO1xuICAgICAgaWYgKCF0IHx8IHQudHlwZSAhPT0gJ1JlbGF0aW9uJykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHF1ZXJ5KTtcbiAgICAgIH1cbiAgICAgIGxldCBxdWVyaWVzOiA/KGFueVtdKSA9IG51bGw7XG4gICAgICBpZiAoXG4gICAgICAgIHF1ZXJ5W2tleV0gJiZcbiAgICAgICAgKHF1ZXJ5W2tleV1bJyRpbiddIHx8XG4gICAgICAgICAgcXVlcnlba2V5XVsnJG5lJ10gfHxcbiAgICAgICAgICBxdWVyeVtrZXldWyckbmluJ10gfHxcbiAgICAgICAgICBxdWVyeVtrZXldLl9fdHlwZSA9PSAnUG9pbnRlcicpXG4gICAgICApIHtcbiAgICAgICAgLy8gQnVpbGQgdGhlIGxpc3Qgb2YgcXVlcmllc1xuICAgICAgICBxdWVyaWVzID0gT2JqZWN0LmtleXMocXVlcnlba2V5XSkubWFwKGNvbnN0cmFpbnRLZXkgPT4ge1xuICAgICAgICAgIGxldCByZWxhdGVkSWRzO1xuICAgICAgICAgIGxldCBpc05lZ2F0aW9uID0gZmFsc2U7XG4gICAgICAgICAgaWYgKGNvbnN0cmFpbnRLZXkgPT09ICdvYmplY3RJZCcpIHtcbiAgICAgICAgICAgIHJlbGF0ZWRJZHMgPSBbcXVlcnlba2V5XS5vYmplY3RJZF07XG4gICAgICAgICAgfSBlbHNlIGlmIChjb25zdHJhaW50S2V5ID09ICckaW4nKSB7XG4gICAgICAgICAgICByZWxhdGVkSWRzID0gcXVlcnlba2V5XVsnJGluJ10ubWFwKHIgPT4gci5vYmplY3RJZCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChjb25zdHJhaW50S2V5ID09ICckbmluJykge1xuICAgICAgICAgICAgaXNOZWdhdGlvbiA9IHRydWU7XG4gICAgICAgICAgICByZWxhdGVkSWRzID0gcXVlcnlba2V5XVsnJG5pbiddLm1hcChyID0+IHIub2JqZWN0SWQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY29uc3RyYWludEtleSA9PSAnJG5lJykge1xuICAgICAgICAgICAgaXNOZWdhdGlvbiA9IHRydWU7XG4gICAgICAgICAgICByZWxhdGVkSWRzID0gW3F1ZXJ5W2tleV1bJyRuZSddLm9iamVjdElkXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNOZWdhdGlvbixcbiAgICAgICAgICAgIHJlbGF0ZWRJZHMsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBxdWVyaWVzID0gW3sgaXNOZWdhdGlvbjogZmFsc2UsIHJlbGF0ZWRJZHM6IFtdIH1dO1xuICAgICAgfVxuXG4gICAgICAvLyByZW1vdmUgdGhlIGN1cnJlbnQgcXVlcnlLZXkgYXMgd2UgZG9uLHQgbmVlZCBpdCBhbnltb3JlXG4gICAgICBkZWxldGUgcXVlcnlba2V5XTtcbiAgICAgIC8vIGV4ZWN1dGUgZWFjaCBxdWVyeSBpbmRlcGVuZGVudGx5IHRvIGJ1aWxkIHRoZSBsaXN0IG9mXG4gICAgICAvLyAkaW4gLyAkbmluXG4gICAgICBjb25zdCBwcm9taXNlcyA9IHF1ZXJpZXMubWFwKHEgPT4ge1xuICAgICAgICBpZiAoIXEpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMub3duaW5nSWRzKGNsYXNzTmFtZSwga2V5LCBxLnJlbGF0ZWRJZHMpLnRoZW4oaWRzID0+IHtcbiAgICAgICAgICBpZiAocS5pc05lZ2F0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmFkZE5vdEluT2JqZWN0SWRzSWRzKGlkcywgcXVlcnkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmFkZEluT2JqZWN0SWRzSWRzKGlkcywgcXVlcnkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFsuLi5wcm9taXNlcywgLi4ub3RoZXJLZXlzXSkudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHF1ZXJ5KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIE1vZGlmaWVzIHF1ZXJ5IHNvIHRoYXQgaXQgbm8gbG9uZ2VyIGhhcyAkcmVsYXRlZFRvXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBxdWVyeSBpcyBtdXRhdGVkXG4gIHJlZHVjZVJlbGF0aW9uS2V5cyhjbGFzc05hbWU6IHN0cmluZywgcXVlcnk6IGFueSwgcXVlcnlPcHRpb25zOiBhbnkpOiA/UHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHF1ZXJ5Wyckb3InXSkge1xuICAgICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgICBxdWVyeVsnJG9yJ10ubWFwKGFRdWVyeSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVkdWNlUmVsYXRpb25LZXlzKGNsYXNzTmFtZSwgYVF1ZXJ5LCBxdWVyeU9wdGlvbnMpO1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG4gICAgaWYgKHF1ZXJ5WyckYW5kJ10pIHtcbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChcbiAgICAgICAgcXVlcnlbJyRhbmQnXS5tYXAoYVF1ZXJ5ID0+IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZWR1Y2VSZWxhdGlvbktleXMoY2xhc3NOYW1lLCBhUXVlcnksIHF1ZXJ5T3B0aW9ucyk7XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cbiAgICB2YXIgcmVsYXRlZFRvID0gcXVlcnlbJyRyZWxhdGVkVG8nXTtcbiAgICBpZiAocmVsYXRlZFRvKSB7XG4gICAgICByZXR1cm4gdGhpcy5yZWxhdGVkSWRzKFxuICAgICAgICByZWxhdGVkVG8ub2JqZWN0LmNsYXNzTmFtZSxcbiAgICAgICAgcmVsYXRlZFRvLmtleSxcbiAgICAgICAgcmVsYXRlZFRvLm9iamVjdC5vYmplY3RJZCxcbiAgICAgICAgcXVlcnlPcHRpb25zXG4gICAgICApXG4gICAgICAgIC50aGVuKGlkcyA9PiB7XG4gICAgICAgICAgZGVsZXRlIHF1ZXJ5WyckcmVsYXRlZFRvJ107XG4gICAgICAgICAgdGhpcy5hZGRJbk9iamVjdElkc0lkcyhpZHMsIHF1ZXJ5KTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZWR1Y2VSZWxhdGlvbktleXMoY2xhc3NOYW1lLCBxdWVyeSwgcXVlcnlPcHRpb25zKTtcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oKCkgPT4ge30pO1xuICAgIH1cbiAgfVxuXG4gIGFkZEluT2JqZWN0SWRzSWRzKGlkczogP0FycmF5PHN0cmluZz4gPSBudWxsLCBxdWVyeTogYW55KSB7XG4gICAgY29uc3QgaWRzRnJvbVN0cmluZzogP0FycmF5PHN0cmluZz4gPVxuICAgICAgdHlwZW9mIHF1ZXJ5Lm9iamVjdElkID09PSAnc3RyaW5nJyA/IFtxdWVyeS5vYmplY3RJZF0gOiBudWxsO1xuICAgIGNvbnN0IGlkc0Zyb21FcTogP0FycmF5PHN0cmluZz4gPVxuICAgICAgcXVlcnkub2JqZWN0SWQgJiYgcXVlcnkub2JqZWN0SWRbJyRlcSddID8gW3F1ZXJ5Lm9iamVjdElkWyckZXEnXV0gOiBudWxsO1xuICAgIGNvbnN0IGlkc0Zyb21JbjogP0FycmF5PHN0cmluZz4gPVxuICAgICAgcXVlcnkub2JqZWN0SWQgJiYgcXVlcnkub2JqZWN0SWRbJyRpbiddID8gcXVlcnkub2JqZWN0SWRbJyRpbiddIDogbnVsbDtcblxuICAgIC8vIEBmbG93LWRpc2FibGUtbmV4dFxuICAgIGNvbnN0IGFsbElkczogQXJyYXk8QXJyYXk8c3RyaW5nPj4gPSBbaWRzRnJvbVN0cmluZywgaWRzRnJvbUVxLCBpZHNGcm9tSW4sIGlkc10uZmlsdGVyKFxuICAgICAgbGlzdCA9PiBsaXN0ICE9PSBudWxsXG4gICAgKTtcbiAgICBjb25zdCB0b3RhbExlbmd0aCA9IGFsbElkcy5yZWR1Y2UoKG1lbW8sIGxpc3QpID0+IG1lbW8gKyBsaXN0Lmxlbmd0aCwgMCk7XG5cbiAgICBsZXQgaWRzSW50ZXJzZWN0aW9uID0gW107XG4gICAgaWYgKHRvdGFsTGVuZ3RoID4gMTI1KSB7XG4gICAgICBpZHNJbnRlcnNlY3Rpb24gPSBpbnRlcnNlY3QuYmlnKGFsbElkcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlkc0ludGVyc2VjdGlvbiA9IGludGVyc2VjdChhbGxJZHMpO1xuICAgIH1cblxuICAgIC8vIE5lZWQgdG8gbWFrZSBzdXJlIHdlIGRvbid0IGNsb2JiZXIgZXhpc3Rpbmcgc2hvcnRoYW5kICRlcSBjb25zdHJhaW50cyBvbiBvYmplY3RJZC5cbiAgICBpZiAoISgnb2JqZWN0SWQnIGluIHF1ZXJ5KSkge1xuICAgICAgcXVlcnkub2JqZWN0SWQgPSB7XG4gICAgICAgICRpbjogdW5kZWZpbmVkLFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBxdWVyeS5vYmplY3RJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHF1ZXJ5Lm9iamVjdElkID0ge1xuICAgICAgICAkaW46IHVuZGVmaW5lZCxcbiAgICAgICAgJGVxOiBxdWVyeS5vYmplY3RJZCxcbiAgICAgIH07XG4gICAgfVxuICAgIHF1ZXJ5Lm9iamVjdElkWyckaW4nXSA9IGlkc0ludGVyc2VjdGlvbjtcblxuICAgIHJldHVybiBxdWVyeTtcbiAgfVxuXG4gIGFkZE5vdEluT2JqZWN0SWRzSWRzKGlkczogc3RyaW5nW10gPSBbXSwgcXVlcnk6IGFueSkge1xuICAgIGNvbnN0IGlkc0Zyb21OaW4gPSBxdWVyeS5vYmplY3RJZCAmJiBxdWVyeS5vYmplY3RJZFsnJG5pbiddID8gcXVlcnkub2JqZWN0SWRbJyRuaW4nXSA6IFtdO1xuICAgIGxldCBhbGxJZHMgPSBbLi4uaWRzRnJvbU5pbiwgLi4uaWRzXS5maWx0ZXIobGlzdCA9PiBsaXN0ICE9PSBudWxsKTtcblxuICAgIC8vIG1ha2UgYSBzZXQgYW5kIHNwcmVhZCB0byByZW1vdmUgZHVwbGljYXRlc1xuICAgIGFsbElkcyA9IFsuLi5uZXcgU2V0KGFsbElkcyldO1xuXG4gICAgLy8gTmVlZCB0byBtYWtlIHN1cmUgd2UgZG9uJ3QgY2xvYmJlciBleGlzdGluZyBzaG9ydGhhbmQgJGVxIGNvbnN0cmFpbnRzIG9uIG9iamVjdElkLlxuICAgIGlmICghKCdvYmplY3RJZCcgaW4gcXVlcnkpKSB7XG4gICAgICBxdWVyeS5vYmplY3RJZCA9IHtcbiAgICAgICAgJG5pbjogdW5kZWZpbmVkLFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBxdWVyeS5vYmplY3RJZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHF1ZXJ5Lm9iamVjdElkID0ge1xuICAgICAgICAkbmluOiB1bmRlZmluZWQsXG4gICAgICAgICRlcTogcXVlcnkub2JqZWN0SWQsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHF1ZXJ5Lm9iamVjdElkWyckbmluJ10gPSBhbGxJZHM7XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG5cbiAgLy8gUnVucyBhIHF1ZXJ5IG9uIHRoZSBkYXRhYmFzZS5cbiAgLy8gUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIGxpc3Qgb2YgaXRlbXMuXG4gIC8vIE9wdGlvbnM6XG4gIC8vICAgc2tpcCAgICBudW1iZXIgb2YgcmVzdWx0cyB0byBza2lwLlxuICAvLyAgIGxpbWl0ICAgbGltaXQgdG8gdGhpcyBudW1iZXIgb2YgcmVzdWx0cy5cbiAgLy8gICBzb3J0ICAgIGFuIG9iamVjdCB3aGVyZSBrZXlzIGFyZSB0aGUgZmllbGRzIHRvIHNvcnQgYnkuXG4gIC8vICAgICAgICAgICB0aGUgdmFsdWUgaXMgKzEgZm9yIGFzY2VuZGluZywgLTEgZm9yIGRlc2NlbmRpbmcuXG4gIC8vICAgY291bnQgICBydW4gYSBjb3VudCBpbnN0ZWFkIG9mIHJldHVybmluZyByZXN1bHRzLlxuICAvLyAgIGFjbCAgICAgcmVzdHJpY3QgdGhpcyBvcGVyYXRpb24gd2l0aCBhbiBBQ0wgZm9yIHRoZSBwcm92aWRlZCBhcnJheVxuICAvLyAgICAgICAgICAgb2YgdXNlciBvYmplY3RJZHMgYW5kIHJvbGVzLiBhY2w6IG51bGwgbWVhbnMgbm8gdXNlci5cbiAgLy8gICAgICAgICAgIHdoZW4gdGhpcyBmaWVsZCBpcyBub3QgcHJlc2VudCwgZG9uJ3QgZG8gYW55dGhpbmcgcmVnYXJkaW5nIEFDTHMuXG4gIC8vICBjYXNlSW5zZW5zaXRpdmUgbWFrZSBzdHJpbmcgY29tcGFyaXNvbnMgY2FzZSBpbnNlbnNpdGl2ZVxuICAvLyBUT0RPOiBtYWtlIHVzZXJJZHMgbm90IG5lZWRlZCBoZXJlLiBUaGUgZGIgYWRhcHRlciBzaG91bGRuJ3Qga25vd1xuICAvLyBhbnl0aGluZyBhYm91dCB1c2VycywgaWRlYWxseS4gVGhlbiwgaW1wcm92ZSB0aGUgZm9ybWF0IG9mIHRoZSBBQ0xcbiAgLy8gYXJnIHRvIHdvcmsgbGlrZSB0aGUgb3RoZXJzLlxuICBmaW5kKFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHF1ZXJ5OiBhbnksXG4gICAge1xuICAgICAgc2tpcCxcbiAgICAgIGxpbWl0LFxuICAgICAgYWNsLFxuICAgICAgc29ydCA9IHt9LFxuICAgICAgY291bnQsXG4gICAgICBrZXlzLFxuICAgICAgb3AsXG4gICAgICBkaXN0aW5jdCxcbiAgICAgIHBpcGVsaW5lLFxuICAgICAgcmVhZFByZWZlcmVuY2UsXG4gICAgICBoaW50LFxuICAgICAgY2FzZUluc2Vuc2l0aXZlID0gZmFsc2UsXG4gICAgICBleHBsYWluLFxuICAgIH06IGFueSA9IHt9LFxuICAgIGF1dGg6IGFueSA9IHt9LFxuICAgIHZhbGlkU2NoZW1hQ29udHJvbGxlcjogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyXG4gICk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgaXNNYWludGVuYW5jZSA9IGF1dGguaXNNYWludGVuYW5jZTtcbiAgICBjb25zdCBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkIHx8IGlzTWFpbnRlbmFuY2U7XG4gICAgY29uc3QgYWNsR3JvdXAgPSBhY2wgfHwgW107XG4gICAgb3AgPVxuICAgICAgb3AgfHwgKHR5cGVvZiBxdWVyeS5vYmplY3RJZCA9PSAnc3RyaW5nJyAmJiBPYmplY3Qua2V5cyhxdWVyeSkubGVuZ3RoID09PSAxID8gJ2dldCcgOiAnZmluZCcpO1xuICAgIC8vIENvdW50IG9wZXJhdGlvbiBpZiBjb3VudGluZ1xuICAgIG9wID0gY291bnQgPT09IHRydWUgPyAnY291bnQnIDogb3A7XG5cbiAgICBsZXQgY2xhc3NFeGlzdHMgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzLmxvYWRTY2hlbWFJZk5lZWRlZCh2YWxpZFNjaGVtYUNvbnRyb2xsZXIpLnRoZW4oc2NoZW1hQ29udHJvbGxlciA9PiB7XG4gICAgICAvL0FsbG93IHZvbGF0aWxlIGNsYXNzZXMgaWYgcXVlcnlpbmcgd2l0aCBNYXN0ZXIgKGZvciBfUHVzaFN0YXR1cylcbiAgICAgIC8vVE9ETzogTW92ZSB2b2xhdGlsZSBjbGFzc2VzIGNvbmNlcHQgaW50byBtb25nbyBhZGFwdGVyLCBwb3N0Z3JlcyBhZGFwdGVyIHNob3VsZG4ndCBjYXJlXG4gICAgICAvL3RoYXQgYXBpLnBhcnNlLmNvbSBicmVha3Mgd2hlbiBfUHVzaFN0YXR1cyBleGlzdHMgaW4gbW9uZ28uXG4gICAgICByZXR1cm4gc2NoZW1hQ29udHJvbGxlclxuICAgICAgICAuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSwgaXNNYXN0ZXIpXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgLy8gQmVoYXZpb3IgZm9yIG5vbi1leGlzdGVudCBjbGFzc2VzIGlzIGtpbmRhIHdlaXJkIG9uIFBhcnNlLmNvbS4gUHJvYmFibHkgZG9lc24ndCBtYXR0ZXIgdG9vIG11Y2guXG4gICAgICAgICAgLy8gRm9yIG5vdywgcHJldGVuZCB0aGUgY2xhc3MgZXhpc3RzIGJ1dCBoYXMgbm8gb2JqZWN0cyxcbiAgICAgICAgICBpZiAoZXJyb3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY2xhc3NFeGlzdHMgPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiB7IGZpZWxkczoge30gfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKHNjaGVtYSA9PiB7XG4gICAgICAgICAgLy8gUGFyc2UuY29tIHRyZWF0cyBxdWVyaWVzIG9uIF9jcmVhdGVkX2F0IGFuZCBfdXBkYXRlZF9hdCBhcyBpZiB0aGV5IHdlcmUgcXVlcmllcyBvbiBjcmVhdGVkQXQgYW5kIHVwZGF0ZWRBdCxcbiAgICAgICAgICAvLyBzbyBkdXBsaWNhdGUgdGhhdCBiZWhhdmlvciBoZXJlLiBJZiBib3RoIGFyZSBzcGVjaWZpZWQsIHRoZSBjb3JyZWN0IGJlaGF2aW9yIHRvIG1hdGNoIFBhcnNlLmNvbSBpcyB0b1xuICAgICAgICAgIC8vIHVzZSB0aGUgb25lIHRoYXQgYXBwZWFycyBmaXJzdCBpbiB0aGUgc29ydCBsaXN0LlxuICAgICAgICAgIGlmIChzb3J0Ll9jcmVhdGVkX2F0KSB7XG4gICAgICAgICAgICBzb3J0LmNyZWF0ZWRBdCA9IHNvcnQuX2NyZWF0ZWRfYXQ7XG4gICAgICAgICAgICBkZWxldGUgc29ydC5fY3JlYXRlZF9hdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNvcnQuX3VwZGF0ZWRfYXQpIHtcbiAgICAgICAgICAgIHNvcnQudXBkYXRlZEF0ID0gc29ydC5fdXBkYXRlZF9hdDtcbiAgICAgICAgICAgIGRlbGV0ZSBzb3J0Ll91cGRhdGVkX2F0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBxdWVyeU9wdGlvbnMgPSB7XG4gICAgICAgICAgICBza2lwLFxuICAgICAgICAgICAgbGltaXQsXG4gICAgICAgICAgICBzb3J0LFxuICAgICAgICAgICAga2V5cyxcbiAgICAgICAgICAgIHJlYWRQcmVmZXJlbmNlLFxuICAgICAgICAgICAgaGludCxcbiAgICAgICAgICAgIGNhc2VJbnNlbnNpdGl2ZTogdGhpcy5vcHRpb25zLmVuYWJsZUNvbGxhdGlvbkNhc2VDb21wYXJpc29uID8gZmFsc2UgOiBjYXNlSW5zZW5zaXRpdmUsXG4gICAgICAgICAgICBleHBsYWluLFxuICAgICAgICAgIH07XG4gICAgICAgICAgT2JqZWN0LmtleXMoc29ydCkuZm9yRWFjaChmaWVsZE5hbWUgPT4ge1xuICAgICAgICAgICAgaWYgKGZpZWxkTmFtZS5tYXRjaCgvXmF1dGhEYXRhXFwuKFthLXpBLVowLTlfXSspXFwuaWQkLykpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfS0VZX05BTUUsIGBDYW5ub3Qgc29ydCBieSAke2ZpZWxkTmFtZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJvb3RGaWVsZE5hbWUgPSBnZXRSb290RmllbGROYW1lKGZpZWxkTmFtZSk7XG4gICAgICAgICAgICBpZiAoIVNjaGVtYUNvbnRyb2xsZXIuZmllbGROYW1lSXNWYWxpZChyb290RmllbGROYW1lLCBjbGFzc05hbWUpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLFxuICAgICAgICAgICAgICAgIGBJbnZhbGlkIGZpZWxkIG5hbWU6ICR7ZmllbGROYW1lfS5gXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXNjaGVtYS5maWVsZHNbZmllbGROYW1lLnNwbGl0KCcuJylbMF1dICYmIGZpZWxkTmFtZSAhPT0gJ3Njb3JlJykge1xuICAgICAgICAgICAgICBkZWxldGUgc29ydFtmaWVsZE5hbWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybiAoaXNNYXN0ZXJcbiAgICAgICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgICAgIDogc2NoZW1hQ29udHJvbGxlci52YWxpZGF0ZVBlcm1pc3Npb24oY2xhc3NOYW1lLCBhY2xHcm91cCwgb3ApXG4gICAgICAgICAgKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5yZWR1Y2VSZWxhdGlvbktleXMoY2xhc3NOYW1lLCBxdWVyeSwgcXVlcnlPcHRpb25zKSlcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHRoaXMucmVkdWNlSW5SZWxhdGlvbihjbGFzc05hbWUsIHF1ZXJ5LCBzY2hlbWFDb250cm9sbGVyKSlcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgbGV0IHByb3RlY3RlZEZpZWxkcztcbiAgICAgICAgICAgICAgaWYgKCFpc01hc3Rlcikge1xuICAgICAgICAgICAgICAgIHF1ZXJ5ID0gdGhpcy5hZGRQb2ludGVyUGVybWlzc2lvbnMoXG4gICAgICAgICAgICAgICAgICBzY2hlbWFDb250cm9sbGVyLFxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgICAgICAgIGFjbEdyb3VwXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAvKiBEb24ndCB1c2UgcHJvamVjdGlvbnMgdG8gb3B0aW1pemUgdGhlIHByb3RlY3RlZEZpZWxkcyBzaW5jZSB0aGUgcHJvdGVjdGVkRmllbGRzXG4gICAgICAgICAgICAgICAgICBiYXNlZCBvbiBwb2ludGVyLXBlcm1pc3Npb25zIGFyZSBkZXRlcm1pbmVkIGFmdGVyIHF1ZXJ5aW5nLiBUaGUgZmlsdGVyaW5nIGNhblxuICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlIHRoZSBwcm90ZWN0ZWQgZmllbGRzLiAqL1xuICAgICAgICAgICAgICAgIHByb3RlY3RlZEZpZWxkcyA9IHRoaXMuYWRkUHJvdGVjdGVkRmllbGRzKFxuICAgICAgICAgICAgICAgICAgc2NoZW1hQ29udHJvbGxlcixcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgICAgICAgYWNsR3JvdXAsXG4gICAgICAgICAgICAgICAgICBhdXRoLFxuICAgICAgICAgICAgICAgICAgcXVlcnlPcHRpb25zXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wID09PSAnZ2V0Jykge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsICdPYmplY3Qgbm90IGZvdW5kLicpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICghaXNNYXN0ZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAob3AgPT09ICd1cGRhdGUnIHx8IG9wID09PSAnZGVsZXRlJykge1xuICAgICAgICAgICAgICAgICAgcXVlcnkgPSBhZGRXcml0ZUFDTChxdWVyeSwgYWNsR3JvdXApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBxdWVyeSA9IGFkZFJlYWRBQ0wocXVlcnksIGFjbEdyb3VwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFsaWRhdGVRdWVyeShxdWVyeSwgaXNNYXN0ZXIsIGlzTWFpbnRlbmFuY2UsIGZhbHNlKTtcbiAgICAgICAgICAgICAgaWYgKGNvdW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjbGFzc0V4aXN0cykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuY291bnQoXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgICAgICAgICAgcmVhZFByZWZlcmVuY2UsXG4gICAgICAgICAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgaGludFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGlzdGluY3QpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNsYXNzRXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZGlzdGluY3QoY2xhc3NOYW1lLCBzY2hlbWEsIHF1ZXJ5LCBkaXN0aW5jdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHBpcGVsaW5lKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjbGFzc0V4aXN0cykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmFnZ3JlZ2F0ZShcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgICAgICAgICAgIHBpcGVsaW5lLFxuICAgICAgICAgICAgICAgICAgICByZWFkUHJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgICAgICAgaGludCxcbiAgICAgICAgICAgICAgICAgICAgZXhwbGFpblxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXhwbGFpbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZmluZChjbGFzc05hbWUsIHNjaGVtYSwgcXVlcnksIHF1ZXJ5T3B0aW9ucyk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlclxuICAgICAgICAgICAgICAgICAgLmZpbmQoY2xhc3NOYW1lLCBzY2hlbWEsIHF1ZXJ5LCBxdWVyeU9wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAudGhlbihvYmplY3RzID0+XG4gICAgICAgICAgICAgICAgICAgIG9iamVjdHMubWFwKG9iamVjdCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgb2JqZWN0ID0gdW50cmFuc2Zvcm1PYmplY3RBQ0wob2JqZWN0KTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlsdGVyU2Vuc2l0aXZlRGF0YShcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzTWFzdGVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNNYWludGVuYW5jZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjbEdyb3VwLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXV0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2NoZW1hQ29udHJvbGxlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3RlY3RlZEZpZWxkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5URVJOQUxfU0VSVkVSX0VSUk9SLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZGVsZXRlU2NoZW1hKGNsYXNzTmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbGV0IHNjaGVtYUNvbnRyb2xsZXI7XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSh7IGNsZWFyQ2FjaGU6IHRydWUgfSlcbiAgICAgIC50aGVuKHMgPT4ge1xuICAgICAgICBzY2hlbWFDb250cm9sbGVyID0gcztcbiAgICAgICAgcmV0dXJuIHNjaGVtYUNvbnRyb2xsZXIuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSwgdHJ1ZSk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4geyBmaWVsZHM6IHt9IH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAudGhlbigoc2NoZW1hOiBhbnkpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbkV4aXN0cyhjbGFzc05hbWUpXG4gICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5hZGFwdGVyLmNvdW50KGNsYXNzTmFtZSwgeyBmaWVsZHM6IHt9IH0sIG51bGwsICcnLCBmYWxzZSkpXG4gICAgICAgICAgLnRoZW4oY291bnQgPT4ge1xuICAgICAgICAgICAgaWYgKGNvdW50ID4gMCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICAgICAgMjU1LFxuICAgICAgICAgICAgICAgIGBDbGFzcyAke2NsYXNzTmFtZX0gaXMgbm90IGVtcHR5LCBjb250YWlucyAke2NvdW50fSBvYmplY3RzLCBjYW5ub3QgZHJvcCBzY2hlbWEuYFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci5kZWxldGVDbGFzcyhjbGFzc05hbWUpO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLnRoZW4od2FzUGFyc2VDb2xsZWN0aW9uID0+IHtcbiAgICAgICAgICAgIGlmICh3YXNQYXJzZUNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgY29uc3QgcmVsYXRpb25GaWVsZE5hbWVzID0gT2JqZWN0LmtleXMoc2NoZW1hLmZpZWxkcykuZmlsdGVyKFxuICAgICAgICAgICAgICAgIGZpZWxkTmFtZSA9PiBzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0udHlwZSA9PT0gJ1JlbGF0aW9uJ1xuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgICAgcmVsYXRpb25GaWVsZE5hbWVzLm1hcChuYW1lID0+XG4gICAgICAgICAgICAgICAgICB0aGlzLmFkYXB0ZXIuZGVsZXRlQ2xhc3Moam9pblRhYmxlTmFtZShjbGFzc05hbWUsIG5hbWUpKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBTY2hlbWFDYWNoZS5kZWwoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2NoZW1hQ29udHJvbGxlci5yZWxvYWREYXRhKCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBUaGlzIGhlbHBzIHRvIGNyZWF0ZSBpbnRlcm1lZGlhdGUgb2JqZWN0cyBmb3Igc2ltcGxlciBjb21wYXJpc29uIG9mXG4gIC8vIGtleSB2YWx1ZSBwYWlycyB1c2VkIGluIHF1ZXJ5IG9iamVjdHMuIEVhY2gga2V5IHZhbHVlIHBhaXIgd2lsbCByZXByZXNlbnRlZFxuICAvLyBpbiBhIHNpbWlsYXIgd2F5IHRvIGpzb25cbiAgb2JqZWN0VG9FbnRyaWVzU3RyaW5ncyhxdWVyeTogYW55KTogQXJyYXk8c3RyaW5nPiB7XG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHF1ZXJ5KS5tYXAoYSA9PiBhLm1hcChzID0+IEpTT04uc3RyaW5naWZ5KHMpKS5qb2luKCc6JykpO1xuICB9XG5cbiAgLy8gTmFpdmUgbG9naWMgcmVkdWNlciBmb3IgT1Igb3BlcmF0aW9ucyBtZWFudCB0byBiZSB1c2VkIG9ubHkgZm9yIHBvaW50ZXIgcGVybWlzc2lvbnMuXG4gIHJlZHVjZU9yT3BlcmF0aW9uKHF1ZXJ5OiB7ICRvcjogQXJyYXk8YW55PiB9KTogYW55IHtcbiAgICBpZiAoIXF1ZXJ5LiRvcikge1xuICAgICAgcmV0dXJuIHF1ZXJ5O1xuICAgIH1cbiAgICBjb25zdCBxdWVyaWVzID0gcXVlcnkuJG9yLm1hcChxID0+IHRoaXMub2JqZWN0VG9FbnRyaWVzU3RyaW5ncyhxKSk7XG4gICAgbGV0IHJlcGVhdCA9IGZhbHNlO1xuICAgIGRvIHtcbiAgICAgIHJlcGVhdCA9IGZhbHNlO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWVyaWVzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBxdWVyaWVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgY29uc3QgW3Nob3J0ZXIsIGxvbmdlcl0gPSBxdWVyaWVzW2ldLmxlbmd0aCA+IHF1ZXJpZXNbal0ubGVuZ3RoID8gW2osIGldIDogW2ksIGpdO1xuICAgICAgICAgIGNvbnN0IGZvdW5kRW50cmllcyA9IHF1ZXJpZXNbc2hvcnRlcl0ucmVkdWNlKFxuICAgICAgICAgICAgKGFjYywgZW50cnkpID0+IGFjYyArIChxdWVyaWVzW2xvbmdlcl0uaW5jbHVkZXMoZW50cnkpID8gMSA6IDApLFxuICAgICAgICAgICAgMFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3Qgc2hvcnRlckVudHJpZXMgPSBxdWVyaWVzW3Nob3J0ZXJdLmxlbmd0aDtcbiAgICAgICAgICBpZiAoZm91bmRFbnRyaWVzID09PSBzaG9ydGVyRW50cmllcykge1xuICAgICAgICAgICAgLy8gSWYgdGhlIHNob3J0ZXIgcXVlcnkgaXMgY29tcGxldGVseSBjb250YWluZWQgaW4gdGhlIGxvbmdlciBvbmUsIHdlIGNhbiBzdHJpa2VcbiAgICAgICAgICAgIC8vIG91dCB0aGUgbG9uZ2VyIHF1ZXJ5LlxuICAgICAgICAgICAgcXVlcnkuJG9yLnNwbGljZShsb25nZXIsIDEpO1xuICAgICAgICAgICAgcXVlcmllcy5zcGxpY2UobG9uZ2VyLCAxKTtcbiAgICAgICAgICAgIHJlcGVhdCA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IHdoaWxlIChyZXBlYXQpO1xuICAgIGlmIChxdWVyeS4kb3IubGVuZ3RoID09PSAxKSB7XG4gICAgICBxdWVyeSA9IHsgLi4ucXVlcnksIC4uLnF1ZXJ5LiRvclswXSB9O1xuICAgICAgZGVsZXRlIHF1ZXJ5LiRvcjtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG5cbiAgLy8gTmFpdmUgbG9naWMgcmVkdWNlciBmb3IgQU5EIG9wZXJhdGlvbnMgbWVhbnQgdG8gYmUgdXNlZCBvbmx5IGZvciBwb2ludGVyIHBlcm1pc3Npb25zLlxuICByZWR1Y2VBbmRPcGVyYXRpb24ocXVlcnk6IHsgJGFuZDogQXJyYXk8YW55PiB9KTogYW55IHtcbiAgICBpZiAoIXF1ZXJ5LiRhbmQpIHtcbiAgICAgIHJldHVybiBxdWVyeTtcbiAgICB9XG4gICAgY29uc3QgcXVlcmllcyA9IHF1ZXJ5LiRhbmQubWFwKHEgPT4gdGhpcy5vYmplY3RUb0VudHJpZXNTdHJpbmdzKHEpKTtcbiAgICBsZXQgcmVwZWF0ID0gZmFsc2U7XG4gICAgZG8ge1xuICAgICAgcmVwZWF0ID0gZmFsc2U7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXJpZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IHF1ZXJpZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBjb25zdCBbc2hvcnRlciwgbG9uZ2VyXSA9IHF1ZXJpZXNbaV0ubGVuZ3RoID4gcXVlcmllc1tqXS5sZW5ndGggPyBbaiwgaV0gOiBbaSwgal07XG4gICAgICAgICAgY29uc3QgZm91bmRFbnRyaWVzID0gcXVlcmllc1tzaG9ydGVyXS5yZWR1Y2UoXG4gICAgICAgICAgICAoYWNjLCBlbnRyeSkgPT4gYWNjICsgKHF1ZXJpZXNbbG9uZ2VyXS5pbmNsdWRlcyhlbnRyeSkgPyAxIDogMCksXG4gICAgICAgICAgICAwXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb25zdCBzaG9ydGVyRW50cmllcyA9IHF1ZXJpZXNbc2hvcnRlcl0ubGVuZ3RoO1xuICAgICAgICAgIGlmIChmb3VuZEVudHJpZXMgPT09IHNob3J0ZXJFbnRyaWVzKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGUgc2hvcnRlciBxdWVyeSBpcyBjb21wbGV0ZWx5IGNvbnRhaW5lZCBpbiB0aGUgbG9uZ2VyIG9uZSwgd2UgY2FuIHN0cmlrZVxuICAgICAgICAgICAgLy8gb3V0IHRoZSBzaG9ydGVyIHF1ZXJ5LlxuICAgICAgICAgICAgcXVlcnkuJGFuZC5zcGxpY2Uoc2hvcnRlciwgMSk7XG4gICAgICAgICAgICBxdWVyaWVzLnNwbGljZShzaG9ydGVyLCAxKTtcbiAgICAgICAgICAgIHJlcGVhdCA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IHdoaWxlIChyZXBlYXQpO1xuICAgIGlmIChxdWVyeS4kYW5kLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcXVlcnkgPSB7IC4uLnF1ZXJ5LCAuLi5xdWVyeS4kYW5kWzBdIH07XG4gICAgICBkZWxldGUgcXVlcnkuJGFuZDtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG5cbiAgLy8gQ29uc3RyYWludHMgcXVlcnkgdXNpbmcgQ0xQJ3MgcG9pbnRlciBwZXJtaXNzaW9ucyAoUFApIGlmIGFueS5cbiAgLy8gMS4gRXRyYWN0IHRoZSB1c2VyIGlkIGZyb20gY2FsbGVyJ3MgQUNMZ3JvdXA7XG4gIC8vIDIuIEV4Y3RyYWN0IGEgbGlzdCBvZiBmaWVsZCBuYW1lcyB0aGF0IGFyZSBQUCBmb3IgdGFyZ2V0IGNvbGxlY3Rpb24gYW5kIG9wZXJhdGlvbjtcbiAgLy8gMy4gQ29uc3RyYWludCB0aGUgb3JpZ2luYWwgcXVlcnkgc28gdGhhdCBlYWNoIFBQIGZpZWxkIG11c3RcbiAgLy8gcG9pbnQgdG8gY2FsbGVyJ3MgaWQgKG9yIGNvbnRhaW4gaXQgaW4gY2FzZSBvZiBQUCBmaWVsZCBiZWluZyBhbiBhcnJheSlcbiAgYWRkUG9pbnRlclBlcm1pc3Npb25zKFxuICAgIHNjaGVtYTogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyLFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIG9wZXJhdGlvbjogc3RyaW5nLFxuICAgIHF1ZXJ5OiBhbnksXG4gICAgYWNsR3JvdXA6IGFueVtdID0gW11cbiAgKTogYW55IHtcbiAgICAvLyBDaGVjayBpZiBjbGFzcyBoYXMgcHVibGljIHBlcm1pc3Npb24gZm9yIG9wZXJhdGlvblxuICAgIC8vIElmIHRoZSBCYXNlQ0xQIHBhc3MsIGxldCBnbyB0aHJvdWdoXG4gICAgaWYgKHNjaGVtYS50ZXN0UGVybWlzc2lvbnNGb3JDbGFzc05hbWUoY2xhc3NOYW1lLCBhY2xHcm91cCwgb3BlcmF0aW9uKSkge1xuICAgICAgcmV0dXJuIHF1ZXJ5O1xuICAgIH1cbiAgICBjb25zdCBwZXJtcyA9IHNjaGVtYS5nZXRDbGFzc0xldmVsUGVybWlzc2lvbnMoY2xhc3NOYW1lKTtcblxuICAgIGNvbnN0IHVzZXJBQ0wgPSBhY2xHcm91cC5maWx0ZXIoYWNsID0+IHtcbiAgICAgIHJldHVybiBhY2wuaW5kZXhPZigncm9sZTonKSAhPSAwICYmIGFjbCAhPSAnKic7XG4gICAgfSk7XG5cbiAgICBjb25zdCBncm91cEtleSA9XG4gICAgICBbJ2dldCcsICdmaW5kJywgJ2NvdW50J10uaW5kZXhPZihvcGVyYXRpb24pID4gLTEgPyAncmVhZFVzZXJGaWVsZHMnIDogJ3dyaXRlVXNlckZpZWxkcyc7XG5cbiAgICBjb25zdCBwZXJtRmllbGRzID0gW107XG5cbiAgICBpZiAocGVybXNbb3BlcmF0aW9uXSAmJiBwZXJtc1tvcGVyYXRpb25dLnBvaW50ZXJGaWVsZHMpIHtcbiAgICAgIHBlcm1GaWVsZHMucHVzaCguLi5wZXJtc1tvcGVyYXRpb25dLnBvaW50ZXJGaWVsZHMpO1xuICAgIH1cblxuICAgIGlmIChwZXJtc1tncm91cEtleV0pIHtcbiAgICAgIGZvciAoY29uc3QgZmllbGQgb2YgcGVybXNbZ3JvdXBLZXldKSB7XG4gICAgICAgIGlmICghcGVybUZpZWxkcy5pbmNsdWRlcyhmaWVsZCkpIHtcbiAgICAgICAgICBwZXJtRmllbGRzLnB1c2goZmllbGQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHRoZSBBQ0wgc2hvdWxkIGhhdmUgZXhhY3RseSAxIHVzZXJcbiAgICBpZiAocGVybUZpZWxkcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyB0aGUgQUNMIHNob3VsZCBoYXZlIGV4YWN0bHkgMSB1c2VyXG4gICAgICAvLyBObyB1c2VyIHNldCByZXR1cm4gdW5kZWZpbmVkXG4gICAgICAvLyBJZiB0aGUgbGVuZ3RoIGlzID4gMSwgdGhhdCBtZWFucyB3ZSBkaWRuJ3QgZGUtZHVwZSB1c2VycyBjb3JyZWN0bHlcbiAgICAgIGlmICh1c2VyQUNMLmxlbmd0aCAhPSAxKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHVzZXJJZCA9IHVzZXJBQ0xbMF07XG4gICAgICBjb25zdCB1c2VyUG9pbnRlciA9IHtcbiAgICAgICAgX190eXBlOiAnUG9pbnRlcicsXG4gICAgICAgIGNsYXNzTmFtZTogJ19Vc2VyJyxcbiAgICAgICAgb2JqZWN0SWQ6IHVzZXJJZCxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHF1ZXJpZXMgPSBwZXJtRmllbGRzLm1hcChrZXkgPT4ge1xuICAgICAgICBjb25zdCBmaWVsZERlc2NyaXB0b3IgPSBzY2hlbWEuZ2V0RXhwZWN0ZWRUeXBlKGNsYXNzTmFtZSwga2V5KTtcbiAgICAgICAgY29uc3QgZmllbGRUeXBlID1cbiAgICAgICAgICBmaWVsZERlc2NyaXB0b3IgJiZcbiAgICAgICAgICB0eXBlb2YgZmllbGREZXNjcmlwdG9yID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChmaWVsZERlc2NyaXB0b3IsICd0eXBlJylcbiAgICAgICAgICAgID8gZmllbGREZXNjcmlwdG9yLnR5cGVcbiAgICAgICAgICAgIDogbnVsbDtcblxuICAgICAgICBsZXQgcXVlcnlDbGF1c2U7XG5cbiAgICAgICAgaWYgKGZpZWxkVHlwZSA9PT0gJ1BvaW50ZXInKSB7XG4gICAgICAgICAgLy8gY29uc3RyYWludCBmb3Igc2luZ2xlIHBvaW50ZXIgc2V0dXBcbiAgICAgICAgICBxdWVyeUNsYXVzZSA9IHsgW2tleV06IHVzZXJQb2ludGVyIH07XG4gICAgICAgIH0gZWxzZSBpZiAoZmllbGRUeXBlID09PSAnQXJyYXknKSB7XG4gICAgICAgICAgLy8gY29uc3RyYWludCBmb3IgdXNlcnMtYXJyYXkgc2V0dXBcbiAgICAgICAgICBxdWVyeUNsYXVzZSA9IHsgW2tleV06IHsgJGFsbDogW3VzZXJQb2ludGVyXSB9IH07XG4gICAgICAgIH0gZWxzZSBpZiAoZmllbGRUeXBlID09PSAnT2JqZWN0Jykge1xuICAgICAgICAgIC8vIGNvbnN0cmFpbnQgZm9yIG9iamVjdCBzZXR1cFxuICAgICAgICAgIHF1ZXJ5Q2xhdXNlID0geyBba2V5XTogdXNlclBvaW50ZXIgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlcmUgaXMgYSBDTFAgZmllbGQgb2YgYW4gdW5leHBlY3RlZCB0eXBlLiBUaGlzIGNvbmRpdGlvbiBzaG91bGQgbm90IGhhcHBlbiwgd2hpY2ggaXNcbiAgICAgICAgICAvLyB3aHkgaXMgYmVpbmcgdHJlYXRlZCBhcyBhbiBlcnJvci5cbiAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgIGBBbiB1bmV4cGVjdGVkIGNvbmRpdGlvbiBvY2N1cnJlZCB3aGVuIHJlc29sdmluZyBwb2ludGVyIHBlcm1pc3Npb25zOiAke2NsYXNzTmFtZX0gJHtrZXl9YFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgd2UgYWxyZWFkeSBoYXZlIGEgY29uc3RyYWludCBvbiB0aGUga2V5LCB1c2UgdGhlICRhbmRcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChxdWVyeSwga2V5KSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlZHVjZUFuZE9wZXJhdGlvbih7ICRhbmQ6IFtxdWVyeUNsYXVzZSwgcXVlcnldIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIG90aGVyd2lzZSBqdXN0IGFkZCB0aGUgY29uc3RhaW50XG4gICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSwgcXVlcnlDbGF1c2UpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBxdWVyaWVzLmxlbmd0aCA9PT0gMSA/IHF1ZXJpZXNbMF0gOiB0aGlzLnJlZHVjZU9yT3BlcmF0aW9uKHsgJG9yOiBxdWVyaWVzIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcXVlcnk7XG4gICAgfVxuICB9XG5cbiAgYWRkUHJvdGVjdGVkRmllbGRzKFxuICAgIHNjaGVtYTogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyIHwgYW55LFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHF1ZXJ5OiBhbnkgPSB7fSxcbiAgICBhY2xHcm91cDogYW55W10gPSBbXSxcbiAgICBhdXRoOiBhbnkgPSB7fSxcbiAgICBxdWVyeU9wdGlvbnM6IEZ1bGxRdWVyeU9wdGlvbnMgPSB7fVxuICApOiBudWxsIHwgc3RyaW5nW10ge1xuICAgIGNvbnN0IHBlcm1zID1cbiAgICAgIHNjaGVtYSAmJiBzY2hlbWEuZ2V0Q2xhc3NMZXZlbFBlcm1pc3Npb25zXG4gICAgICAgID8gc2NoZW1hLmdldENsYXNzTGV2ZWxQZXJtaXNzaW9ucyhjbGFzc05hbWUpXG4gICAgICAgIDogc2NoZW1hO1xuICAgIGlmICghcGVybXMpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgcHJvdGVjdGVkRmllbGRzID0gcGVybXMucHJvdGVjdGVkRmllbGRzO1xuICAgIGlmICghcHJvdGVjdGVkRmllbGRzKSByZXR1cm4gbnVsbDtcblxuICAgIGlmIChhY2xHcm91cC5pbmRleE9mKHF1ZXJ5Lm9iamVjdElkKSA+IC0xKSByZXR1cm4gbnVsbDtcblxuICAgIC8vIGZvciBxdWVyaWVzIHdoZXJlIFwia2V5c1wiIGFyZSBzZXQgYW5kIGRvIG5vdCBpbmNsdWRlIGFsbCAndXNlckZpZWxkJzp7ZmllbGR9LFxuICAgIC8vIHdlIGhhdmUgdG8gdHJhbnNwYXJlbnRseSBpbmNsdWRlIGl0LCBhbmQgdGhlbiByZW1vdmUgYmVmb3JlIHJldHVybmluZyB0byBjbGllbnRcbiAgICAvLyBCZWNhdXNlIGlmIHN1Y2gga2V5IG5vdCBwcm9qZWN0ZWQgdGhlIHBlcm1pc3Npb24gd29uJ3QgYmUgZW5mb3JjZWQgcHJvcGVybHlcbiAgICAvLyBQUyB0aGlzIGlzIGNhbGxlZCB3aGVuICdleGNsdWRlS2V5cycgYWxyZWFkeSByZWR1Y2VkIHRvICdrZXlzJ1xuICAgIGNvbnN0IHByZXNlcnZlS2V5cyA9IHF1ZXJ5T3B0aW9ucy5rZXlzO1xuXG4gICAgLy8gdGhlc2UgYXJlIGtleXMgdGhhdCBuZWVkIHRvIGJlIGluY2x1ZGVkIG9ubHlcbiAgICAvLyB0byBiZSBhYmxlIHRvIGFwcGx5IHByb3RlY3RlZEZpZWxkcyBieSBwb2ludGVyXG4gICAgLy8gYW5kIHRoZW4gdW5zZXQgYmVmb3JlIHJldHVybmluZyB0byBjbGllbnQgKGxhdGVyIGluICBmaWx0ZXJTZW5zaXRpdmVGaWVsZHMpXG4gICAgY29uc3Qgc2VydmVyT25seUtleXMgPSBbXTtcblxuICAgIGNvbnN0IGF1dGhlbnRpY2F0ZWQgPSBhdXRoLnVzZXI7XG5cbiAgICAvLyBtYXAgdG8gYWxsb3cgY2hlY2sgd2l0aG91dCBhcnJheSBzZWFyY2hcbiAgICBjb25zdCByb2xlcyA9IChhdXRoLnVzZXJSb2xlcyB8fCBbXSkucmVkdWNlKChhY2MsIHIpID0+IHtcbiAgICAgIGFjY1tyXSA9IHByb3RlY3RlZEZpZWxkc1tyXTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgLy8gYXJyYXkgb2Ygc2V0cyBvZiBwcm90ZWN0ZWQgZmllbGRzLiBzZXBhcmF0ZSBpdGVtIGZvciBlYWNoIGFwcGxpY2FibGUgY3JpdGVyaWFcbiAgICBjb25zdCBwcm90ZWN0ZWRLZXlzU2V0cyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBrZXkgaW4gcHJvdGVjdGVkRmllbGRzKSB7XG4gICAgICAvLyBza2lwIHVzZXJGaWVsZHNcbiAgICAgIGlmIChrZXkuc3RhcnRzV2l0aCgndXNlckZpZWxkOicpKSB7XG4gICAgICAgIGlmIChwcmVzZXJ2ZUtleXMpIHtcbiAgICAgICAgICBjb25zdCBmaWVsZE5hbWUgPSBrZXkuc3Vic3RyaW5nKDEwKTtcbiAgICAgICAgICBpZiAoIXByZXNlcnZlS2V5cy5pbmNsdWRlcyhmaWVsZE5hbWUpKSB7XG4gICAgICAgICAgICAvLyAxLiBwdXQgaXQgdGhlcmUgdGVtcG9yYXJpbHlcbiAgICAgICAgICAgIHF1ZXJ5T3B0aW9ucy5rZXlzICYmIHF1ZXJ5T3B0aW9ucy5rZXlzLnB1c2goZmllbGROYW1lKTtcbiAgICAgICAgICAgIC8vIDIuIHByZXNlcnZlIGl0IGRlbGV0ZSBsYXRlclxuICAgICAgICAgICAgc2VydmVyT25seUtleXMucHVzaChmaWVsZE5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gYWRkIHB1YmxpYyB0aWVyXG4gICAgICBpZiAoa2V5ID09PSAnKicpIHtcbiAgICAgICAgcHJvdGVjdGVkS2V5c1NldHMucHVzaChwcm90ZWN0ZWRGaWVsZHNba2V5XSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoYXV0aGVudGljYXRlZCkge1xuICAgICAgICBpZiAoa2V5ID09PSAnYXV0aGVudGljYXRlZCcpIHtcbiAgICAgICAgICAvLyBmb3IgbG9nZ2VkIGluIHVzZXJzXG4gICAgICAgICAgcHJvdGVjdGVkS2V5c1NldHMucHVzaChwcm90ZWN0ZWRGaWVsZHNba2V5XSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocm9sZXNba2V5XSAmJiBrZXkuc3RhcnRzV2l0aCgncm9sZTonKSkge1xuICAgICAgICAgIC8vIGFkZCBhcHBsaWNhYmxlIHJvbGVzXG4gICAgICAgICAgcHJvdGVjdGVkS2V5c1NldHMucHVzaChyb2xlc1trZXldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNoZWNrIGlmIHRoZXJlJ3MgYSBydWxlIGZvciBjdXJyZW50IHVzZXIncyBpZFxuICAgIGlmIChhdXRoZW50aWNhdGVkKSB7XG4gICAgICBjb25zdCB1c2VySWQgPSBhdXRoLnVzZXIuaWQ7XG4gICAgICBpZiAocGVybXMucHJvdGVjdGVkRmllbGRzW3VzZXJJZF0pIHtcbiAgICAgICAgcHJvdGVjdGVkS2V5c1NldHMucHVzaChwZXJtcy5wcm90ZWN0ZWRGaWVsZHNbdXNlcklkXSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJlc2VydmUgZmllbGRzIHRvIGJlIHJlbW92ZWQgYmVmb3JlIHNlbmRpbmcgcmVzcG9uc2UgdG8gY2xpZW50XG4gICAgaWYgKHNlcnZlck9ubHlLZXlzLmxlbmd0aCA+IDApIHtcbiAgICAgIHBlcm1zLnByb3RlY3RlZEZpZWxkcy50ZW1wb3JhcnlLZXlzID0gc2VydmVyT25seUtleXM7XG4gICAgfVxuXG4gICAgbGV0IHByb3RlY3RlZEtleXMgPSBwcm90ZWN0ZWRLZXlzU2V0cy5yZWR1Y2UoKGFjYywgbmV4dCkgPT4ge1xuICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgYWNjLnB1c2goLi4ubmV4dCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIFtdKTtcblxuICAgIC8vIGludGVyc2VjdCBhbGwgc2V0cyBvZiBwcm90ZWN0ZWRGaWVsZHNcbiAgICBwcm90ZWN0ZWRLZXlzU2V0cy5mb3JFYWNoKGZpZWxkcyA9PiB7XG4gICAgICBpZiAoZmllbGRzKSB7XG4gICAgICAgIHByb3RlY3RlZEtleXMgPSBwcm90ZWN0ZWRLZXlzLmZpbHRlcih2ID0+IGZpZWxkcy5pbmNsdWRlcyh2KSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcHJvdGVjdGVkS2V5cztcbiAgfVxuXG4gIGNyZWF0ZVRyYW5zYWN0aW9uYWxTZXNzaW9uKCkge1xuICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuY3JlYXRlVHJhbnNhY3Rpb25hbFNlc3Npb24oKS50aGVuKHRyYW5zYWN0aW9uYWxTZXNzaW9uID0+IHtcbiAgICAgIHRoaXMuX3RyYW5zYWN0aW9uYWxTZXNzaW9uID0gdHJhbnNhY3Rpb25hbFNlc3Npb247XG4gICAgfSk7XG4gIH1cblxuICBjb21taXRUcmFuc2FjdGlvbmFsU2Vzc2lvbigpIHtcbiAgICBpZiAoIXRoaXMuX3RyYW5zYWN0aW9uYWxTZXNzaW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZXJlIGlzIG5vIHRyYW5zYWN0aW9uYWwgc2Vzc2lvbiB0byBjb21taXQnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRhcHRlci5jb21taXRUcmFuc2FjdGlvbmFsU2Vzc2lvbih0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvbikudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvbiA9IG51bGw7XG4gICAgfSk7XG4gIH1cblxuICBhYm9ydFRyYW5zYWN0aW9uYWxTZXNzaW9uKCkge1xuICAgIGlmICghdGhpcy5fdHJhbnNhY3Rpb25hbFNlc3Npb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlcmUgaXMgbm8gdHJhbnNhY3Rpb25hbCBzZXNzaW9uIHRvIGFib3J0Jyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuYWJvcnRUcmFuc2FjdGlvbmFsU2Vzc2lvbih0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvbikudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvbiA9IG51bGw7XG4gICAgfSk7XG4gIH1cblxuICAvLyBUT0RPOiBjcmVhdGUgaW5kZXhlcyBvbiBmaXJzdCBjcmVhdGlvbiBvZiBhIF9Vc2VyIG9iamVjdC4gT3RoZXJ3aXNlIGl0J3MgaW1wb3NzaWJsZSB0b1xuICAvLyBoYXZlIGEgUGFyc2UgYXBwIHdpdGhvdXQgaXQgaGF2aW5nIGEgX1VzZXIgY29sbGVjdGlvbi5cbiAgYXN5bmMgcGVyZm9ybUluaXRpYWxpemF0aW9uKCkge1xuICAgIGF3YWl0IHRoaXMuYWRhcHRlci5wZXJmb3JtSW5pdGlhbGl6YXRpb24oe1xuICAgICAgVm9sYXRpbGVDbGFzc2VzU2NoZW1hczogU2NoZW1hQ29udHJvbGxlci5Wb2xhdGlsZUNsYXNzZXNTY2hlbWFzLFxuICAgIH0pO1xuICAgIGNvbnN0IHJlcXVpcmVkVXNlckZpZWxkcyA9IHtcbiAgICAgIGZpZWxkczoge1xuICAgICAgICAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9EZWZhdWx0LFxuICAgICAgICAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9Vc2VyLFxuICAgICAgfSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcXVpcmVkUm9sZUZpZWxkcyA9IHtcbiAgICAgIGZpZWxkczoge1xuICAgICAgICAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9EZWZhdWx0LFxuICAgICAgICAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9Sb2xlLFxuICAgICAgfSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcXVpcmVkSWRlbXBvdGVuY3lGaWVsZHMgPSB7XG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fRGVmYXVsdCxcbiAgICAgICAgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fSWRlbXBvdGVuY3ksXG4gICAgICB9LFxuICAgIH07XG4gICAgYXdhaXQgdGhpcy5sb2FkU2NoZW1hKCkudGhlbihzY2hlbWEgPT4gc2NoZW1hLmVuZm9yY2VDbGFzc0V4aXN0cygnX1VzZXInKSk7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2NoZW1hKCkudGhlbihzY2hlbWEgPT4gc2NoZW1hLmVuZm9yY2VDbGFzc0V4aXN0cygnX1JvbGUnKSk7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2NoZW1hKCkudGhlbihzY2hlbWEgPT4gc2NoZW1hLmVuZm9yY2VDbGFzc0V4aXN0cygnX0lkZW1wb3RlbmN5JykpO1xuXG4gICAgYXdhaXQgdGhpcy5hZGFwdGVyLmVuc3VyZVVuaXF1ZW5lc3MoJ19Vc2VyJywgcmVxdWlyZWRVc2VyRmllbGRzLCBbJ3VzZXJuYW1lJ10pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ2dlci53YXJuKCdVbmFibGUgdG8gZW5zdXJlIHVuaXF1ZW5lc3MgZm9yIHVzZXJuYW1lczogJywgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfSk7XG5cbiAgICBpZiAoIXRoaXMub3B0aW9ucy5lbmFibGVDb2xsYXRpb25DYXNlQ29tcGFyaXNvbikge1xuICAgICAgYXdhaXQgdGhpcy5hZGFwdGVyXG4gICAgICAgIC5lbnN1cmVJbmRleCgnX1VzZXInLCByZXF1aXJlZFVzZXJGaWVsZHMsIFsndXNlcm5hbWUnXSwgJ2Nhc2VfaW5zZW5zaXRpdmVfdXNlcm5hbWUnLCB0cnVlKVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIGxvZ2dlci53YXJuKCdVbmFibGUgdG8gY3JlYXRlIGNhc2UgaW5zZW5zaXRpdmUgdXNlcm5hbWUgaW5kZXg6ICcsIGVycm9yKTtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfSk7XG5cbiAgICAgIGF3YWl0IHRoaXMuYWRhcHRlclxuICAgICAgICAuZW5zdXJlSW5kZXgoJ19Vc2VyJywgcmVxdWlyZWRVc2VyRmllbGRzLCBbJ2VtYWlsJ10sICdjYXNlX2luc2Vuc2l0aXZlX2VtYWlsJywgdHJ1ZSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBsb2dnZXIud2FybignVW5hYmxlIHRvIGNyZWF0ZSBjYXNlIGluc2Vuc2l0aXZlIGVtYWlsIGluZGV4OiAnLCBlcnJvcik7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuYWRhcHRlci5lbnN1cmVVbmlxdWVuZXNzKCdfVXNlcicsIHJlcXVpcmVkVXNlckZpZWxkcywgWydlbWFpbCddKS5jYXRjaChlcnJvciA9PiB7XG4gICAgICBsb2dnZXIud2FybignVW5hYmxlIHRvIGVuc3VyZSB1bmlxdWVuZXNzIGZvciB1c2VyIGVtYWlsIGFkZHJlc3NlczogJywgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFkYXB0ZXIuZW5zdXJlVW5pcXVlbmVzcygnX1JvbGUnLCByZXF1aXJlZFJvbGVGaWVsZHMsIFsnbmFtZSddKS5jYXRjaChlcnJvciA9PiB7XG4gICAgICBsb2dnZXIud2FybignVW5hYmxlIHRvIGVuc3VyZSB1bmlxdWVuZXNzIGZvciByb2xlIG5hbWU6ICcsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5hZGFwdGVyXG4gICAgICAuZW5zdXJlVW5pcXVlbmVzcygnX0lkZW1wb3RlbmN5JywgcmVxdWlyZWRJZGVtcG90ZW5jeUZpZWxkcywgWydyZXFJZCddKVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgbG9nZ2VyLndhcm4oJ1VuYWJsZSB0byBlbnN1cmUgdW5pcXVlbmVzcyBmb3IgaWRlbXBvdGVuY3kgcmVxdWVzdCBJRDogJywgZXJyb3IpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0pO1xuXG4gICAgY29uc3QgaXNNb25nb0FkYXB0ZXIgPSB0aGlzLmFkYXB0ZXIgaW5zdGFuY2VvZiBNb25nb1N0b3JhZ2VBZGFwdGVyO1xuICAgIGNvbnN0IGlzUG9zdGdyZXNBZGFwdGVyID0gdGhpcy5hZGFwdGVyIGluc3RhbmNlb2YgUG9zdGdyZXNTdG9yYWdlQWRhcHRlcjtcbiAgICBpZiAoaXNNb25nb0FkYXB0ZXIgfHwgaXNQb3N0Z3Jlc0FkYXB0ZXIpIHtcbiAgICAgIGxldCBvcHRpb25zID0ge307XG4gICAgICBpZiAoaXNNb25nb0FkYXB0ZXIpIHtcbiAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0dGw6IDAsXG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKGlzUG9zdGdyZXNBZGFwdGVyKSB7XG4gICAgICAgIG9wdGlvbnMgPSB0aGlzLmlkZW1wb3RlbmN5T3B0aW9ucztcbiAgICAgICAgb3B0aW9ucy5zZXRJZGVtcG90ZW5jeUZ1bmN0aW9uID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IHRoaXMuYWRhcHRlclxuICAgICAgICAuZW5zdXJlSW5kZXgoJ19JZGVtcG90ZW5jeScsIHJlcXVpcmVkSWRlbXBvdGVuY3lGaWVsZHMsIFsnZXhwaXJlJ10sICd0dGwnLCBmYWxzZSwgb3B0aW9ucylcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBsb2dnZXIud2FybignVW5hYmxlIHRvIGNyZWF0ZSBUVEwgaW5kZXggZm9yIGlkZW1wb3RlbmN5IGV4cGlyZSBkYXRlOiAnLCBlcnJvcik7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBhd2FpdCB0aGlzLmFkYXB0ZXIudXBkYXRlU2NoZW1hV2l0aEluZGV4ZXMoKTtcbiAgfVxuXG4gIF9leHBhbmRSZXN1bHRPbktleVBhdGgob2JqZWN0OiBhbnksIGtleTogc3RyaW5nLCB2YWx1ZTogYW55KTogYW55IHtcbiAgICBpZiAoa2V5LmluZGV4T2YoJy4nKSA8IDApIHtcbiAgICAgIG9iamVjdFtrZXldID0gdmFsdWVba2V5XTtcbiAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgfVxuICAgIGNvbnN0IHBhdGggPSBrZXkuc3BsaXQoJy4nKTtcbiAgICBjb25zdCBmaXJzdEtleSA9IHBhdGhbMF07XG4gICAgY29uc3QgbmV4dFBhdGggPSBwYXRoLnNsaWNlKDEpLmpvaW4oJy4nKTtcblxuICAgIC8vIFNjYW4gcmVxdWVzdCBkYXRhIGZvciBkZW5pZWQga2V5d29yZHNcbiAgICBpZiAodGhpcy5vcHRpb25zICYmIHRoaXMub3B0aW9ucy5yZXF1ZXN0S2V5d29yZERlbnlsaXN0KSB7XG4gICAgICAvLyBTY2FuIHJlcXVlc3QgZGF0YSBmb3IgZGVuaWVkIGtleXdvcmRzXG4gICAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2YgdGhpcy5vcHRpb25zLnJlcXVlc3RLZXl3b3JkRGVueWxpc3QpIHtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBVdGlscy5vYmplY3RDb250YWluc0tleVZhbHVlKFxuICAgICAgICAgIHsgW2ZpcnN0S2V5XTogdHJ1ZSwgW25leHRQYXRoXTogdHJ1ZSB9LFxuICAgICAgICAgIGtleXdvcmQua2V5LFxuICAgICAgICAgIHRydWVcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSxcbiAgICAgICAgICAgIGBQcm9oaWJpdGVkIGtleXdvcmQgaW4gcmVxdWVzdCBkYXRhOiAke0pTT04uc3RyaW5naWZ5KGtleXdvcmQpfS5gXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIG9iamVjdFtmaXJzdEtleV0gPSB0aGlzLl9leHBhbmRSZXN1bHRPbktleVBhdGgoXG4gICAgICBvYmplY3RbZmlyc3RLZXldIHx8IHt9LFxuICAgICAgbmV4dFBhdGgsXG4gICAgICB2YWx1ZVtmaXJzdEtleV1cbiAgICApO1xuICAgIGRlbGV0ZSBvYmplY3Rba2V5XTtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgX3Nhbml0aXplRGF0YWJhc2VSZXN1bHQob3JpZ2luYWxPYmplY3Q6IGFueSwgcmVzdWx0OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0ge307XG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzcG9uc2UpO1xuICAgIH1cbiAgICBPYmplY3Qua2V5cyhvcmlnaW5hbE9iamVjdCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3Qga2V5VXBkYXRlID0gb3JpZ2luYWxPYmplY3Rba2V5XTtcbiAgICAgIC8vIGRldGVybWluZSBpZiB0aGF0IHdhcyBhbiBvcFxuICAgICAgaWYgKFxuICAgICAgICBrZXlVcGRhdGUgJiZcbiAgICAgICAgdHlwZW9mIGtleVVwZGF0ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAga2V5VXBkYXRlLl9fb3AgJiZcbiAgICAgICAgWydBZGQnLCAnQWRkVW5pcXVlJywgJ1JlbW92ZScsICdJbmNyZW1lbnQnLCAnU2V0T25JbnNlcnQnXS5pbmRleE9mKGtleVVwZGF0ZS5fX29wKSA+IC0xXG4gICAgICApIHtcbiAgICAgICAgLy8gb25seSB2YWxpZCBvcHMgdGhhdCBwcm9kdWNlIGFuIGFjdGlvbmFibGUgcmVzdWx0XG4gICAgICAgIC8vIHRoZSBvcCBtYXkgaGF2ZSBoYXBwZW5lZCBvbiBhIGtleXBhdGhcbiAgICAgICAgdGhpcy5fZXhwYW5kUmVzdWx0T25LZXlQYXRoKHJlc3BvbnNlLCBrZXksIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXNwb25zZSk7XG4gIH1cblxuICBzdGF0aWMgX3ZhbGlkYXRlUXVlcnk6IChhbnksIGJvb2xlYW4sIGJvb2xlYW4sIGJvb2xlYW4pID0+IHZvaWQ7XG4gIHN0YXRpYyBmaWx0ZXJTZW5zaXRpdmVEYXRhOiAoYm9vbGVhbiwgYm9vbGVhbiwgYW55W10sIGFueSwgYW55LCBhbnksIHN0cmluZywgYW55W10sIGFueSkgPT4gdm9pZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBEYXRhYmFzZUNvbnRyb2xsZXI7XG4vLyBFeHBvc2UgdmFsaWRhdGVRdWVyeSBmb3IgdGVzdHNcbm1vZHVsZS5leHBvcnRzLl92YWxpZGF0ZVF1ZXJ5ID0gdmFsaWRhdGVRdWVyeTtcbm1vZHVsZS5leHBvcnRzLmZpbHRlclNlbnNpdGl2ZURhdGEgPSBmaWx0ZXJTZW5zaXRpdmVEYXRhO1xuIl0sIm1hcHBpbmdzIjoiOztBQUtBLElBQUFBLEtBQUEsR0FBQUMsT0FBQTtBQUVBLElBQUFDLE9BQUEsR0FBQUMsc0JBQUEsQ0FBQUYsT0FBQTtBQUVBLElBQUFHLFVBQUEsR0FBQUQsc0JBQUEsQ0FBQUYsT0FBQTtBQUVBLElBQUFJLFNBQUEsR0FBQUYsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFLLE9BQUEsR0FBQUgsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFNLE1BQUEsR0FBQUosc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFPLGdCQUFBLEdBQUFDLHVCQUFBLENBQUFSLE9BQUE7QUFDQSxJQUFBUyxlQUFBLEdBQUFULE9BQUE7QUFDQSxJQUFBVSxvQkFBQSxHQUFBUixzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQVcsdUJBQUEsR0FBQVQsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFZLFlBQUEsR0FBQVYsc0JBQUEsQ0FBQUYsT0FBQTtBQUF3RCxTQUFBYSx5QkFBQUMsV0FBQSxlQUFBQyxPQUFBLGtDQUFBQyxpQkFBQSxPQUFBRCxPQUFBLFFBQUFFLGdCQUFBLE9BQUFGLE9BQUEsWUFBQUYsd0JBQUEsWUFBQUEsQ0FBQUMsV0FBQSxXQUFBQSxXQUFBLEdBQUFHLGdCQUFBLEdBQUFELGlCQUFBLEtBQUFGLFdBQUE7QUFBQSxTQUFBTix3QkFBQVUsR0FBQSxFQUFBSixXQUFBLFNBQUFBLFdBQUEsSUFBQUksR0FBQSxJQUFBQSxHQUFBLENBQUFDLFVBQUEsV0FBQUQsR0FBQSxRQUFBQSxHQUFBLG9CQUFBQSxHQUFBLHdCQUFBQSxHQUFBLDRCQUFBRSxPQUFBLEVBQUFGLEdBQUEsVUFBQUcsS0FBQSxHQUFBUix3QkFBQSxDQUFBQyxXQUFBLE9BQUFPLEtBQUEs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